import { supabase } from "@/lib/supabase";
import {
  agruparPorVenta,
  enrichOts,
  marcarOtEntregada,
  type OtProduccionItem,
  type VentaGrupoOt,
} from "@/lib/produccion-api";
import { listarColaMedicion, type MedicionColaItem } from "@/lib/medicion-api";
import {
  claveDia,
  compararEventosDelDia,
  horaHastaPorDefecto,
  motivoNoTildarEntrega,
  validarHorario,
} from "@/lib/planificacion-reglas";
import type {
  Database,
  PlanificacionEventoTipo,
  TipoEntregaOt,
} from "@/types/database";

type EventoRow = Database["public"]["Tables"]["planificacion_eventos"]["Row"];
type OrdenTrabajoRow = Database["public"]["Tables"]["ordenes_trabajo"]["Row"];

export type EmpleadoAsignable = { id: string; nombre: string; puesto: string | null };

export type PlanEvento = EventoRow & {
  empleados: EmpleadoAsignable[];
  /** Solo entregas: la OT con los datos de la venta y la obra. */
  ot: OtProduccionItem | null;
  /** Solo mediciones: el ítem de la cola de Medición. */
  medicion: MedicionColaItem | null;
};

type Res<T> = { data: T; error: Error | null };

const err = (e: { message: string } | Error) => new Error(e.message);

function nombreEmpleado(e: { nombre: string; apellido: string }): string {
  return `${e.nombre} ${e.apellido}`.trim();
}

// ─── Empleados ──────────────────────────────────────────────

export async function listarEmpleadosAsignables(): Promise<Res<EmpleadoAsignable[]>> {
  const { data, error } = await supabase
    .from("empleados")
    .select("id,nombre,apellido,puesto")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  if (error) return { data: [], error: err(error) };
  return {
    data: (data ?? []).map((e) => ({ id: e.id, nombre: nombreEmpleado(e), puesto: e.puesto })),
    error: null,
  };
}

async function setEmpleadosEvento(eventoId: string, empleadoIds: string[]): Promise<Error | null> {
  const del = await supabase.from("planificacion_evento_empleados").delete().eq("evento_id", eventoId);
  if (del.error) return err(del.error);
  const ids = [...new Set(empleadoIds)];
  if (ids.length === 0) return null;
  const ins = await supabase
    .from("planificacion_evento_empleados")
    .insert(ids.map((empleado_id) => ({ evento_id: eventoId, empleado_id })));
  return ins.error ? err(ins.error) : null;
}

export async function asignarEmpleados(
  eventoId: string,
  empleadoIds: string[],
): Promise<{ error: Error | null }> {
  return { error: await setEmpleadosEvento(eventoId, empleadoIds) };
}

// ─── Lectura ────────────────────────────────────────────────

