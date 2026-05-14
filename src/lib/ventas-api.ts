import { supabase } from "@/lib/supabase";
import type {
  Database,
  EtapaOtKanban,
  JobStatus,
  Json,
  VentaEstado,
} from "@/types/database";
import type { PresupuestoPayloadV1 } from "@/types/presupuesto-payload";
import { isPresupuestoPayloadV1 } from "@/types/presupuesto-payload";

type OrdenTrabajoRow = Database["public"]["Tables"]["ordenes_trabajo"]["Row"];
type VentaRow = Database["public"]["Tables"]["ventas"]["Row"];
type PresupuestoRow = Database["public"]["Tables"]["presupuestos"]["Row"];

export async function ensureVentaForPresupuestoAprobado(
  presupuestoId: string,
): Promise<{ error: Error | null }> {
  const dup = await supabase.from("ventas").select("id").eq("presupuesto_id", presupuestoId).maybeSingle();
  if (dup.error) return { error: new Error(dup.error.message) };
  if (dup.data?.id) return { error: null };
  const ins = await supabase
    .from("ventas")
    .insert({ presupuesto_id: presupuestoId, estado: "aprobado_sin_sena" })
    .select("id")
    .maybeSingle();
  if (ins.error) return { error: new Error(ins.error.message) };
  return { error: null };
}

export async function getVentaPorPresupuesto(
  presupuestoId: string,
): Promise<{ data: VentaRow | null; error: Error | null }> {
  const r = await supabase.from("ventas").select("*").eq("presupuesto_id", presupuestoId).maybeSingle();
  return {
    data: (r.data as VentaRow | undefined) ?? null,
    error: r.error ? new Error(r.error.message) : null,
  };
}

/**
 * Aprueba el presupuesto (actualiza total), crea venta base y, si hay seña &gt; 0, registra el primer pago
 * (misma lógica que primer cobro en Ventas).
 */
