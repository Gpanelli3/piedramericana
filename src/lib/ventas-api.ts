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

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
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

export type VentaResumenMerged = {
  venta_id: string | null;
  venta_estado: VentaEstado | null;
  total_pagado_misma_moneda: number | null;
  saldo_misma_moneda: number | null;
  pct_sena_sobre_presupuesto: number | null;
  job_id: string | null;
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
      job_id: null,
    }));
  }

  const [{ data: pagos }, { data: jobs }] = await Promise.all([
    supabase.from("ventas_pagos").select("venta_id,monto,moneda").in("venta_id", ventaIds),
    supabase.from("jobs").select("id,venta_id").not("venta_id", "is", null),
  ]);

  const jobByVenta = new Map<string, string>();
  (jobs ?? []).forEach((j) => {
    if (j.venta_id && j.id) jobByVenta.set(j.venta_id, j.id);
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
        job_id: null,
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
      job_id: jobByVenta.get(venta.id) ?? null,
    };
  });
}

function parsePayload(p: Json): PresupuestoPayloadV1 | null {
  const asUnknown: unknown = p;
  return isPresupuestoPayloadV1(asUnknown) ? asUnknown : null;
}

async function resolveClientId(payload: Json, clienteNombre: string): Promise<string | null> {
  const parsed = parsePayload(payload);
  if (parsed?.clienteId) return parsed.clienteId;
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
  const exist = await supabase.from("jobs").select("id").eq("venta_id", opts.ventaId).maybeSingle();
  if (exist.error) return { error: new Error(exist.error.message) };
  if (exist.data?.id) return { error: null };

  const client_id = await resolveClientId(opts.payload, opts.clienteNombre);
  const title = `OT · ${opts.presupuestoNumero}`;
  const now = new Date().toISOString();
  const ins = await supabase.from("jobs").insert({
    title,
    quote_id: null,
    venta_id: opts.ventaId,
    client_id,
    status: "pending",
    scheduled_for: null,
    notes: `OT desde venta (${opts.presupuestoNumero}).`,
    updated_at: now,
    etapa_ot: "medicion",
    pausada: false,
  });
  if (ins.error) return { error: new Error(ins.error.message) };
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

  const { count, error: cErr } = await supabase
    .from("ventas_pagos")
    .select("id", { count: "exact", head: true })
    .eq("venta_id", venta.id);
  const prevCount = !cErr && typeof count === "number" ? count : undefined;
  const esPrimeraSenia = prevCount === 0;

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

  if (esPrimeraSenia) {
    return crearJobOtSiAusente({
      ventaId: venta.id,
      presupuestoNumero: presCast.numero,
      clienteNombre: presCast.cliente,
      payload: presCast.payload as Json,
    });
  }

  return { error: null };
}

function etapaOtValida(raw: unknown): EtapaOtKanban {
  const ok = raw === "medicion" || raw === "corte" || raw === "produccion" || raw === "despacho";
  return ok ? raw : "medicion";
}

export async function persistJobOtProduccion(opts: {
  jobId: string;
  patch: {
    etapa_ot?: EtapaOtKanban;
    pausada?: boolean;
    status?: JobStatus;
  };
}): Promise<{ error: Error | null }> {
  const prev = await supabase.from("jobs").select("*").eq("id", opts.jobId).maybeSingle();
  if (prev.error) return { error: new Error(prev.error.message) };
  const job = prev.data as JobRow | undefined;
  if (!job) return { error: new Error("Job no encontrado.") };

  const nextEtapa = opts.patch.etapa_ot ?? etapaOtValida(job.etapa_ot);
  const nextPausada =
    typeof opts.patch.pausada === "boolean" ? opts.patch.pausada : Boolean(job.pausada);
  const nextStatus: JobStatus = opts.patch.status ?? (job.status as JobStatus);

  const now = new Date().toISOString();
  const up = await supabase
    .from("jobs")
    .update({
      etapa_ot: nextEtapa,
      pausada: nextPausada,
      status: nextStatus,
      updated_at: now,
    })
    .eq("id", opts.jobId);
  if (up.error) return { error: new Error(up.error.message) };

  if (!job.venta_id) return { error: null };

  const { data: ventaRow, error: vErr } = await supabase
    .from("ventas")
    .select("estado")
    .eq("id", job.venta_id)
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

  const vUp = await supabase.from("ventas").update({ estado: ventaPatch, updated_at: now }).eq("id", job.venta_id);
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
  data: JobRow[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .not("venta_id", "is", null)
    .neq("status", "cancelled")
    .neq("status", "done");

  return {
    data: (data as JobRow[] | null) ?? null,
    error: error ? new Error(error.message) : null,
  };
}

export type OtTarjeta = {
  job: JobRow;
  presupuestoFuente: OtKanbanFuentePayload | null;
};

export async function loadOtKanbanView(): Promise<{ data: OtTarjeta[]; error: Error | null }> {
  const { data: jobsList, error: jErr } = await listOtJobsKanbanRows();
  if (jErr) return { data: [], error: jErr };
  const list = jobsList ?? [];
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

  const merged: OtTarjeta[] = list.map((job) => {
    const vid = job.venta_id as string | null;
    const pid = vid ? presupuestoPorVenta.get(vid) : undefined;
    const presupuestoFuente = pid ? fuentePorId.get(pid) ?? null : null;
    return { job, presupuestoFuente };
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