/** Completa eventos con empleados, OT y medición. */
async function hidratarEventos(rows: EventoRow[]): Promise<Res<PlanEvento[]>> {
  if (rows.length === 0) return { data: [], error: null };
  const ids = rows.map((r) => r.id);
  const otIds = [...new Set(rows.map((r) => r.ot_id).filter((x): x is string => Boolean(x)))];
  const tieneMediciones = rows.some((r) => r.tipo === "medicion");

  // Las OTs se completan apenas llegan, sin esperar a la cola de mediciones (son cadenas independientes).
  const otsEnriquecidas: Promise<Res<OtProduccionItem[]>> =
    otIds.length > 0
      ? (async () => {
          const r = await supabase.from("ordenes_trabajo").select("*").in("id", otIds);
          if (r.error) return { data: [], error: err(r.error) };
          return enrichOts((r.data ?? []) as OrdenTrabajoRow[]);
        })()
      : Promise.resolve({ data: [], error: null });

  const [asigRes, enriched, medRes] = await Promise.all([
    supabase
      .from("planificacion_evento_empleados")
      .select("evento_id, empleados(id,nombre,apellido,puesto)")
      .in("evento_id", ids),
    otsEnriquecidas,
    tieneMediciones ? listarColaMedicion() : Promise.resolve({ data: [] as MedicionColaItem[], error: null }),
  ]);
  if (asigRes.error) return { data: [], error: err(asigRes.error) };
  if (enriched.error) return { data: [], error: enriched.error };
  if (medRes.error) return { data: [], error: medRes.error };

  const empleadosPorEvento = new Map<string, EmpleadoAsignable[]>();
  for (const a of (asigRes.data ?? []) as unknown as Array<{
    evento_id: string;
    empleados: { id: string; nombre: string; apellido: string; puesto: string | null } | null;
  }>) {
    if (!a.empleados) continue;
    const list = empleadosPorEvento.get(a.evento_id) ?? [];
    list.push({ id: a.empleados.id, nombre: nombreEmpleado(a.empleados), puesto: a.empleados.puesto });
    empleadosPorEvento.set(a.evento_id, list);
  }

  const otPorId = new Map(enriched.data.map((o) => [o.orden.id, o]));
  const medPorId = new Map(medRes.data.map((m) => [m.medicion.id, m]));

  const data = rows.map<PlanEvento>((r) => ({
    ...r,
    empleados: (empleadosPorEvento.get(r.id) ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    ot: r.ot_id ? otPorId.get(r.ot_id) ?? null : null,
    medicion: r.medicion_id ? medPorId.get(r.medicion_id) ?? null : null,
  }));
  return { data, error: null };
}

/** Eventos agendados entre dos días inclusive (sin los cancelados). */
export async function listarEventos(opts: {
  desde: string;
  hasta: string;
  tipos?: PlanificacionEventoTipo[];
}): Promise<Res<PlanEvento[]>> {
  let q = supabase
    .from("planificacion_eventos")
    .select("*")
    .gte("fecha", opts.desde)
    .lte("fecha", opts.hasta)
    .neq("estado", "cancelado");
  if (opts.tipos && opts.tipos.length > 0) q = q.in("tipo", opts.tipos);
  const { data, error } = await q.order("fecha", { ascending: true });
  if (error) return { data: [], error: err(error) };
  const res = await hidratarEventos((data ?? []) as EventoRow[]);
  if (res.error) return res;
  res.data.sort((a, b) => (a.fecha === b.fecha ? compararEventosDelDia(a, b) : a.fecha.localeCompare(b.fecha)));
  return res;
}

/** Cantidad de eventos pendientes por día en un rango (para la vista Mes y "+N en otros días"). */
export async function contarEventosPorDia(opts: {
  desde: string;
  hasta: string;
  tipos?: PlanificacionEventoTipo[];
}): Promise<Res<Record<string, number>>> {
  let q = supabase
    .from("planificacion_eventos")
    .select("fecha")
    .gte("fecha", opts.desde)
    .lte("fecha", opts.hasta)
    .neq("estado", "cancelado");
  if (opts.tipos && opts.tipos.length > 0) q = q.in("tipo", opts.tipos);
  const { data, error } = await q;
  if (error) return { data: {}, error: err(error) };
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.fecha] = (out[r.fecha] ?? 0) + 1;
  return { data: out, error: null };
}

/** Entregas agendadas en días pasados que siguen sin tildar. */
export async function listarEntregasSinMarcar(hoy = claveDia(new Date())): Promise<Res<PlanEvento[]>> {
  const { data, error } = await supabase
    .from("planificacion_eventos")
    .select("*")
    .eq("tipo", "entrega")
    .eq("estado", "pendiente")
    .lt("fecha", hoy)
    .order("fecha", { ascending: true });
  if (error) return { data: [], error: err(error) };
  return hidratarEventos((data ?? []) as EventoRow[]);
}