export async function aprobarPresupuestoConVentaInicial(opts: {
  presupuestoId: string;
  totalAprobado: number;
  montoSenia: number;
  fecha: string;
  metodo: string;
  nota?: string;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  const presRes = await supabase.from("presupuestos").select("*").eq("id", opts.presupuestoId).maybeSingle();
  if (presRes.error) return { error: new Error(presRes.error.message) };
  const pres = presRes.data as PresupuestoRow | null;
  if (!pres) return { error: new Error("Presupuesto no encontrado.") };
  if (pres.status !== "pendiente") {
    return { error: new Error("Solo se pueden aprobar presupuestos en estado pendiente.") };
  }

  if (!Number.isFinite(opts.totalAprobado) || opts.totalAprobado < 0) {
    return { error: new Error("Total inválido.") };
  }
  if (!Number.isFinite(opts.montoSenia) || opts.montoSenia < 0) {
    return { error: new Error("Monto de seña inválido.") };
  }
  if (opts.montoSenia > opts.totalAprobado) {
    return { error: new Error("La seña no puede superar el total aprobado.") };
  }

  const nowIso = new Date().toISOString();
  const { error: uErr } = await supabase
    .from("presupuestos")
    .update({ status: "aprobado", total: opts.totalAprobado, updated_at: nowIso })
    .eq("id", opts.presupuestoId);
  if (uErr) return { error: new Error(uErr.message) };

  const ev = await ensureVentaForPresupuestoAprobado(opts.presupuestoId);
  if (ev.error) return ev;

  if (opts.montoSenia <= 0) return { error: null };

  return registrarPagoSena({
    presupuestoId: opts.presupuestoId,
    monto: opts.montoSenia,
    moneda: pres.moneda,
    fecha: opts.fecha,
    metodo: opts.metodo,
    nota: opts.nota,
    created_by: opts.created_by ?? null,
  });
}

export type VentaResumenMerged = {
  venta_id: string | null;
  venta_estado: VentaEstado | null;
  total_pagado_misma_moneda: number | null;
  saldo_misma_moneda: number | null;
  pct_sena_sobre_presupuesto: number | null;
  orden_trabajo_id: string | null;
};

export async function mergeVentasResumenIntoPresupuestos<
  T extends {
    id: string;
    total: number;
    moneda: "ars" | "usd";
    status?: string;
  },
>(rows: T[]): Promise<Array<T & VentaResumenMerged>> {
  if (rows.length === 0) return [];

  const presIds = [...new Set(rows.map((r) => r.id))];
  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("id,presupuesto_id,estado")
    .in("presupuesto_id", presIds);
  if (error) throw new Error(error.message);

  const byPres = new Map<string, VentaRow>();
  (ventas ?? []).forEach((v) => {
    byPres.set(v.presupuesto_id, v as VentaRow);
  });

  const ventaIds = (ventas ?? []).map((v) => v.id);
  if (ventaIds.length === 0) {
    return rows.map((r) => ({
      ...r,
      venta_id: null,
      venta_estado: null,
      total_pagado_misma_moneda: null,
      saldo_misma_moneda: null,
      pct_sena_sobre_presupuesto: null,
      orden_trabajo_id: null,
    }));
  }

  const pagosRes = await supabase
    .from("ventas_pagos")
    .select("venta_id,monto,moneda")
    .in("venta_id", ventaIds);
  if (pagosRes.error) throw new Error(pagosRes.error.message);
  const pagos = pagosRes.data ?? [];

  /** Si la tabla OT aún no existe en el proyecto, el listado no debe fallar. */
  const otRes = await supabase
    .from("ordenes_trabajo")
    .select("id,venta_id")
    .not("venta_id", "is", null);
  const filasOt = !otRes.error && otRes.data ? otRes.data : [];

  const otPorVenta = new Map<string, string>();
  filasOt.forEach((j) => {
    if (j.venta_id && j.id) otPorVenta.set(j.venta_id, j.id);
  });

  return rows.map((r) => {
    const venta = byPres.get(r.id);
    if (!venta) {
      return {
        ...r,
        venta_id: null,
        venta_estado: null,
        total_pagado_misma_moneda: null,
        saldo_misma_moneda: null,
        pct_sena_sobre_presupuesto: null,
        orden_trabajo_id: null,
      };
    }
    let totalMis = 0;
    for (const p of pagos ?? []) {
      if (p.venta_id !== venta.id) continue;
      if (p.moneda !== r.moneda) continue;
      const m = typeof p.monto === "string" ? parseFloat(p.monto) : Number(p.monto ?? 0);
      if (Number.isFinite(m) && m > 0) totalMis += m;
    }
    const saldoNum = Number.isFinite(r.total) ? r.total - totalMis : null;
    const pct = r.total > 0 ? Math.min(100, (totalMis / r.total) * 100) : null;
    return {
      ...r,
      venta_id: venta.id,
      venta_estado: venta.estado as VentaEstado,
      total_pagado_misma_moneda: totalMis,
      saldo_misma_moneda: saldoNum !== null ? saldoNum : null,
      pct_sena_sobre_presupuesto: pct,
      orden_trabajo_id: otPorVenta.get(venta.id) ?? null,
    };
  });
}

function parsePayload(p: Json): PresupuestoPayloadV1 | null {
  const asUnknown: unknown = p;
  return isPresupuestoPayloadV1(asUnknown) ? asUnknown : null;
}

/** Postgres `uuid` solo acepta formato estándar; el wizard puede guardar slugs en `clienteId`. */
function esUuidValido(s: string): boolean {
  const t = s.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
}

async function resolveClientId(payload: Json, clienteNombre: string): Promise<string | null> {
  const parsed = parsePayload(payload);
  const raw = typeof parsed?.clienteId === "string" ? parsed.clienteId.trim() : "";
  if (raw && esUuidValido(raw)) {
    const byId = await supabase.from("clients").select("id").eq("id", raw).maybeSingle();
    if (!byId.error && byId.data?.id) return byId.data.id;
  }

  const name = (clienteNombre ?? "").trim() || "Cliente";
  const found = await supabase.from("clients").select("id").eq("name", name).maybeSingle();
  if (found.error) return null;
  if (found.data?.id) return found.data.id;
  const inserted = await supabase.from("clients").insert({ name }).select("id").maybeSingle();
  if (inserted.error || !inserted.data?.id) return null;
  return inserted.data.id;
}

async function crearJobOtSiAusente(opts: {
  ventaId: string;
  presupuestoNumero: string;
  clienteNombre: string;
  payload: Json;
}): Promise<{ error: Error | null }> {
  const exist = await supabase
    .from("ordenes_trabajo")
    .select("id")
    .eq("venta_id", opts.ventaId)
    .maybeSingle();
  if (exist.error) return { error: new Error(exist.error.message) };
  if (exist.data?.id) return { error: null };

  const id_cliente = await resolveClientId(opts.payload, opts.clienteNombre);
  const titulo = `OT · ${opts.presupuestoNumero}`;
  const now = new Date().toISOString();
  const ins = await supabase.from("ordenes_trabajo").insert({
    titulo,
    id_cotizacion: null,
    venta_id: opts.ventaId,
    id_cliente,
    estado: "pending",
    fecha_programada: null,
    notas: `OT desde venta (${opts.presupuestoNumero}).`,
    actualizado_en: now,
    etapa: "medicion",
    pausada: false,
  });
  if (ins.error) return { error: new Error(ins.error.message) };
  return { error: null };
}

/**
 * Repara casos donde ya hay pagos en `ventas_pagos` pero nunca se creó la fila en `ordenes_trabajo`
 * (p. ej. falló el insert cuando aún no existía la tabla).
 */
async function repairOrdenesTrabajoFaltantes(): Promise<{ error: Error | null }> {
  const { data: pagos, error: pErr } = await supabase.from("ventas_pagos").select("venta_id");
  if (pErr) return { error: new Error(pErr.message) };
  const ventaIdsConPago = [
    ...new Set((pagos ?? []).map((p) => p.venta_id).filter(Boolean)),
  ] as string[];
  if (ventaIdsConPago.length === 0) return { error: null };

  const { data: ots, error: oErr } = await supabase
    .from("ordenes_trabajo")
    .select("venta_id")
    .in("venta_id", ventaIdsConPago);
  if (oErr) return { error: new Error(oErr.message) };
  const conOt = new Set((ots ?? []).map((o) => o.venta_id).filter(Boolean));

  const faltantes = ventaIdsConPago.filter((v) => !conOt.has(v));
  for (const ventaId of faltantes) {
    const { data: venta, error: vE } = await supabase
      .from("ventas")
      .select("presupuesto_id")
      .eq("id", ventaId)
      .maybeSingle();
    if (vE || !venta?.presupuesto_id) continue;

    const { data: pres, error: prE } = await supabase
      .from("presupuestos")
      .select("numero,cliente,payload")
      .eq("id", venta.presupuesto_id)
      .maybeSingle();
    if (prE || !pres) continue;

    const row = pres as Pick<PresupuestoRow, "numero" | "cliente" | "payload">;
    const r = await crearJobOtSiAusente({
      ventaId,
      presupuestoNumero: row.numero,
      clienteNombre: row.cliente,
      payload: row.payload as Json,
    });
    if (r.error) return r;
  }
  return { error: null };
}

export async function registrarPagoSena(opts: {
  presupuestoId: string;
  monto: number;
  moneda: "ars" | "usd";
  fecha: string;
  metodo: string;
  nota?: string;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  const { data: pres, error: pErr } = await supabase
    .from("presupuestos")
    .select("*")
    .eq("id", opts.presupuestoId)
    .maybeSingle();
  if (pErr) return { error: new Error(pErr.message) };
  const presCast = pres as PresupuestoRow | null;
  if (!presCast) return { error: new Error("Presupuesto no encontrado.") };
  if (presCast.status !== "aprobado") return { error: new Error("Solo presupuestos aprobados reciben seña.") };

  await ensureVentaForPresupuestoAprobado(opts.presupuestoId);
  const { data: ventaRaw, error: vErr } = await supabase
    .from("ventas")
    .select("*")
    .eq("presupuesto_id", opts.presupuestoId)
    .maybeSingle();
  if (vErr) return { error: new Error(vErr.message) };
  const venta = ventaRaw as VentaRow | null;
  if (!venta) return { error: new Error("No se pudo obtener la venta.") };

  const pIns = await supabase.from("ventas_pagos").insert({
    venta_id: venta.id,
    monto: opts.monto,
    moneda: opts.moneda,
    fecha: opts.fecha,
    metodo: opts.metodo,
    nota: opts.nota ?? null,
    created_by: opts.created_by ?? null,
  });
  if (pIns.error) return { error: new Error(pIns.error.message) };

  let nextEstado = venta.estado as VentaEstado;
  if (venta.estado === "aprobado_sin_sena") nextEstado = "senado";

  const now = new Date().toISOString();
  const updV = await supabase
    .from("ventas")
    .update({ estado: nextEstado, updated_at: now })
    .eq("id", venta.id);
  if (updV.error) return { error: new Error(updV.error.message) };

  return crearJobOtSiAusente({
    ventaId: venta.id,
    presupuestoNumero: presCast.numero,
    clienteNombre: presCast.cliente,
    payload: presCast.payload as Json,
  });
}

function etapaOtValida(raw: unknown): EtapaOtKanban {
  const ok = raw === "medicion" || raw === "corte" || raw === "produccion" || raw === "despacho";
  return ok ? raw : "medicion";
}

export async function persistJobOtProduccion(opts: {
  ordenTrabajoId: string;
  patch: {
    etapa?: EtapaOtKanban;
    pausada?: boolean;
    status?: JobStatus;
  };
}): Promise<{ error: Error | null }> {
  const prev = await supabase
    .from("ordenes_trabajo")
    .select("*")
    .eq("id", opts.ordenTrabajoId)
    .maybeSingle();
  if (prev.error) return { error: new Error(prev.error.message) };
  const ot = prev.data as OrdenTrabajoRow | undefined;
  if (!ot) return { error: new Error("Orden de trabajo no encontrada.") };

  const nextEtapa = opts.patch.etapa ?? etapaOtValida(ot.etapa);
  const nextPausada =
    typeof opts.patch.pausada === "boolean" ? opts.patch.pausada : Boolean(ot.pausada);
  const nextStatus: JobStatus = opts.patch.status ?? (ot.estado as JobStatus);

  const now = new Date().toISOString();
  const up = await supabase
    .from("ordenes_trabajo")
    .update({
      etapa: nextEtapa,
      pausada: nextPausada,
      estado: nextStatus,
      actualizado_en: now,
    })
    .eq("id", opts.ordenTrabajoId);
  if (up.error) return { error: new Error(up.error.message) };

  if (!ot.venta_id) return { error: null };

  const { data: ventaRow, error: vErr } = await supabase
    .from("ventas")
    .select("estado")
    .eq("id", ot.venta_id)
    .maybeSingle();
  if (vErr || !ventaRow) return { error: null };

  const vEst = ventaRow.estado as VentaEstado;

  let ventaPatch: VentaEstado | null = null;
  if (nextStatus === "done" && vEst !== "aprobado_sin_sena" && vEst !== "entregado") {
    ventaPatch = "finalizado";
  } else if (vEst === "senado" && (nextStatus === "in_progress" || nextEtapa !== "medicion")) {
    ventaPatch = "en_produccion";
  }

  if (!ventaPatch || ventaPatch === vEst) return { error: null };

  const vUp = await supabase.from("ventas").update({ estado: ventaPatch, updated_at: now }).eq("id", ot.venta_id);
  if (vUp.error) return { error: new Error(vUp.error.message) };

  return { error: null };
}

export async function marcarVentaEntregado(ventaId: string): Promise<{ error: Error | null }> {
  const { data } = await supabase.from("ventas").select("estado").eq("id", ventaId).maybeSingle();
  if (!data) return { error: new Error("Venta no encontrada.") };
  if (data.estado !== "finalizado") {
    return { error: new Error('Solo se puede pasar a "entregado" desde estado finalizado.') };
  }
  const now = new Date().toISOString();
  const r = await supabase.from("ventas").update({ estado: "entregado", updated_at: now }).eq("id", ventaId);
  if (r.error) return { error: new Error(r.error.message) };
  return { error: null };
}

export type OtKanbanFuentePayload = Pick<PresupuestoRow, "id" | "numero" | "cliente" | "payload">;

export async function fetchPresupuestoResumenOt(
  ids: string[],
): Promise<{ data: OtKanbanFuentePayload[]; error: Error | null }> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return { data: [], error: null };
  const { data, error } = await supabase
    .from("presupuestos")
    .select("id,numero,cliente,payload")
    .in("id", unique);
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as OtKanbanFuentePayload[], error: null };
}

