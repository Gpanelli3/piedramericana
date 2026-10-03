import { supabase } from "@/lib/supabase";
import {
  ensureOtsParaPresupuesto,
  persistJobOtProduccion,
  textoDesdeOtPayloadClienteMaterial,
  type OtKanbanFuentePayload,
} from "@/lib/ventas-api";
import { fetchM2TriosPorPresupuestos, m2CambioSignificativo } from "@/lib/ot-medidas-api";
import { formatMetraje, type M2Trio } from "@/lib/presupuesto-calculos";
import { bajaChapaPorRotura, reservarChapasAOt } from "@/lib/stock-ot-api";
import { evaluarEnvioAProduccion } from "@/lib/medicion-api";
import { motivoBloqueoEnvio } from "@/lib/medicion-reglas";
import type {
  Database,
  EtapaOtKanban,
  JobStatus,
  Json,
  OtTipo,
  VentaEstado,
} from "@/types/database";
import type { ProduccionOtFiltro } from "@/types/workspace";
import { hydratePresupuestoPayloadV1, isPresupuestoPayloadV1 } from "@/types/presupuesto-payload";

type OrdenTrabajoRow = Database["public"]["Tables"]["ordenes_trabajo"]["Row"];

export const ETAPAS_OT_ORDEN = ["medicion", "corte", "produccion", "despacho"] as const;
export type EtapaOtId = (typeof ETAPAS_OT_ORDEN)[number];

export type OtProduccionItem = {
  orden: OrdenTrabajoRow;
  ventaId: string | null;
  ventaEstado: VentaEstado | null;
  presupuestoId: string | null;
  presupuestoNumero: string;
  cliente: string;
  materialLabel: string;
  m2Display: string;
  m2Venta: number;
  m2Obra: number;
  m2Dif: number;
  m2Significativo: boolean;
  vendedorLabel: string;
  direccionObra: string;
  esReposicion: boolean;
  otOrigenTitulo: string | null;
};

export type VentaGrupoOt = {
  ventaId: string;
  ventaEstado: VentaEstado;
  presupuestoNumero: string;
  cliente: string;
  ots: OtProduccionItem[];
  m2Venta: number;
  m2Obra: number;
};

export type UrgenciaOt = "vencida" | "urgente" | "ok" | "sin_fecha";

function parsePayload(payload: Json | null | undefined) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (!isPresupuestoPayloadV1(payload)) return null;
  return hydratePresupuestoPayloadV1(payload);
}

function etapaOtValida(raw: unknown): EtapaOtKanban {
  const ok = raw === "medicion" || raw === "corte" || raw === "produccion" || raw === "despacho";
  return ok ? raw : "medicion";
}

export function coalesceEtapaOt(raw: unknown): EtapaOtId {
  return ETAPAS_OT_ORDEN.includes(raw as EtapaOtId) ? (raw as EtapaOtId) : "medicion";
}

export function siguienteEtapaOt(etapa: EtapaOtId): EtapaOtId | null {
  const i = ETAPAS_OT_ORDEN.indexOf(etapa);
  if (i < 0 || i >= ETAPAS_OT_ORDEN.length - 1) return null;
  return ETAPAS_OT_ORDEN[i + 1]!;
}

export function anteriorEtapaOt(etapa: EtapaOtId): EtapaOtId | null {
  const i = ETAPAS_OT_ORDEN.indexOf(etapa);
  if (i <= 0) return null;
  return ETAPAS_OT_ORDEN[i - 1]!;
}