export type ColaPlanificacion = {
  /** OTs no entregadas y sin entrega agendada, agrupadas por venta. */
  grupos: VentaGrupoOt[];
  /** Mediciones listas para medir y sin visita agendada. */
  mediciones: MedicionColaItem[];
};

/** Lo que queda por agendar (panel "OTs activas"). */
export async function listarCola(): Promise<Res<ColaPlanificacion>> {
  const empty = { grupos: [], mediciones: [] };
  // Promise.resolve dispara el pedido una sola vez: un builder de Supabase pide de nuevo en cada await.
  const pendientesP = Promise.resolve(
    supabase
      .from("planificacion_eventos")
      .select("tipo,ot_id,medicion_id")
      .eq("estado", "pendiente")
      .in("tipo", ["entrega", "medicion"]),
  );

  // OTs sin agendar: se completan en cuanto llegan OTs y eventos, en paralelo con la cola de mediciones.
  const otsSinAgendarP = (async (): Promise<Res<OtProduccionItem[]>> => {
    const [otsRes, pendRes] = await Promise.all([
      supabase
        .from("ordenes_trabajo")
        .select("*")
        .not("venta_id", "is", null)
        .neq("estado", "cancelled")
        .neq("estado", "done")
        .neq("etapa", "medicion")
        .order("creado_en", { ascending: true }),
      pendientesP,
    ]);
    if (otsRes.error) return { data: [], error: err(otsRes.error) };
    if (pendRes.error) return { data: [], error: err(pendRes.error) };
    const otsAgendadas = new Set(
      (pendRes.data ?? []).filter((e) => e.tipo === "entrega" && e.ot_id).map((e) => e.ot_id as string),
    );
    const sinAgendar = ((otsRes.data ?? []) as OrdenTrabajoRow[]).filter((o) => !otsAgendadas.has(o.id));
    return enrichOts(sinAgendar);
  })();

  const [enriched, pendRes, medRes] = await Promise.all([
    otsSinAgendarP,
    pendientesP,
    listarColaMedicion(),
  ]);
  if (enriched.error) return { data: empty, error: enriched.error };
  if (pendRes.error) return { data: empty, error: err(pendRes.error) };
  if (medRes.error) return { data: empty, error: medRes.error };

  const medAgendadas = new Set<string>();
  for (const e of pendRes.data ?? []) {
    if (e.tipo === "medicion" && e.medicion_id) medAgendadas.add(e.medicion_id);
  }

  const mediciones = medRes.data.filter(
    (m) => m.medicion.estado === "listo_para_medir" && !medAgendadas.has(m.medicion.id),
  );
  return { data: { grupos: agruparPorVenta(enriched.data), mediciones }, error: null };
}

// ─── Escritura ──────────────────────────────────────────────

export type HorarioInput = {
  fecha: string;
  /** null = "Sin hora". */
  horaDesde?: string | null;
  /** Si falta y hay inicio, se usa la duración por defecto del tipo. */
  horaHasta?: string | null;
};

function resolverHorario(
  h: HorarioInput,
  tipo: PlanificacionEventoTipo,
): { fecha: string; hora_desde: string | null; hora_hasta: string | null } | Error {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.fecha)) return new Error("Fecha inválida.");
  const v = validarHorario(h.horaDesde, h.horaHasta);
  if (!v.ok) return new Error(v.error);
  const hasta = v.horaDesde && !v.horaHasta ? horaHastaPorDefecto(v.horaDesde, tipo) : v.horaHasta;
  return { fecha: h.fecha, hora_desde: v.horaDesde, hora_hasta: hasta };
}

function errorUnico(e: { message: string; code?: string }, texto: string): Error {
  return e.code === "23505" ? new Error(texto) : err(e);
}

