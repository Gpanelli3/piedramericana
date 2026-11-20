import { supabase } from "@/lib/supabase";
import {
  conformidadTrasMedir,
  esMedicionEstado,
  motivoBloqueoEnvio,
  puedeEnviarAProduccion,
  validarImporteRenegociado,
  type MedicionEstado,
  type PuedeEnviarAProduccionResultado,
} from "@/lib/medicion-reglas";
import { registrarEventoPrecio } from "@/lib/presupuesto-eventos-api";
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
  /** El precio cambió al medir y el cliente todavía no dio su conformidad. */
  conformidad_pendiente: boolean;
  conformidad_total_anterior: number | null;
  conformidad_total_nuevo: number | null;
  conformidad_en: string | null;
  conformidad_por: string | null;
  created_at: string;
  updated_at: string;
};

function numeroONulo(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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
  conformidad_pendiente?: boolean | null;
  conformidad_total_anterior?: number | string | null;
  conformidad_total_nuevo?: number | string | null;
  conformidad_en?: string | null;
  conformidad_por?: string | null;
  created_at: string;
  updated_at: string;
}): PresupuestoMedicionRow {
  return {
    ...row,
    estado: esMedicionEstado(row.estado) ? row.estado : "sin_solicitar",
    conformidad_pendiente: row.conformidad_pendiente === true,
    conformidad_total_anterior: numeroONulo(row.conformidad_total_anterior),
    conformidad_total_nuevo: numeroONulo(row.conformidad_total_nuevo),
    conformidad_en: row.conformidad_en ?? null,
    conformidad_por: row.conformidad_por ?? null,
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
  if (
    cur.data.estado !== "listo_para_medir" &&
    cur.data.estado !== "medido" &&
    cur.data.estado !== "sin_solicitar"
  ) {
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
  // Si el precio cambió al medir, falta que el cliente dé su conformidad antes de producir.
  const conformidad = conformidadTrasMedir({
    pendienteActual: cur.data.conformidad_pendiente,
    totalAceptadoPrevio: cur.data.conformidad_total_anterior,
    totalAnterior: saved.totalAnterior,
    totalNuevo: saved.totalNuevo,
  });
  const { data, error } = await supabase
    .from("presupuesto_mediciones")
    .update({
      estado: "medido",
      medido_por: opts.usuarioId ?? cur.data.medido_por,
      medido_en: now,
      notas: notas || null,
      motivo_salto: null,
      conformidad_pendiente: conformidad.pendiente,
      conformidad_total_anterior: conformidad.totalAnterior,
      conformidad_total_nuevo: conformidad.totalNuevo,
      conformidad_en: null,
      conformidad_por: null,
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
  moneda: "ars" | "usd";
  medicion: PresupuestoMedicionRow;
  tieneSena: boolean;
  ventaId: string | null;
  ventaEstado: VentaEstado | null;
  direccionObra: string;
  puedeEnviar: PuedeEnviarAProduccionResultado;
  bloqueoEnvio: string | null;
  otsPendientesDeCorte: number;
  yaEnProduccion: boolean;
  medidoPorNombre: string | null;
  /** Órdenes de la venta, para imprimir el rótulo y abrir el plano. */
  ots: Array<{ id: string; ordenKey: string }>;
};

export async function listarColaMedicion(): Promise<{
  data: MedicionColaItem[];
  error: Error | null;
}> {
  const [medRes, ventasColaRes] = await Promise.all([
    supabase
      .from("presupuesto_mediciones")
      .select("*")
      .in("estado", ["listo_para_medir", "medido"])
      .order("fecha_programada", { ascending: true, nullsFirst: false }),
    supabase.from("ventas").select("presupuesto_id").in("estado", ["en_medicion", "senado"]),
  ]);
  if (medRes.error) return { data: [], error: new Error(medRes.error.message) };
  if (ventasColaRes.error) return { data: [], error: new Error(ventasColaRes.error.message) };

  const extraIds = [
    ...new Set(
      (ventasColaRes.data ?? [])
        .map((v) => v.presupuesto_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const extraMedRes =
    extraIds.length > 0
      ? await supabase
          .from("presupuesto_mediciones")
          .select("*")
          .in("presupuesto_id", extraIds)
          .eq("estado", "sin_solicitar")
      : { data: [] as typeof medRes.data, error: null };
  if (extraMedRes.error) return { data: [], error: new Error(extraMedRes.error.message) };

  const byPres = new Map<string, ReturnType<typeof mapMedicion>>();
  for (const row of [...(medRes.data ?? []), ...(extraMedRes.data ?? [])]) {
    byPres.set(row.presupuesto_id, mapMedicion(row));
  }
  const mediciones = [...byPres.values()];
  if (mediciones.length === 0) return { data: [], error: null };

  const presIds = mediciones.map((m) => m.presupuesto_id);
  const [presRes, ventasRes] = await Promise.all([
    supabase
      .from("presupuestos")
      .select("id,numero,cliente,status,payload,moneda")
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
  const otsByVenta = new Map<
    string,
    Array<{ id: string; ordenKey: string; etapa: string; estado: string }>
  >();
  if (ventaIds.length > 0) {
    const [pagosRes, otsRes] = await Promise.all([
      supabase.from("ventas_pagos").select("venta_id").in("venta_id", ventaIds),
      supabase
        .from("ordenes_trabajo")
        .select("id,orden_key,venta_id,etapa,estado")
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
      list.push({
        id: ot.id,
        ordenKey: ot.orden_key?.trim() ?? "",
        etapa: String(ot.etapa),
        estado: String(ot.estado),
      });
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
    if (medicion.estado === "sin_solicitar" && !tieneSena) continue;
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
      conformidadPendiente: medicion.conformidad_pendiente,
    });
    items.push({
      presupuestoId: pres.id,
      numero: pres.numero,
      cliente: pres.cliente,
      presupuestoStatus: pres.status as PresupuestoEstado,
      moneda: pres.moneda === "usd" ? "usd" : "ars",
      medicion,
      tieneSena,
      ventaId: venta?.id ?? null,
      ventaEstado: (venta?.estado as VentaEstado | undefined) ?? null,
      direccionObra: direccionDesdePayload(pres.payload as Json),
      puedeEnviar,
      bloqueoEnvio: motivoBloqueoEnvio(puedeEnviar),
      otsPendientesDeCorte,
      yaEnProduccion,
      medidoPorNombre: null,
      ots: ots.map((ot) => ({ id: ot.id, ordenKey: ot.ordenKey })),
    });
  }

  const medidorIds = [
    ...new Set(items.map((i) => i.medicion.medido_por).filter((id): id is string => Boolean(id))),
  ];
  if (medidorIds.length > 0) {
    const usuarios = await supabase.from("usuarios").select("id, full_name").in("id", medidorIds);
    if (!usuarios.error) {
      const nombrePorId = new Map<string, string>();
      for (const u of usuarios.data ?? []) {
        const name = typeof u.full_name === "string" ? u.full_name.trim() : "";
        if (u.id && name) nombrePorId.set(u.id, name);
      }
      for (const item of items) {
        const id = item.medicion.medido_por;
        if (id) item.medidoPorNombre = nombrePorId.get(id) ?? null;
      }
    }
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
      conformidadPendiente: med.data.conformidad_pendiente,
    }),
    error: null,
  };
}

/**
 * El cliente no aceptó el importe que resultó de medir: el vendedor registra el importe que
 * acordaron. Cuenta como conformidad y la OT puede pasar a producción. Queda en el historial
 * del presupuesto con el motivo, el importe anterior y quién lo hizo.
 */
export async function renegociarImporteTrasMedicion(opts: {
  presupuestoId: string;
  nuevoTotal: number;
  motivo: string;
  usuarioId?: string | null;
}): Promise<{ error: Error | null }> {
  const med = await getOrCreateMedicion(opts.presupuestoId);
  if (med.error) return { error: med.error };
  if (!med.data?.conformidad_pendiente) {
    return { error: new Error("Esta obra no está esperando la conformidad del cliente.") };
  }

  const pres = await supabase
    .from("presupuestos")
    .select("id,total,moneda,payload")
    .eq("id", opts.presupuestoId)
    .maybeSingle();
  if (pres.error) return { error: new Error(pres.error.message) };
  if (!pres.data) return { error: new Error("Presupuesto no encontrado.") };
  const moneda: "ars" | "usd" = pres.data.moneda === "usd" ? "usd" : "ars";

  // Lo ya cobrado, en la moneda del presupuesto: el nuevo importe no puede ser menor.
  let cobrado = 0;
  const venta = await supabase
    .from("ventas")
    .select("id")
    .eq("presupuesto_id", opts.presupuestoId)
    .maybeSingle();
  if (venta.error) return { error: new Error(venta.error.message) };
  if (venta.data?.id) {
    const pagos = await supabase
      .from("ventas_pagos")
      .select("monto,moneda")
      .eq("venta_id", venta.data.id);
    if (pagos.error) return { error: new Error(pagos.error.message) };
    for (const p of pagos.data ?? []) {
      if (p.moneda !== moneda) continue;
      const m = Number(p.monto);
      if (Number.isFinite(m)) cobrado += m;
    }
  }

  const nuevoTotal = Math.round(opts.nuevoTotal * 100) / 100;
  const invalido = validarImporteRenegociado({ nuevoTotal, cobrado, motivo: opts.motivo });
  if (invalido) return { error: new Error(invalido) };

  const totalAnterior = Number(pres.data.total) || 0;
  const payload = pres.data.payload;
  const nextPayload =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? { ...(payload as Record<string, Json>), totalPresupuesto: nuevoTotal }
      : payload;

  const now = new Date().toISOString();
  const upPres = await supabase
    .from("presupuestos")
    .update({ total: nuevoTotal, payload: nextPayload, updated_at: now })
    .eq("id", opts.presupuestoId);
  if (upPres.error) return { error: new Error(upPres.error.message) };

  await registrarEventoPrecio({
    presupuestoId: opts.presupuestoId,
    tipo: "ajuste",
    monto: nuevoTotal,
    moneda,
    createdBy: opts.usuarioId ?? null,
    meta: {
      motivo: "renegociacion",
      total_anterior: totalAnterior,
      importe_medicion: med.data.conformidad_total_nuevo,
      nota: opts.motivo.trim(),
    },
  });

  const upMed = await supabase
    .from("presupuesto_mediciones")
    .update({
      conformidad_pendiente: false,
      conformidad_total_nuevo: nuevoTotal,
      conformidad_en: now,
      conformidad_por: opts.usuarioId ?? null,
      updated_at: now,
    })
    .eq("id", med.data.id);
  if (upMed.error) return { error: new Error(upMed.error.message) };
  return { error: null };
}

/**
 * El vendedor confirma que el cliente está de acuerdo con el nuevo importe.
 * Queda registrado quién y cuándo; después la OT puede pasar a producción.
 */
export async function confirmarConformidadCliente(opts: {
  presupuestoId: string;
  usuarioId?: string | null;
}): Promise<{ data: PresupuestoMedicionRow | null; error: Error | null }> {
  const cur = await getOrCreateMedicion(opts.presupuestoId);
  if (cur.error) return { data: null, error: cur.error };
  if (!cur.data) return { data: null, error: new Error("No se encontró la medición.") };
  if (!cur.data.conformidad_pendiente) return { data: cur.data, error: null };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("presupuesto_mediciones")
    .update({
      conformidad_pendiente: false,
      conformidad_en: now,
      conformidad_por: opts.usuarioId ?? null,
      updated_at: now,
    })
    .eq("id", cur.data.id)
    .select("*")
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data ? mapMedicion(data) : null, error: null };
}