/** Días restantes hasta fecha_programada (negativo = vencida). */
export function diasHastaEntrega(fechaProgramada: string | null | undefined): number | null {
  if (!fechaProgramada || fechaProgramada.length < 10) return null;
  const day = fechaProgramada.slice(0, 10);
  const target = new Date(`${day}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const hoy = new Date();
  const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12);
  return Math.round((target.getTime() - hoyMid.getTime()) / 86_400_000);
}

export function urgenciaOt(fechaProgramada: string | null | undefined): UrgenciaOt {
  const d = diasHastaEntrega(fechaProgramada);
  if (d === null) return "sin_fecha";
  if (d < 0) return "vencida";
  if (d <= 5) return "urgente";
  return "ok";
}

function direccionDesdeOrden(ordenWizard: {
  obraFormattedAddress?: string;
  direccionObra?: string;
  referenciaObra?: string;
} | undefined): string {
  const dir =
    ordenWizard?.obraFormattedAddress?.trim() ||
    ordenWizard?.direccionObra?.trim() ||
    ordenWizard?.referenciaObra?.trim() ||
    "";
  return dir || "—";
}

function direccionDesdePresupuesto(pres: OtKanbanFuentePayload | null, ordenKey?: string | null): string {
  const p = parsePayload((pres?.payload ?? null) as Json);
  if (!p) return "—";
  const ot =
    (ordenKey ? p.ordenes?.find((o) => o.key === ordenKey) : null) ?? p.ordenes?.[0];
  return direccionDesdeOrden(ot);
}

function materialDesdeOrden(
  pres: OtKanbanFuentePayload | null,
  ordenKey: string | null,
  fallback: string,
): string {
  const p = parsePayload((pres?.payload ?? null) as Json);
  if (!p) return fallback;
  const ot = ordenKey ? p.ordenes?.find((o) => o.key === ordenKey) : p.ordenes?.[0];
  const fromChapa = ot?.chapaSugeridaLabel?.trim();
  const fromTitulo = ot?.titulo?.trim();
  return fromChapa || fromTitulo || fallback;
}

function trioDeOt(
  orden: OrdenTrabajoRow,
  trios: Map<string, { total: M2Trio; porOrdenKey: Map<string, M2Trio> }>,
  presupuestoId: string | null,
): M2Trio {
  const empty = { venta: 0, obra: 0, dif: 0 };
  if (!presupuestoId) return empty;
  const pack = trios.get(presupuestoId);
  if (!pack) return empty;
  const key = (orden.orden_key ?? "").trim();
  if (key && pack.porOrdenKey.has(key)) return pack.porOrdenKey.get(key)!;
  return pack.total;
}

async function enrichOts(
  list: OrdenTrabajoRow[],
): Promise<{ data: OtProduccionItem[]; error: Error | null }> {
  if (list.length === 0) return { data: [], error: null };

  const ventaIds = [...new Set(list.map((j) => j.venta_id).filter(Boolean) as string[])];
  const ventaById = new Map<string, { id: string; estado: VentaEstado; presupuesto_id: string }>();

  if (ventaIds.length > 0) {
    const { data: ventas, error: vErr } = await supabase
      .from("ventas")
      .select("id,estado,presupuesto_id")
      .in("id", ventaIds);
    if (vErr) return { data: [], error: new Error(vErr.message) };
    for (const v of ventas ?? []) {
      ventaById.set(v.id, {
        id: v.id,
        estado: v.estado as VentaEstado,
        presupuesto_id: v.presupuesto_id,
      });
    }
  }

  const presIds = [...new Set(Array.from(ventaById.values()).map((v) => v.presupuesto_id))];
  const fuentePorId = new Map<string, OtKanbanFuentePayload>();
  if (presIds.length > 0) {
    const { data: presRows, error: pErr } = await supabase
      .from("presupuestos")
      .select("id,numero,cliente,payload")
      .in("id", presIds);
    if (pErr) return { data: [], error: new Error(pErr.message) };
    for (const row of (presRows ?? []) as OtKanbanFuentePayload[]) {
      fuentePorId.set(row.id, row);
    }
  }

  const triosRes = await fetchM2TriosPorPresupuestos(
    [...fuentePorId.values()].map((p) => ({ id: p.id, payload: p.payload })),
  );
  if (triosRes.error) return { data: [], error: triosRes.error };

  const origenIds = [
    ...new Set(list.map((o) => o.ot_origen_id).filter(Boolean) as string[]),
  ];
  const origenTituloById = new Map<string, string>();
  for (const o of list) {
    origenTituloById.set(o.id, o.titulo);
  }
  const missingOrigen = origenIds.filter((id) => !origenTituloById.has(id));
  if (missingOrigen.length > 0) {
    const { data: origenes } = await supabase
      .from("ordenes_trabajo")
      .select("id,titulo")
      .in("id", missingOrigen);
    for (const o of origenes ?? []) {
      origenTituloById.set(o.id, o.titulo);
    }
  }

  const data: OtProduccionItem[] = list.map((orden) => {
    const venta = orden.venta_id ? ventaById.get(orden.venta_id) ?? null : null;
    const presupuesto = venta ? fuentePorId.get(venta.presupuesto_id) ?? null : null;
    const labels = textoDesdeOtPayloadClienteMaterial(presupuesto);
    const ordenKey = (orden.orden_key ?? "").trim() || null;
    const trio = trioDeOt(orden, triosRes.data, presupuesto?.id ?? venta?.presupuesto_id ?? null);
    const m2Display =
      trio.obra > 0 || trio.venta > 0 ? `${formatMetraje(trio.obra)} m²` : labels.m2Display;
    return {
      orden,
      ventaId: venta?.id ?? orden.venta_id,
      ventaEstado: venta?.estado ?? null,
      presupuestoId: presupuesto?.id ?? venta?.presupuesto_id ?? null,
      presupuestoNumero: presupuesto?.numero ?? "—",
      cliente: presupuesto?.cliente?.trim() || "—",
      materialLabel: materialDesdeOrden(presupuesto, ordenKey, labels.materialLabel),
      m2Display,
      m2Venta: trio.venta,
      m2Obra: trio.obra,
      m2Dif: trio.dif,
      m2Significativo: m2CambioSignificativo(trio.venta, trio.obra),
      vendedorLabel: labels.vendedorLabel,
      direccionObra: direccionDesdePresupuesto(presupuesto, ordenKey),
      esReposicion: orden.tipo === "reposicion",
      otOrigenTitulo: orden.ot_origen_id
        ? origenTituloById.get(orden.ot_origen_id) ?? null
        : null,
    };
  });

  return { data, error: null };
}

function agruparPorVenta(items: OtProduccionItem[]): VentaGrupoOt[] {
  const map = new Map<string, VentaGrupoOt>();
  const sinVenta: VentaGrupoOt[] = [];

  for (const item of items) {
    const vid = item.ventaId;
    if (!vid) {
      sinVenta.push({
        ventaId: `sin-venta-${item.orden.id}`,
        ventaEstado: (item.ventaEstado ?? "senado") as VentaEstado,
        presupuestoNumero: item.presupuestoNumero,
        cliente: item.cliente,
        ots: [item],
        m2Venta: 0,
        m2Obra: 0,
      });
      continue;
    }
    let g = map.get(vid);
    if (!g) {
      g = {
        ventaId: vid,
        ventaEstado: (item.ventaEstado ?? "senado") as VentaEstado,
        presupuestoNumero: item.presupuestoNumero,
        cliente: item.cliente,
        ots: [],
        m2Venta: 0,
        m2Obra: 0,
      };
      map.set(vid, g);
    }
    g.ots.push(item);
  }

  const grupos = [...map.values(), ...sinVenta];
  const grupoTieneActivas = (g: VentaGrupoOt) => g.ots.some((ot) => ot.orden.estado !== "done");
  grupos.sort((a, b) => {
    const aAct = grupoTieneActivas(a) ? 0 : 1;
    const bAct = grupoTieneActivas(b) ? 0 : 1;
    if (aAct !== bAct) return aAct - bAct;
    return a.presupuestoNumero.localeCompare(b.presupuestoNumero, "es");
  });
  for (const g of grupos) {
    g.ots.sort((a, b) => {
      const aDone = a.orden.estado === "done" ? 1 : 0;
      const bDone = b.orden.estado === "done" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      if (a.esReposicion !== b.esReposicion) return a.esReposicion ? 1 : -1;
      return a.orden.titulo.localeCompare(b.orden.titulo, "es");
    });
    const paraM2 = g.ots.filter((ot) => !ot.esReposicion);
    g.m2Venta = paraM2.reduce((s, ot) => s + ot.m2Venta, 0);
    g.m2Obra = paraM2.reduce((s, ot) => s + ot.m2Obra, 0);
  }
  return grupos;
}

/** Vista General: todas las OTs de venta (incluye entregadas; excluye canceladas). */
export async function getOtsAgrupadas(): Promise<{
  data: VentaGrupoOt[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("ordenes_trabajo")
    .select("*")
    .not("venta_id", "is", null)
    .neq("estado", "cancelled")
    .order("creado_en", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };
  const enriched = await enrichOts((data as OrdenTrabajoRow[] | null) ?? []);
  if (enriched.error) return { data: [], error: enriched.error };
  return { data: agruparPorVenta(enriched.data), error: null };
}

type FiltroTab = Exclude<ProduccionOtFiltro, "general">;

/** OTs según tab de Producción (excepto General). */
export async function getOtsPorFiltro(
  filtro: FiltroTab,
): Promise<{ data: OtProduccionItem[]; error: Error | null }> {
  let q = supabase.from("ordenes_trabajo").select("*").not("venta_id", "is", null);

  if (filtro === "entregadas") {
    q = q.eq("estado", "done");
  } else {
    q = q.neq("estado", "cancelled").neq("estado", "done");
  }

  if (filtro === "venta_retenida") {
    q = q.or("bloqueada.eq.true,pausada.eq.true");
  } else if (filtro === "produccion") {
    q = q.in("etapa", ["corte", "produccion"]);
  } else if (filtro === "logistica") {
    q = q.eq("etapa", "despacho");
  }

  q = q.order("fecha_programada", { ascending: true, nullsFirst: false }).order("creado_en", {
    ascending: false,
  });

  const { data, error } = await q;
  if (error) return { data: [], error: new Error(error.message) };
  return enrichOts((data as OrdenTrabajoRow[] | null) ?? []);
}

export async function getOtsAgrupadasPorFiltro(
  filtro: FiltroTab,
): Promise<{ data: VentaGrupoOt[]; error: Error | null }> {
  const res = await getOtsPorFiltro(filtro);
  if (res.error) return { data: [], error: res.error };
  return { data: agruparPorVenta(res.data), error: null };
}

/** OTs de la venta ligada a un cobro (`ventas_pagos.id`). */
export async function getOtsDesdePagoId(
  pagoId: string,
): Promise<{ data: OtProduccionItem[]; error: Error | null }> {
  const { data: pago, error: pErr } = await supabase
    .from("ventas_pagos")
    .select("venta_id")
    .eq("id", pagoId)
    .maybeSingle();
  if (pErr) return { data: [], error: new Error(pErr.message) };
  if (!pago?.venta_id) return { data: [], error: null };

  const { data, error } = await supabase
    .from("ordenes_trabajo")
    .select("*")
    .eq("venta_id", pago.venta_id)
    .neq("estado", "cancelled")
    .order("creado_en", { ascending: true });
  if (error) return { data: [], error: new Error(error.message) };
  return enrichOts((data as OrdenTrabajoRow[] | null) ?? []);
}

export async function getOtProduccionById(
  otId: string,
): Promise<{ data: OtProduccionItem | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("ordenes_trabajo")
    .select("*")
    .eq("id", otId)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: new Error("No se encontró la OT.") };
  const enriched = await enrichOts([data as OrdenTrabajoRow]);
  if (enriched.error) return { data: null, error: enriched.error };
  return { data: enriched.data[0] ?? null, error: null };
}

export async function setOtBloqueada(
  otId: string,
  motivo: string,
): Promise<{ error: Error | null }> {
  const motivoTrim = motivo.trim();
  if (!motivoTrim) return { error: new Error("Indicá el motivo del bloqueo.") };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ordenes_trabajo")
    .update({
      bloqueada: true,
      motivo_bloqueo: motivoTrim,
      actualizado_en: now,
    })
    .eq("id", otId);
  return { error: error ? new Error(error.message) : null };
}

export async function setOtDesbloqueada(otId: string): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ordenes_trabajo")
    .update({
      bloqueada: false,
      motivo_bloqueo: null,
      actualizado_en: now,
    })
    .eq("id", otId);
  return { error: error ? new Error(error.message) : null };
}

export async function setOtNotas(
  otId: string,
  notas: string | null,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("ordenes_trabajo")
    .update({ notas: notas ?? null, actualizado_en: new Date().toISOString() })
    .eq("id", otId);
  return { error: error ? new Error(error.message) : null };
}

export async function setOtPausada(
  otId: string,
  pausada: boolean,
): Promise<{ error: Error | null }> {
  return persistJobOtProduccion({ ordenTrabajoId: otId, patch: { pausada } });
}

export async function setOtFechaProgramada(
  otId: string,
  fecha: string | null,
): Promise<{ error: Error | null }> {
  let value: string | null = null;
  if (fecha && fecha.trim()) {
    const day = fecha.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return { error: new Error("Fecha inválida.") };
    }
    value = `${day}T12:00:00.000Z`;
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ordenes_trabajo")
    .update({ fecha_programada: value, actualizado_en: now })
    .eq("id", otId);
  return { error: error ? new Error(error.message) : null };
}

async function presupuestoIdDesdeOt(ot: OrdenTrabajoRow): Promise<{
  presupuestoId: string | null;
  error: Error | null;
}> {
  if (!ot.venta_id) return { presupuestoId: null, error: new Error("La OT no tiene venta asociada.") };
  const venta = await supabase
    .from("ventas")
    .select("presupuesto_id")
    .eq("id", ot.venta_id)
    .maybeSingle();
  if (venta.error) return { presupuestoId: null, error: new Error(venta.error.message) };
  return { presupuestoId: venta.data?.presupuesto_id ?? null, error: null };
}

/** Compuerta única: no se sale de medición a corte sin aprobado + seña + medición resuelta. */
async function assertPuedeSalirDeMedicion(
  ot: OrdenTrabajoRow,
  nextEtapa: EtapaOtId,
): Promise<Error | null> {
  const actual = coalesceEtapaOt(ot.etapa);
  if (actual !== "medicion") return null;
  if (nextEtapa === "medicion") return null;
  const pres = await presupuestoIdDesdeOt(ot);
  if (pres.error) return pres.error;
  if (!pres.presupuestoId) return new Error("La OT no tiene presupuesto asociado.");
  const evalRes = await evaluarEnvioAProduccion(pres.presupuestoId);
  if (evalRes.error) return evalRes.error;
  if (!evalRes.data) return new Error("No se pudo evaluar el envío a producción.");
  const motivo = motivoBloqueoEnvio(evalRes.data);
  if (motivo) return new Error(motivo);
  return null;
}

export async function enviarPresupuestoAProduccion(presupuestoId: string): Promise<{
  error: Error | null;
  otIds: string[];
}> {
  const evalRes = await evaluarEnvioAProduccion(presupuestoId);
  if (evalRes.error) return { error: evalRes.error, otIds: [] };
  if (!evalRes.data) return { error: new Error("No se pudo evaluar el envío a producción."), otIds: [] };
  if (!evalRes.data.ok) {
    return {
      error: new Error(motivoBloqueoEnvio(evalRes.data) ?? "No se puede enviar a producción."),
      otIds: [],
    };
  }

  const ensure = await ensureOtsParaPresupuesto(presupuestoId);
  if (ensure.error) return { error: ensure.error, otIds: [] };

  const venta = await supabase
    .from("ventas")
    .select("id")
    .eq("presupuesto_id", presupuestoId)
    .maybeSingle();
  if (venta.error) return { error: new Error(venta.error.message), otIds: [] };
  if (!venta.data?.id) return { error: new Error("No hay venta (falta la seña)."), otIds: [] };

  const ots = await supabase
    .from("ordenes_trabajo")
    .select("id,etapa,estado,bloqueada,pausada")
    .eq("venta_id", venta.data.id)
    .neq("estado", "cancelled");
  if (ots.error) return { error: new Error(ots.error.message), otIds: [] };

  const avanzadas: string[] = [];
  for (const ot of ots.data ?? []) {
    if (ot.estado === "done") continue;
    if (coalesceEtapaOt(ot.etapa) !== "medicion") continue;
    const res = await avanzarEtapaOt(ot.id);
    if (res.error) return { error: res.error, otIds: avanzadas };
    avanzadas.push(ot.id);
  }
  if (avanzadas.length === 0 && (ots.data ?? []).length === 0) {
    return { error: new Error("No hay órdenes de trabajo para enviar."), otIds: [] };
  }
  return { error: null, otIds: avanzadas };
}

export async function avanzarEtapaOt(otId: string): Promise<{ error: Error | null }> {
  const prev = await supabase.from("ordenes_trabajo").select("*").eq("id", otId).maybeSingle();
  if (prev.error) return { error: new Error(prev.error.message) };
  const ot = prev.data as OrdenTrabajoRow | null;
  if (!ot) return { error: new Error("Orden de trabajo no encontrada.") };
  if (ot.bloqueada) return { error: new Error("La OT está bloqueada.") };
  if (ot.pausada) return { error: new Error("La OT está pausada.") };
  if (ot.estado === "done" || ot.estado === "cancelled") {
    return { error: new Error("La OT ya está cerrada.") };
  }

  const etapa = coalesceEtapaOt(ot.etapa);
  const next = siguienteEtapaOt(etapa);
  if (!next) return { error: new Error("Ya está en la última etapa. Usá «Marcar entregada».") };

  const gate = await assertPuedeSalirDeMedicion(ot, next);
  if (gate) return { error: gate };

  let status: JobStatus = (ot.estado as JobStatus) ?? "pending";
  if (status === "pending") status = "in_progress";

  return persistJobOtProduccion({
    ordenTrabajoId: otId,
    patch: { etapa: next, status },
  });
}

export async function setEtapaOt(
  otId: string,
  etapa: EtapaOtKanban,
): Promise<{ error: Error | null }> {
  const prev = await supabase.from("ordenes_trabajo").select("*").eq("id", otId).maybeSingle();
  if (prev.error) return { error: new Error(prev.error.message) };
  const ot = prev.data as OrdenTrabajoRow | null;
  if (!ot) return { error: new Error("Orden de trabajo no encontrada.") };
  if (ot.bloqueada) return { error: new Error("La OT está bloqueada.") };
  if (ot.pausada) return { error: new Error("La OT está pausada.") };

  const next = etapaOtValida(etapa);
  const gate = await assertPuedeSalirDeMedicion(ot, next);
  if (gate) return { error: gate };

  let status: JobStatus = (ot.estado as JobStatus) ?? "pending";
  if (status === "pending") status = "in_progress";

  return persistJobOtProduccion({
    ordenTrabajoId: otId,
    patch: { etapa: next, status },
  });
}

export async function marcarOtEntregada(otId: string): Promise<{ error: Error | null }> {
  return persistJobOtProduccion({
    ordenTrabajoId: otId,
    patch: { status: "done" },
  });
}

export async function registrarRoturaYReposicion(opts: {
  otOrigenId: string;
  chapaId: string;
  motivo: string;
  crearReposicion?: boolean;
  chapaNuevaId?: string | null;
  created_by?: string | null;
}): Promise<{ otReposicionId: string | null; error: Error | null }> {
  const motivo = opts.motivo.trim();
  if (!motivo) return { otReposicionId: null, error: new Error("Indicá el motivo de la rotura.") };

  const prev = await supabase
    .from("ordenes_trabajo")
    .select("*")
    .eq("id", opts.otOrigenId)
    .maybeSingle();
  if (prev.error) return { otReposicionId: null, error: new Error(prev.error.message) };
  const origen = prev.data as OrdenTrabajoRow | null;
  if (!origen) return { otReposicionId: null, error: new Error("OT de origen no encontrada.") };

  const baja = await bajaChapaPorRotura({
    chapaId: opts.chapaId,
    otId: opts.otOrigenId,
    motivo,
    created_by: opts.created_by ?? null,
  });
  if (baja.error) return { otReposicionId: null, error: baja.error };

  const now = new Date().toISOString();
  const notasOrigen = [origen.notas?.trim(), `Rotura: ${motivo}`].filter(Boolean).join("\n");
  const pausa = await supabase
    .from("ordenes_trabajo")
    .update({
      pausada: true,
      notas: notasOrigen || null,
      actualizado_en: now,
    })
    .eq("id", opts.otOrigenId);
  if (pausa.error) return { otReposicionId: null, error: new Error(pausa.error.message) };

  if (opts.crearReposicion === false) {
    return { otReposicionId: null, error: null };
  }

  const tituloBase = origen.titulo.replace(/^Reposición\s*·\s*/i, "").trim() || origen.titulo;
  const etapaHija: EtapaOtKanban =
    coalesceEtapaOt(origen.etapa) === "medicion" ? "medicion" : "corte";
  const ins = await supabase
    .from("ordenes_trabajo")
    .insert({
      titulo: `Reposición · ${tituloBase}`,
      id_cotizacion: origen.id_cotizacion,
      venta_id: origen.venta_id,
      id_cliente: origen.id_cliente,
      estado: "pending",
      fecha_programada: origen.fecha_programada,
      notas: `Reposición de ${tituloBase}. ${motivo}`,
      actualizado_en: now,
      etapa: etapaHija,
      pausada: false,
      bloqueada: false,
      requiere_reserva_stock: !opts.chapaNuevaId,
      medidas_confirmadas: origen.medidas_confirmadas,
      fecha_medidas_confirmadas: origen.fecha_medidas_confirmadas,
      orden_key: origen.orden_key,
      tipo: "reposicion" as OtTipo,
      ot_origen_id: origen.id,
    })
    .select("id")
    .single();
  if (ins.error) return { otReposicionId: null, error: new Error(ins.error.message) };
  const nuevaId = ins.data?.id ?? null;
  if (!nuevaId) return { otReposicionId: null, error: new Error("No se pudo crear la OT de reposición.") };

  if (opts.chapaNuevaId) {
    const res = await reservarChapasAOt({
      otId: nuevaId,
      chapaIds: [opts.chapaNuevaId],
      permitirMezclaLotes: true,
      created_by: opts.created_by ?? null,
    });
    if (res.error) return { otReposicionId: nuevaId, error: res.error };
  }

  return { otReposicionId: nuevaId, error: null };
}

/** Extrae fecha de entrega del payload del presupuesto (primer OT o logística). */
export function fechaEntregaDesdePayload(payload: Json | null | undefined): string | null {
  const p = parsePayload(payload ?? null);
  if (!p) return null;
  const fromOt = p.ordenes
    ?.map((o) => o.fechaEntrega?.trim())
    .find((f) => f && f.length >= 10);
  if (fromOt) return fromOt.slice(0, 10);
  const log = p.logistica?.fechaEntrega?.trim();
  if (log && log.length >= 10) return log.slice(0, 10);
  return null;
}

export function fechaProgramadaInputValue(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return "";
  return iso.slice(0, 10);
}

export type OtSaldoVenta = {
  total: number;
  moneda: "ars" | "usd";
  cobrado: number;
  saldo: number;
  pct: number;
};

export async function getOtSaldoVenta(
  ventaId: string | null,
): Promise<{ data: OtSaldoVenta | null; error: Error | null }> {
  if (!ventaId) return { data: null, error: null };

  const ventaRes = await supabase
    .from("ventas")
    .select("presupuesto_id")
    .eq("id", ventaId)
    .maybeSingle();
  if (ventaRes.error) return { data: null, error: new Error(ventaRes.error.message) };
  if (!ventaRes.data?.presupuesto_id) return { data: null, error: null };

  const presRes = await supabase
    .from("presupuestos")
    .select("total,moneda")
    .eq("id", ventaRes.data.presupuesto_id)
    .maybeSingle();
  if (presRes.error) return { data: null, error: new Error(presRes.error.message) };
  if (!presRes.data) return { data: null, error: null };

  const total = Number(presRes.data.total ?? 0);
  const moneda = (presRes.data.moneda ?? "ars") as "ars" | "usd";

  const pagosRes = await supabase
    .from("ventas_pagos")
    .select("monto,moneda")
    .eq("venta_id", ventaId);
  if (pagosRes.error) return { data: null, error: new Error(pagosRes.error.message) };

  let cobrado = 0;
  for (const p of pagosRes.data ?? []) {
    if (p.moneda !== moneda) continue;
    const m = typeof p.monto === "string" ? parseFloat(p.monto) : Number(p.monto ?? 0);
    if (Number.isFinite(m) && m > 0) cobrado += m;
  }
  const saldo = total - cobrado;
  const pct = total > 0 ? Math.min(100, Math.round((cobrado / total) * 100)) : 0;

  return { data: { total, moneda, cobrado, saldo, pct }, error: null };
}