/** Agenda la entrega de una o varias OTs (arrastrar una OT o la cabecera de la venta). */
export async function agendarEntregas(opts: HorarioInput & {
  otIds: string[];
  empleadoIds?: string[];
  usuarioId?: string | null;
}): Promise<Res<string[]>> {
  if (opts.otIds.length === 0) return { data: [], error: new Error("No hay OTs para agendar.") };
  const h = resolverHorario(opts, "entrega");
  if (h instanceof Error) return { data: [], error: h };

  const ots = await supabase.from("ordenes_trabajo").select("id,venta_id,estado").in("id", opts.otIds);
  if (ots.error) return { data: [], error: err(ots.error) };
  const validas = (ots.data ?? []).filter((o) => o.estado !== "done" && o.estado !== "cancelled");
  if (validas.length === 0) return { data: [], error: new Error("Esas OTs ya están entregadas o canceladas.") };

  const ins = await supabase
    .from("planificacion_eventos")
    .insert(
      validas.map((o) => ({
        tipo: "entrega" as const,
        ot_id: o.id,
        venta_id: o.venta_id,
        ...h,
        created_by: opts.usuarioId ?? null,
      })),
    )
    .select("id");
  if (ins.error) return { data: [], error: errorUnico(ins.error, "Alguna de esas OTs ya tiene entrega agendada.") };
  const ids = (ins.data ?? []).map((r) => r.id);
  for (const id of ids) {
    const e = await setEmpleadosEvento(id, opts.empleadoIds ?? []);
    if (e) return { data: ids, error: e };
  }
  return { data: ids, error: null };
}

/** Agenda la visita de medición y deja la fecha también en la medición. */
export async function agendarMedicion(opts: HorarioInput & {
  medicionId: string;
  empleadoIds?: string[];
  usuarioId?: string | null;
}): Promise<Res<string | null>> {
  const h = resolverHorario(opts, "medicion");
  if (h instanceof Error) return { data: null, error: h };

  const med = await supabase
    .from("presupuesto_mediciones")
    .select("id,presupuesto_id,estado")
    .eq("id", opts.medicionId)
    .maybeSingle();
  if (med.error) return { data: null, error: err(med.error) };
  if (!med.data) return { data: null, error: new Error("Medición no encontrada.") };
  if (med.data.estado === "medido" || med.data.estado === "no_requiere") {
    return { data: null, error: new Error("Esa obra ya no necesita medición.") };
  }
  const venta = await supabase
    .from("ventas")
    .select("id")
    .eq("presupuesto_id", med.data.presupuesto_id)
    .maybeSingle();

  const ins = await supabase
    .from("planificacion_eventos")
    .insert({
      tipo: "medicion",
      medicion_id: opts.medicionId,
      venta_id: venta.data?.id ?? null,
      ...h,
      created_by: opts.usuarioId ?? null,
    })
    .select("id")
    .single();
  if (ins.error) return { data: null, error: errorUnico(ins.error, "Esa medición ya está agendada.") };

  const e = await setEmpleadosEvento(ins.data.id, opts.empleadoIds ?? []);
  if (e) return { data: ins.data.id, error: e };
  const sync = await sincronizarFechaMedicion(opts.medicionId, h.fecha);
  return { data: ins.data.id, error: sync };
}

async function sincronizarFechaMedicion(medicionId: string, fecha: string | null): Promise<Error | null> {
  const up = await supabase
    .from("presupuesto_mediciones")
    .update({ fecha_programada: fecha, updated_at: new Date().toISOString() })
    .eq("id", medicionId);
  return up.error ? err(up.error) : null;
}

export async function crearTarea(opts: HorarioInput & {
  titulo: string;
  direccion?: string | null;
  notas?: string | null;
  ventaId?: string | null;
  empleadoIds?: string[];
  usuarioId?: string | null;
}): Promise<Res<string | null>> {
  const titulo = opts.titulo.trim();
  if (!titulo) return { data: null, error: new Error("Poné un título a la tarea.") };
  const h = resolverHorario(opts, "tarea");
  if (h instanceof Error) return { data: null, error: h };
  const ins = await supabase
    .from("planificacion_eventos")
    .insert({
      tipo: "tarea",
      titulo,
      direccion: opts.direccion?.trim() || null,
      notas: opts.notas?.trim() || null,
      venta_id: opts.ventaId ?? null,
      ...h,
      created_by: opts.usuarioId ?? null,
    })
    .select("id")
    .single();
  if (ins.error) return { data: null, error: err(ins.error) };
  const e = await setEmpleadosEvento(ins.data.id, opts.empleadoIds ?? []);
  return { data: ins.data.id, error: e };
}

