import { supabase } from "@/lib/supabase";
import {
  esMedicionEstado,
  motivoBloqueoEnvio,
  puedeEnviarAProduccion,
  type MedicionEstado,
  type PuedeEnviarAProduccionResultado,
} from "@/lib/medicion-reglas";
import {
  guardarMedidasPresupuesto,
  type GuardarMedidasOtResult,
  type MedidaItemPatch,
} from "@/lib/ot-medidas-api";
import { hydratePresupuestoPayloadV1, isPresupuestoPayloadV1 } from "@/types/presupuesto-payload";
import type { Json, MedicionEstado as MedicionEstadoDb, PresupuestoEstado, VentaEstado } from "@/types/database";

export type PresupuestoMedicionRow = {
  id: string;
  presupuesto_id: string;
  estado: MedicionEstado;
  solicitado_por: string | null;
  solicitado_en: string | null;
  fecha_programada: string | null;
  medido_por: string | null;
  medido_en: string | null;
  motivo_salto: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

function mapMedicion(row: {
  id: string;
  presupuesto_id: string;
  estado: MedicionEstadoDb | string;
  solicitado_por: string | null;
  solicitado_en: string | null;
  fecha_programada: string | null;
  medido_por: string | null;
  medido_en: string | null;
  motivo_salto: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}): PresupuestoMedicionRow {
  return {
    ...row,
    estado: esMedicionEstado(row.estado) ? row.estado : "sin_solicitar",
  };
}

export async function getOrCreateMedicion(
  presupuestoId: string,
): Promise<{ data: PresupuestoMedicionRow | null; error: Error | null }> {
  const existing = await supabase
    .from("presupuesto_mediciones")
    .select("*")
    .eq("presupuesto_id", presupuestoId)
    .maybeSingle();
  if (existing.error) return { data: null, error: new Error(existing.error.message) };
  if (existing.data) return { data: mapMedicion(existing.data), error: null };

  const now = new Date().toISOString();
  const ins = await supabase
    .from("presupuesto_mediciones")
    .insert({
      presupuesto_id: presupuestoId,
      estado: "sin_solicitar",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .maybeSingle();
  if (ins.error) {
    if (ins.error.code === "23505") {
      const retry = await supabase
        .from("presupuesto_mediciones")
        .select("*")
        .eq("presupuesto_id", presupuestoId)
        .maybeSingle();
      if (retry.error) return { data: null, error: new Error(retry.error.message) };
      return { data: retry.data ? mapMedicion(retry.data) : null, error: null };
    }
    return { data: null, error: new Error(ins.error.message) };
  }
  return { data: ins.data ? mapMedicion(ins.data) : null, error: null };
}

export async function listarMedicionesPorPresupuestos(
  presupuestoIds: string[],
): Promise<{ data: Map<string, PresupuestoMedicionRow>; error: Error | null }> {
  const map = new Map<string, PresupuestoMedicionRow>();
  const unique = [...new Set(presupuestoIds.filter(Boolean))];
  if (unique.length === 0) return { data: map, error: null };
  const { data, error } = await supabase
    .from("presupuesto_mediciones")
    .select("*")
    .in("presupuesto_id", unique);
  if (error) return { data: map, error: new Error(error.message) };
  for (const row of data ?? []) {
    map.set(row.presupuesto_id, mapMedicion(row));
  }
  return { data: map, error: null };
}

export async function solicitarMedicion(opts: {
  presupuestoId: string;
  fechaProgramada?: string | null;
  usuarioId?: string | null;
}): Promise<{ data: PresupuestoMedicionRow | null; error: Error | null }> {
  const cur = await getOrCreateMedicion(opts.presupuestoId);
  if (cur.error) return cur;
  if (!cur.data) return { data: null, error: new Error("No se pudo crear la medición.") };
  if (cur.data.estado === "medido") {
    return { data: cur.data, error: new Error("La medición ya está confirmada.") };
  }
  if (cur.data.estado === "no_requiere") {
    return { data: cur.data, error: new Error("Esta obra se marcó como sin medición.") };
  }

  let fecha: string | null = null;
  if (opts.fechaProgramada?.trim()) {
    const day = opts.fechaProgramada.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return { data: null, error: new Error("Fecha inválida.") };
    }
    fecha = day;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("presupuesto_mediciones")
    .update({
      estado: "listo_para_medir",
      solicitado_por: opts.usuarioId ?? cur.data.solicitado_por,
      solicitado_en: now,
      fecha_programada: fecha,
      motivo_salto: null,
      updated_at: now,
    })
    .eq("id", cur.data.id)
    .select("*")
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data ? mapMedicion(data) : null, error: null };
}

export async function saltarMedicion(opts: {
  presupuestoId: string;
  motivo: string;
  usuarioId?: string | null;
}): Promise<{ data: PresupuestoMedicionRow | null; error: Error | null }> {
  const motivo = opts.motivo.trim();
  if (!motivo) return { data: null, error: new Error("Indicá por qué se salta la medición.") };

  const cur = await getOrCreateMedicion(opts.presupuestoId);
  if (cur.error) return cur;
  if (!cur.data) return { data: null, error: new Error("No se pudo crear la medición.") };
  if (cur.data.estado === "medido") {
    return { data: cur.data, error: new Error("La medición ya está confirmada.") };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("presupuesto_mediciones")
    .update({
      estado: "no_requiere",
      motivo_salto: motivo,
      solicitado_por: opts.usuarioId ?? cur.data.solicitado_por,
      solicitado_en: cur.data.solicitado_en ?? now,
      updated_at: now,
    })
    .eq("id", cur.data.id)
    .select("*")
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data ? mapMedicion(data) : null, error: null };
}

async function marcarOtsMedidasConfirmadas(presupuestoId: string, now: string) {
  const venta = await supabase
    .from("ventas")
    .select("id")
    .eq("presupuesto_id", presupuestoId)
    .maybeSingle();
  if (venta.error || !venta.data?.id) return { error: venta.error ? new Error(venta.error.message) : null };
  const up = await supabase
    .from("ordenes_trabajo")
    .update({
      medidas_confirmadas: true,
      fecha_medidas_confirmadas: now,
      actualizado_en: now,
    })
    .eq("venta_id", venta.data.id)
    .neq("estado", "cancelled");
  if (up.error) return { error: new Error(up.error.message) };
  return { error: null };
}

export async function confirmarMedicion(opts: {
  presupuestoId: string;
  items: MedidaItemPatch[];
  notas?: string;
  usuarioId?: string | null;
}): Promise<GuardarMedidasOtResult & { medicion: PresupuestoMedicionRow | null }> {
  const empty = {
    error: null as Error | null,
    m2Anterior: 0,
    m2Nuevo: 0,
    totalAnterior: 0,
    totalNuevo: 0,
    nroVersion: 1,
    moneda: "ars" as const,
    ventaId: null as string | null,
    medicion: null as PresupuestoMedicionRow | null,
  };

  const cur = await getOrCreateMedicion(opts.presupuestoId);
  if (cur.error) return { ...empty, error: cur.error };
  if (!cur.data) return { ...empty, error: new Error("No se pudo crear la medición.") };
  if (cur.data.estado === "no_requiere") {
    return { ...empty, error: new Error("Esta obra se marcó como sin medición.") };
  }
  if (cur.data.estado !== "listo_para_medir" && cur.data.estado !== "medido") {
    return { ...empty, error: new Error("Pedí la medición antes de confirmar las medidas.") };
  }

  const saved = await guardarMedidasPresupuesto({
    presupuestoId: opts.presupuestoId,
    items: opts.items,
    notas: opts.notas,
  });
  if (saved.error) return { ...empty, ...saved, medicion: cur.data };

  const now = new Date().toISOString();
  const notas = opts.notas?.trim() || cur.data.notas;
  const { data, error } = await supabase
    .from("presupuesto_mediciones")
    .update({
      estado: "medido",
      medido_por: opts.usuarioId ?? cur.data.medido_por,
      medido_en: now,
      notas: notas || null,
      motivo_salto: null,
      updated_at: now,
    })
    .eq("id", cur.data.id)
    .select("*")
    .maybeSingle();
  if (error) return { ...empty, ...saved, error: new Error(error.message) };

  const ots = await marcarOtsMedidasConfirmadas(opts.presupuestoId, now);
  if (ots.error) return { ...empty, ...saved, error: ots.error, medicion: data ? mapMedicion(data) : null };

  return { ...saved, medicion: data ? mapMedicion(data) : null };
}

async function presupuestoTieneSena(presupuestoId: string): Promise<{
  tieneSena: boolean;
  ventaId: string | null;
  ventaEstado: VentaEstado | null;
  error: Error | null;
}> {
  const venta = await supabase
    .from("ventas")
    .select("id,estado")
    .eq("presupuesto_id", presupuestoId)
    .maybeSingle();
  if (venta.error) {
    return { tieneSena: false, ventaId: null, ventaEstado: null, error: new Error(venta.error.message) };
  }
  if (!venta.data?.id) {
    return { tieneSena: false, ventaId: null, ventaEstado: null, error: null };
  }
  const pagos = await supabase
    .from("ventas_pagos")
    .select("id", { count: "exact", head: true })
    .eq("venta_id", venta.data.id);
  if (pagos.error) {
    return {
      tieneSena: false,
      ventaId: venta.data.id,
      ventaEstado: venta.data.estado as VentaEstado,
      error: new Error(pagos.error.message),
    };
  }
  return {
    tieneSena: (pagos.count ?? 0) > 0,
    ventaId: venta.data.id,
    ventaEstado: venta.data.estado as VentaEstado,
    error: null,
  };
}

function direccionDesdePayload(payload: unknown): string {
  if (!isPresupuestoPayloadV1(payload)) return "—";
  const p = hydratePresupuestoPayloadV1(payload);
  const ot = p.ordenes?.[0];
  const dir =
    ot?.obraFormattedAddress?.trim() ||
    ot?.direccionObra?.trim() ||
    ot?.referenciaObra?.trim() ||
    "";
  return dir || "—";
}

export type MedicionColaItem = {
  presupuestoId: string;
  numero: string;
  cliente: string;
  presupuestoStatus: PresupuestoEstado;
  medicion: PresupuestoMedicionRow;
  tieneSena: boolean;
  ventaId: string | null;
  ventaEstado: VentaEstado | null;
  direccionObra: string;
  puedeEnviar: PuedeEnviarAProduccionResultado;
  bloqueoEnvio: string | null;
  otsPendientesDeCorte: number;
  yaEnProduccion: boolean;
};

export async function listarColaMedicion(): Promise<{
  data: MedicionColaItem[];
  error: Error | null;
}> {
  const medRes = await supabase
    .from("presupuesto_mediciones")
    .select("*")
    .in("estado", ["listo_para_medir", "medido", "no_requiere"])
    .order("fecha_programada", { ascending: true, nullsFirst: false });
  if (medRes.error) return { data: [], error: new Error(medRes.error.message) };
  const mediciones = (medRes.data ?? []).map(mapMedicion);
  if (mediciones.length === 0) return { data: [], error: null };

  const presIds = mediciones.map((m) => m.presupuesto_id);
  const [presRes, ventasRes] = await Promise.all([
    supabase
      .from("presupuestos")
      .select("id,numero,cliente,status,payload")
      .in("id", presIds),
    supabase.from("ventas").select("id,presupuesto_id,estado").in("presupuesto_id", presIds),
  ]);
  if (presRes.error) return { data: [], error: new Error(presRes.error.message) };
  if (ventasRes.error) return { data: [], error: new Error(ventasRes.error.message) };

  const presById = new Map((presRes.data ?? []).map((p) => [p.id, p]));
  const ventaByPres = new Map(
    (ventasRes.data ?? []).map((v) => [v.presupuesto_id, v] as const),
  );
  const ventaIds = [...new Set((ventasRes.data ?? []).map((v) => v.id))];

  const pagosCount = new Map<string, number>();
  const otsByVenta = new Map<string, Array<{ etapa: string; estado: string }>>();
  if (ventaIds.length > 0) {
    const [pagosRes, otsRes] = await Promise.all([
      supabase.from("ventas_pagos").select("venta_id").in("venta_id", ventaIds),
      supabase
        .from("ordenes_trabajo")
        .select("venta_id,etapa,estado")
        .in("venta_id", ventaIds)
        .neq("estado", "cancelled"),
    ]);
    if (pagosRes.error) return { data: [], error: new Error(pagosRes.error.message) };
    if (otsRes.error) return { data: [], error: new Error(otsRes.error.message) };
    for (const p of pagosRes.data ?? []) {
      pagosCount.set(p.venta_id, (pagosCount.get(p.venta_id) ?? 0) + 1);
    }
    for (const ot of otsRes.data ?? []) {
      if (!ot.venta_id) continue;
      const list = otsByVenta.get(ot.venta_id) ?? [];
      list.push({ etapa: String(ot.etapa), estado: String(ot.estado) });
      otsByVenta.set(ot.venta_id, list);
    }
  }

  const items: MedicionColaItem[] = [];
  for (const medicion of mediciones) {
    const pres = presById.get(medicion.presupuesto_id);
    if (!pres) continue;
    if (pres.status === "rechazado") continue;
    const venta = ventaByPres.get(pres.id) ?? null;
    const tieneSena = venta ? (pagosCount.get(venta.id) ?? 0) > 0 : false;
    const ots = venta ? (otsByVenta.get(venta.id) ?? []) : [];
    const otsPendientesDeCorte = ots.filter(
      (ot) => ot.etapa === "medicion" && ot.estado !== "done",
    ).length;
    const yaEnProduccion =
      ots.length > 0 &&
      ots.every((ot) => ot.etapa !== "medicion" || ot.estado === "done");
    const puedeEnviar = puedeEnviarAProduccion({
      presupuestoAprobado: pres.status === "aprobado",
      tieneSena,
      medicionEstado: medicion.estado,
    });
    items.push({
      presupuestoId: pres.id,
      numero: pres.numero,
      cliente: pres.cliente,
      presupuestoStatus: pres.status as PresupuestoEstado,
      medicion,
      tieneSena,
      ventaId: venta?.id ?? null,
      ventaEstado: (venta?.estado as VentaEstado | undefined) ?? null,
      direccionObra: direccionDesdePayload(pres.payload as Json),
      puedeEnviar,
      bloqueoEnvio: motivoBloqueoEnvio(puedeEnviar),
      otsPendientesDeCorte,
      yaEnProduccion,
    });
  }

  return { data: items, error: null };
}

export async function evaluarEnvioAProduccion(presupuestoId: string): Promise<{
  data: PuedeEnviarAProduccionResultado | null;
  error: Error | null;
}> {
  const [pres, med, sena] = await Promise.all([
    supabase.from("presupuestos").select("status").eq("id", presupuestoId).maybeSingle(),
    getOrCreateMedicion(presupuestoId),
    presupuestoTieneSena(presupuestoId),
  ]);
  if (pres.error) return { data: null, error: new Error(pres.error.message) };
  if (!pres.data) return { data: null, error: new Error("Presupuesto no encontrado.") };
  if (med.error) return { data: null, error: med.error };
  if (sena.error) return { data: null, error: sena.error };
  if (!med.data) return { data: null, error: new Error("No hay medición.") };
  return {
    data: puedeEnviarAProduccion({
      presupuestoAprobado: pres.data.status === "aprobado",
      tieneSena: sena.tieneSena,
      medicionEstado: med.data.estado,
    }),
    error: null,
  };
}
