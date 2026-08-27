import { supabase } from "@/lib/supabase";
import {
  persistJobOtProduccion,
  textoDesdeOtPayloadClienteMaterial,
  type OtKanbanFuentePayload,
} from "@/lib/ventas-api";
import type {
  Database,
  EtapaOtKanban,
  JobStatus,
  Json,
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
  vendedorLabel: string;
  direccionObra: string;
};

export type VentaGrupoOt = {
  ventaId: string;
  ventaEstado: VentaEstado;
  presupuestoNumero: string;
  cliente: string;
  ots: OtProduccionItem[];
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

function direccionDesdePresupuesto(pres: OtKanbanFuentePayload | null): string {
  const p = parsePayload((pres?.payload ?? null) as Json);
  if (!p) return "—";
  const ot0 = p.ordenes?.[0];
  const dir =
    ot0?.obraFormattedAddress?.trim() ||
    ot0?.direccionObra?.trim() ||
    ot0?.referenciaObra?.trim() ||
    "";
  return dir || "—";
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

  const data: OtProduccionItem[] = list.map((orden) => {
    const venta = orden.venta_id ? ventaById.get(orden.venta_id) ?? null : null;
    const presupuesto = venta ? fuentePorId.get(venta.presupuesto_id) ?? null : null;
    const labels = textoDesdeOtPayloadClienteMaterial(presupuesto);
    return {
      orden,
      ventaId: venta?.id ?? orden.venta_id,
      ventaEstado: venta?.estado ?? null,
      presupuestoId: presupuesto?.id ?? venta?.presupuesto_id ?? null,
      presupuestoNumero: presupuesto?.numero ?? "—",
      cliente: presupuesto?.cliente?.trim() || "—",
      materialLabel: labels.materialLabel,
      m2Display: labels.m2Display,
      vendedorLabel: labels.vendedorLabel,
      direccionObra: direccionDesdePresupuesto(presupuesto),
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
      };
      map.set(vid, g);
    }
    g.ots.push(item);
  }

  const grupos = [...map.values(), ...sinVenta];
  grupos.sort((a, b) => a.presupuestoNumero.localeCompare(b.presupuestoNumero, "es"));
  for (const g of grupos) {
    g.ots.sort((a, b) => a.orden.titulo.localeCompare(b.orden.titulo, "es"));
  }
  return grupos;
}

/** Vista General: OTs activas agrupadas por venta. */
export async function getOtsAgrupadas(): Promise<{
  data: VentaGrupoOt[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("ordenes_trabajo")
    .select("*")
    .not("venta_id", "is", null)
    .neq("estado", "cancelled")
    .neq("estado", "done")
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
  } else if (filtro === "tecnica") {
    q = q.eq("etapa", "medicion").eq("bloqueada", false);
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

  let status: JobStatus = (ot.estado as JobStatus) ?? "pending";
  if (status === "pending") status = "in_progress";

  return persistJobOtProduccion({
    ordenTrabajoId: otId,
    patch: { etapa: etapaOtValida(etapa), status },
  });
}

export async function marcarOtEntregada(otId: string): Promise<{ error: Error | null }> {
  return persistJobOtProduccion({
    ordenTrabajoId: otId,
    patch: { status: "done" },
  });
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