async function getEvento(eventoId: string): Promise<Res<EventoRow | null>> {
  const { data, error } = await supabase
    .from("planificacion_eventos")
    .select("*")
    .eq("id", eventoId)
    .maybeSingle();
  if (error) return { data: null, error: err(error) };
  if (!data) return { data: null, error: new Error("Evento no encontrado.") };
  return { data: data as EventoRow, error: null };
}

/** Mueve un evento pendiente a otro día/horario. Sin `horaHasta`, conserva la duración. */
export async function moverEvento(opts: HorarioInput & { eventoId: string }): Promise<{ error: Error | null }> {
  const cur = await getEvento(opts.eventoId);
  if (cur.error || !cur.data) return { error: cur.error };
  if (cur.data.estado !== "pendiente") return { error: new Error("Solo se pueden mover eventos pendientes.") };
  const tipo = cur.data.tipo as PlanificacionEventoTipo;

  let horaHasta = opts.horaHasta;
  if (opts.horaDesde && horaHasta === undefined) {
    horaHasta = conservarDuracion(cur.data.hora_desde, cur.data.hora_hasta, opts.horaDesde);
  }
  const h = resolverHorario({ ...opts, horaHasta }, tipo);
  if (h instanceof Error) return { error: h };

  const up = await supabase
    .from("planificacion_eventos")
    .update({ ...h, updated_at: new Date().toISOString() })
    .eq("id", opts.eventoId);
  if (up.error) return { error: err(up.error) };
  if (tipo === "medicion" && cur.data.medicion_id) {
    return { error: await sincronizarFechaMedicion(cur.data.medicion_id, h.fecha) };
  }
  return { error: null };
}

function conservarDuracion(
  desdeAnterior: string | null,
  hastaAnterior: string | null,
  nuevoDesde: string,
): string | null | undefined {
  const v = validarHorario(desdeAnterior, hastaAnterior);
  const nv = validarHorario(nuevoDesde, null);
  if (!v.ok || !v.horaDesde || !v.horaHasta || !nv.ok || !nv.horaDesde) return undefined;
  const [dh, dm] = v.horaDesde.split(":").map(Number);
  const [hh, hm] = v.horaHasta.split(":").map(Number);
  const [nh, nm] = nv.horaDesde.split(":").map(Number);
  const fin = nh! * 60 + nm! + (hh! * 60 + hm! - (dh! * 60 + dm!));
  if (fin > 23 * 60 + 59) return "23:59";
  return `${String(Math.floor(fin / 60)).padStart(2, "0")}:${String(fin % 60).padStart(2, "0")}`;
}