export function textoDesdeOtPayloadClienteMaterial(
  pres: OtKanbanFuentePayload | null | undefined,
): { materialLabel: string; m2Display: string; vendedorLabel: string } {
  const p = parsePayload((pres?.payload ?? null) as Json);
  if (!p || !pres) {
    return { materialLabel: "—", m2Display: "—", vendedorLabel: "—" };
  }
  const fromLinea = p.lineasResumen?.find((l) => (l.label ?? "").trim().length > 0)?.label;
  const materialLabel =
    (fromLinea ?? p.ordenes?.[0]?.titulo ?? "Obra principal").trim() || "Obra principal";
  const m2 =
    typeof p.materialM2Presupuesto === "number"
      ? `${p.materialM2Presupuesto.toFixed(2)} m²`
      : "—";
  const vendedorLabel = (p.ordenes?.[0]?.tecnicoId ?? "").trim() || "—";
  return {
    materialLabel,
    m2Display: m2,
    vendedorLabel,
  };
}

export async function listOtJobsKanbanRows(): Promise<{
  data: OrdenTrabajoRow[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("ordenes_trabajo")
    .select("*")
    .not("venta_id", "is", null)
    .neq("estado", "cancelled")
    .neq("estado", "done");

  return {
    data: (data as OrdenTrabajoRow[] | null) ?? null,
    error: error ? new Error(error.message) : null,
  };
}

export type OtTarjeta = {
  orden: OrdenTrabajoRow;
  presupuestoFuente: OtKanbanFuentePayload | null;
};

export async function loadOtKanbanView(): Promise<{ data: OtTarjeta[]; error: Error | null }> {
  const rep = await repairOrdenesTrabajoFaltantes();
  if (rep.error) return { data: [], error: rep.error };

  const { data: otsList, error: jErr } = await listOtJobsKanbanRows();
  if (jErr) return { data: [], error: jErr };
  const list = otsList ?? [];
  if (list.length === 0) return { data: [], error: null };

  const ventaIds = [...new Set(list.map((j) => j.venta_id).filter(Boolean) as string[])];
  const { data: ventas, error: vErr } = await supabase.from("ventas").select("id,presupuesto_id").in("id", ventaIds);
  if (vErr) return { data: [], error: new Error(vErr.message) };

  const presupuestoPorVenta = new Map<string, string>();
  for (const v of ventas ?? []) {
    presupuestoPorVenta.set(v.id, v.presupuesto_id);
  }

  const presIds = [...new Set(Array.from(presupuestoPorVenta.values()))];
  const presRes = await fetchPresupuestoResumenOt(presIds);
  if (presRes.error) return { data: [], error: presRes.error };

  const fuentePorId = new Map<string, OtKanbanFuentePayload>();
  for (const row of presRes.data) fuentePorId.set(row.id, row);

  const merged: OtTarjeta[] = list.map((orden) => {
    const vid = orden.venta_id as string | null;
    const pid = vid ? presupuestoPorVenta.get(vid) : undefined;
    const presupuestoFuente = pid ? fuentePorId.get(pid) ?? null : null;
    return { orden, presupuestoFuente };
  });

  return { data: merged, error: null };
}

export async function listPagosVenta(
  ventaId: string,
): Promise<{ data: Database["public"]["Tables"]["ventas_pagos"]["Row"][]; error: Error | null }> {
  const { data, error } = await supabase
    .from("ventas_pagos")
    .select("*")
    .eq("venta_id", ventaId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  return {
    data: (data ?? []) as Database["public"]["Tables"]["ventas_pagos"]["Row"][],
    error: error ? new Error(error.message) : null,
  };
}
