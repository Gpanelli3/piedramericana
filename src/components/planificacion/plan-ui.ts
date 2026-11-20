import type { DragEvent } from "react";
import { minutosDesdeHora } from "@/lib/planificacion-reglas";
import type { TipoEntregaOt } from "@/types/database";

/** Franja visible de la grilla horaria. */
export const HORA_INICIO = 7;
export const HORA_FIN = 20;
export const PX_POR_HORA = 64;
/** Al soltar, la hora se redondea a este paso. */
export const PASO_MIN = 30;

export const COLOR_TIPO_ENTREGA: Record<TipoEntregaOt, { punto: string; borde: string; chip: string }> = {
  retira: {
    punto: "bg-slate-500",
    borde: "border-l-slate-500",
    chip: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  },
  logistica: {
    punto: "bg-blue-900 dark:bg-blue-400",
    borde: "border-l-blue-900 dark:border-l-blue-400",
    chip: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  },
  colocacion: {
    punto: "bg-orange-600",
    borde: "border-l-orange-600",
    chip: "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
  },
};

export const COLOR_MEDICION = {
  borde: "border-l-teal-600",
  chip: "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200",
};

export const COLOR_TAREA = {
  borde: "border-l-emerald-600",
  chip: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

// ─── Arrastrar y soltar ─────────────────────────────────────

export type PlanDragPayload =
  | { kind: "ots"; otIds: string[] }
  | { kind: "medicion"; medicionId: string }
  /** `desdeEmpleadoId`: columna de origen en la vista Equipos (null = sin asignar). */
  | { kind: "evento"; eventoId: string; desdeEmpleadoId?: string | null };

const MIME = "application/x-plan";

export function setDragPayload(e: DragEvent, payload: PlanDragPayload) {
  e.dataTransfer.setData(MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "move";
}

export function getDragPayload(e: DragEvent): PlanDragPayload | null {
  const raw = e.dataTransfer.getData(MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlanDragPayload;
  } catch {
    return null;
  }
}

export function esDragPlan(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(MIME);
}

/** Posición vertical dentro de la grilla → `HH:MM` redondeado al paso. */
export function horaDesdeOffset(offsetY: number): string {
  const min = HORA_INICIO * 60 + (offsetY / PX_POR_HORA) * 60;
  const snapped = Math.round(min / PASO_MIN) * PASO_MIN;
  const tope = Math.min(Math.max(snapped, HORA_INICIO * 60), HORA_FIN * 60 - PASO_MIN);
  return `${String(Math.floor(tope / 60)).padStart(2, "0")}:${String(tope % 60).padStart(2, "0")}`;
}

/** `top`/`height` en px para un evento con horario. */
export function posicionEvento(horaDesde: string | null, horaHasta: string | null) {
  const ini = minutosDesdeHora(horaDesde) ?? HORA_INICIO * 60;
  const fin = minutosDesdeHora(horaHasta) ?? ini + 60;
  const base = HORA_INICIO * 60;
  const top = ((Math.max(ini, base) - base) / 60) * PX_POR_HORA;
  const alto = Math.max(((fin - Math.max(ini, base)) / 60) * PX_POR_HORA, 28);
  return { top, height: alto };
}

/**
 * Columnas para eventos que se pisan: cada grupo de solapados se reparte el ancho.
 * Devuelve, por id, la columna y el total de columnas de su grupo.
 */
export function columnasSolapadas<T extends { id: string; hora_desde: string | null; hora_hasta: string | null }>(
  eventos: T[],
): Map<string, { col: number; cols: number }> {
  const out = new Map<string, { col: number; cols: number }>();
  const conRango = eventos
    .map((e) => {
      const ini = minutosDesdeHora(e.hora_desde) ?? 0;
      const fin = minutosDesdeHora(e.hora_hasta) ?? ini + 60;
      return { id: e.id, ini, fin };
    })
    .sort((a, b) => a.ini - b.ini || a.fin - b.fin);

  let grupo: { id: string; col: number }[] = [];
  let finGrupo = -1;
  let finesCol: number[] = [];

  const cerrar = () => {
    const cols = finesCol.length || 1;
    for (const g of grupo) out.set(g.id, { col: g.col, cols });
    grupo = [];
    finesCol = [];
  };

  for (const ev of conRango) {
    if (ev.ini >= finGrupo && grupo.length > 0) cerrar();
    let col = finesCol.findIndex((f) => f <= ev.ini);
    if (col === -1) {
      col = finesCol.length;
      finesCol.push(ev.fin);
    } else {
      finesCol[col] = ev.fin;
    }
    grupo.push({ id: ev.id, col });
    finGrupo = Math.max(finGrupo, ev.fin);
  }
  if (grupo.length > 0) cerrar();
  return out;
}

export function horaCorta(hora: string | null | undefined): string {
  return hora ? hora.slice(0, 5) : "";
}
