import type {
  EtapaOtKanban,
  JobStatus,
  PlanificacionEventoEstado,
  PlanificacionEventoTipo,
  TipoEntregaOt,
} from "@/types/database";

/** Reglas puras del módulo Planificación (sin Supabase, testeables). */

export const TIPOS_ENTREGA: { value: TipoEntregaOt; label: string }[] = [
  { value: "retira", label: "Retira en fábrica" },
  { value: "logistica", label: "Entrega con logística" },
  { value: "colocacion", label: "Entrega con colocación" },
];

export function etiquetaTipoEntrega(t: TipoEntregaOt | string | null | undefined): string {
  return TIPOS_ENTREGA.find((x) => x.value === t)?.label ?? "Retira en fábrica";
}

export function coalesceTipoEntrega(raw: unknown): TipoEntregaOt {
  return raw === "logistica" || raw === "colocacion" ? raw : "retira";
}

/**
 * Tipo de entrega según los servicios cargados en el presupuesto.
 * Colocación gana sobre entrega; sin ninguno, el cliente retira en fábrica.
 */
export function tipoEntregaDesdeServicios(servicios: {
  mEntrega?: boolean | null;
  mColocacion?: boolean | null;
}): TipoEntregaOt {
  if (servicios.mColocacion === true) return "colocacion";
  if (servicios.mEntrega === true) return "logistica";
  return "retira";
}

/** Lee los flags del payload del presupuesto sin depender de su tipo completo. */
export function tipoEntregaDesdePayload(payload: unknown): TipoEntregaOt {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "retira";
  const p = payload as { mEntregaGlobal?: unknown; mColocacionGlobal?: unknown };
  return tipoEntregaDesdeServicios({
    mEntrega: p.mEntregaGlobal === true,
    mColocacion: p.mColocacionGlobal === true,
  });
}

// ─── Fechas y horarios ──────────────────────────────────────

/** `YYYY-MM-DD` en hora local. */
export function claveDia(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Recorta un ISO/fecha a `YYYY-MM-DD`, o null si no es una fecha válida. */
export function diaDesdeIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const day = iso.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** `HH:MM` o `HH:MM:SS` → minutos desde las 00:00. */
export function minutosDesdeHora(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hora.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutos → `HH:MM` (tope 23:59). */
export function horaDesdeMinutos(total: number): string {
  const t = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Duración por defecto de cada tipo de evento, en minutos. */
export const DURACION_DEFECTO_MIN: Record<PlanificacionEventoTipo, number> = {
  entrega: 120,
  medicion: 60,
  tarea: 60,
};

/** Hora de fin por defecto a partir del inicio. */
export function horaHastaPorDefecto(
  horaDesde: string,
  tipo: PlanificacionEventoTipo,
): string | null {
  const ini = minutosDesdeHora(horaDesde);
  if (ini === null) return null;
  return horaDesdeMinutos(ini + DURACION_DEFECTO_MIN[tipo]);
}

export type HorarioValidado =
  | { ok: true; horaDesde: string | null; horaHasta: string | null }
  | { ok: false; error: string };

/** Valida un rango horario. Sin inicio = "Sin hora" (el fin se ignora). */
export function validarHorario(
  horaDesde: string | null | undefined,
  horaHasta: string | null | undefined,
): HorarioValidado {
  const d = (horaDesde ?? "").trim();
  const h = (horaHasta ?? "").trim();
  if (!d) return { ok: true, horaDesde: null, horaHasta: null };
  const ini = minutosDesdeHora(d);
  if (ini === null) return { ok: false, error: "Hora de inicio inválida." };
  if (!h) return { ok: true, horaDesde: horaDesdeMinutos(ini), horaHasta: null };
  const fin = minutosDesdeHora(h);
  if (fin === null) return { ok: false, error: "Hora de fin inválida." };
  if (fin <= ini) return { ok: false, error: "La hora de fin tiene que ser posterior al inicio." };
  return { ok: true, horaDesde: horaDesdeMinutos(ini), horaHasta: horaDesdeMinutos(fin) };
}

// ─── Estado de entregas ─────────────────────────────────────

export type OtParaTildar = {
  estado: JobStatus | string;
  etapa: EtapaOtKanban | string;
  bloqueada: boolean;
  pausada: boolean;
};

/** Motivo por el que no se puede tildar la entrega, o null si se puede. */
export function motivoNoTildarEntrega(ot: OtParaTildar): string | null {
  if (ot.estado === "done") return "La OT ya está entregada.";
  if (ot.estado === "cancelled") return "La OT está cancelada.";
  if (ot.bloqueada) return "La OT está bloqueada.";
  if (ot.pausada) return "La OT está pausada.";
  if (ot.etapa === "medicion") return "La OT todavía no está medida.";
  if (ot.etapa === "corte") return "Sigue en corte.";
  if (ot.etapa === "produccion") return "Sigue en producción.";
  if (ot.etapa !== "despacho") return "La OT no está lista para entregar.";
  return null;
}

export function puedeTildarEntrega(ot: OtParaTildar): boolean {
  return motivoNoTildarEntrega(ot) === null;
}

/** Evento agendado en un día pasado que sigue sin marcar. */
export function esSinMarcar(
  ev: { estado: PlanificacionEventoEstado | string; fecha: string },
  hoy: string,
): boolean {
  return ev.estado === "pendiente" && ev.fecha < hoy;
}

/** Cuenta las entregas sin marcar (lo que muestra el botón rojo del header). */
export function contarEntregasSinMarcar(
  eventos: { tipo: PlanificacionEventoTipo | string; estado: string; fecha: string }[],
  hoy: string,
): number {
  return eventos.filter((e) => e.tipo === "entrega" && esSinMarcar(e, hoy)).length;
}

/**
 * La promesa al cliente quedó vencida: lo agendado cae después de la fecha prometida,
 * o no hay nada agendado y la fecha prometida ya pasó.
 */
export function promesaVencida(opts: {
  fechaPrometida: string | null | undefined;
  fechaAgendada: string | null | undefined;
  hoy: string;
}): boolean {
  const prom = diaDesdeIso(opts.fechaPrometida);
  if (!prom) return false;
  const ag = diaDesdeIso(opts.fechaAgendada);
  if (ag) return ag > prom;
  return prom < opts.hoy;
}

/** Aviso de la tarjeta en la cola: "(terminar) · se entregaba el 9/11". */
export function avisoPromesa(opts: {
  fechaPrometida: string | null | undefined;
  etapa: EtapaOtKanban | string;
  hoy: string;
}): string | null {
  const prom = diaDesdeIso(opts.fechaPrometida);
  if (!prom || prom >= opts.hoy) return null;
  const [, m, d] = prom.split("-");
  const fecha = `${Number(d)}/${Number(m)}`;
  const prefijo = opts.etapa === "despacho" ? "" : "(terminar) · ";
  return `${prefijo}se entregaba el ${fecha}`;
}

/** Orden dentro de un día: primero "Sin hora", después por hora de inicio. */
export function compararEventosDelDia(
  a: { hora_desde: string | null; created_at?: string },
  b: { hora_desde: string | null; created_at?: string },
): number {
  const ma = minutosDesdeHora(a.hora_desde);
  const mb = minutosDesdeHora(b.hora_desde);
  if (ma === null && mb !== null) return -1;
  if (ma !== null && mb === null) return 1;
  if (ma !== null && mb !== null && ma !== mb) return ma - mb;
  return (a.created_at ?? "").localeCompare(b.created_at ?? "");
}