export async function editarEvento(opts: {
  eventoId: string;
  titulo?: string;
  direccion?: string | null;
  notas?: string | null;
  empleadoIds?: string[];
}): Promise<{ error: Error | null }> {
  const cur = await getEvento(opts.eventoId);
  if (cur.error || !cur.data) return { error: cur.error };
  const patch: Database["public"]["Tables"]["planificacion_eventos"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  if (opts.titulo !== undefined) {
    const t = opts.titulo.trim();
    if (cur.data.tipo === "tarea" && !t) return { error: new Error("Poné un título a la tarea.") };
    patch.titulo = t || null;
  }
  if (opts.direccion !== undefined) patch.direccion = opts.direccion?.trim() || null;
  if (opts.notas !== undefined) patch.notas = opts.notas?.trim() || null;
  const up = await supabase.from("planificacion_eventos").update(patch).eq("id", opts.eventoId);
  if (up.error) return { error: err(up.error) };
  if (opts.empleadoIds) return { error: await setEmpleadosEvento(opts.eventoId, opts.empleadoIds) };
  return { error: null };
}

/** Saca un evento de la agenda (la OT o la medición vuelve a la cola). */
export async function desagendarEvento(eventoId: string): Promise<{ error: Error | null }> {
  const cur = await getEvento(eventoId);
  if (cur.error || !cur.data) return { error: cur.error };
  if (cur.data.estado !== "pendiente") return { error: new Error("Solo se pueden desagendar eventos pendientes.") };
  const up = await supabase
    .from("planificacion_eventos")
    .update({ estado: "cancelado", updated_at: new Date().toISOString() })
    .eq("id", eventoId);
  if (up.error) return { error: err(up.error) };
  if (cur.data.tipo === "medicion" && cur.data.medicion_id) {
    return { error: await sincronizarFechaMedicion(cur.data.medicion_id, null) };
  }
  return { error: null };
}

/**
 * Tilde de la tarjeta.
 * - Entrega: solo con la OT en despacho; la marca entregada (y la venta si era la última).
 * - Tarea: queda hecha.
 * - Medición: se cierra confirmando las medidas en Medición.
 */
export async function marcarEventoHecho(opts: {
  eventoId: string;
  usuarioId?: string | null;
}): Promise<{ error: Error | null }> {
  const cur = await getEvento(opts.eventoId);
  if (cur.error || !cur.data) return { error: cur.error };
  const ev = cur.data;
  if (ev.estado !== "pendiente") return { error: new Error("Ese evento ya no está pendiente.") };

  if (ev.tipo === "medicion") {
    return { error: new Error("La medición se marca hecha al confirmar las medidas.") };
  }

  if (ev.tipo === "entrega") {
    if (!ev.ot_id) return { error: new Error("La entrega no tiene OT.") };
    const ot = await supabase
      .from("ordenes_trabajo")
      .select("estado,etapa,bloqueada,pausada")
      .eq("id", ev.ot_id)
      .maybeSingle();
    if (ot.error) return { error: err(ot.error) };
    if (!ot.data) return { error: new Error("OT no encontrada.") };
    const motivo = motivoNoTildarEntrega(ot.data);
    if (motivo) return { error: new Error(motivo) };
    // Marca la OT y cierra el evento pendiente.
    return marcarOtEntregada(ev.ot_id, { usuarioId: opts.usuarioId });
  }

  const now = new Date().toISOString();
  const up = await supabase
    .from("planificacion_eventos")
    .update({ estado: "hecho", hecho_en: now, hecho_por: opts.usuarioId ?? null, updated_at: now })
    .eq("id", opts.eventoId);
  return { error: up.error ? err(up.error) : null };
}

/** Vuelve a dejar pendiente una tarea tildada por error. */
export async function reabrirTarea(eventoId: string): Promise<{ error: Error | null }> {
  const cur = await getEvento(eventoId);
  if (cur.error || !cur.data) return { error: cur.error };
  if (cur.data.tipo !== "tarea") {
    return { error: new Error("Solo las tareas se pueden reabrir desde Planificación.") };
  }
  const up = await supabase
    .from("planificacion_eventos")
    .update({ estado: "pendiente", hecho_en: null, hecho_por: null, updated_at: new Date().toISOString() })
    .eq("id", eventoId);
  return { error: up.error ? err(up.error) : null };
}

export async function setTipoEntregaOt(
  otId: string,
  tipo: TipoEntregaOt,
): Promise<{ error: Error | null }> {
  const up = await supabase
    .from("ordenes_trabajo")
    .update({ tipo_entrega: tipo, actualizado_en: new Date().toISOString() })
    .eq("id", otId);
  return { error: up.error ? err(up.error) : null };
}
