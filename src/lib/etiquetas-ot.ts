import type { JobStatus } from "@/types/database";
import type { ProduccionOtFiltro } from "@/types/workspace";

/** Color de chip alineado a las tarjetas madre de Órdenes de Trabajo. */
export const OT_TAB_CHIP: Record<Exclude<ProduccionOtFiltro, "general">, string> = {
  venta_retenida:
    "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
  corte:
    "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200",
  produccion:
    "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
  logistica:
    "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200",
  entregadas:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

const CHIP_SIN_ETAPA = "border-border bg-muted text-muted-foreground";

/** Clase de pill según etapa/estado, usando el color de la tarjeta madre. */
export function chipClaseEtapaOt(
  etapa: string | null | undefined,
  estadoOt: JobStatus | null | undefined,
): string {
  if (estadoOt === "done") return OT_TAB_CHIP.entregadas;
  if (estadoOt === "cancelled") return OT_TAB_CHIP.venta_retenida;
  if (etapa === "corte") return OT_TAB_CHIP.corte;
  if (etapa === "produccion") return OT_TAB_CHIP.produccion;
  if (etapa === "despacho") return OT_TAB_CHIP.logistica;
  return CHIP_SIN_ETAPA;
}

/**
 * Subestados: Medición (módulo propio, todavía no es OT) → Corte → Producción → Logística.
 */
export const ETAPA_OT_LABELS = {
  medicion: "Medición",
  corte: "Corte",
  produccion: "Producción",
  despacho: "Logística",
} as const;

export type EtapaOtLabelKey = keyof typeof ETAPA_OT_LABELS;

export function etiquetaEtapaKanban(etapa: string | null | undefined): string {
  if (etapa && etapa in ETAPA_OT_LABELS) {
    return ETAPA_OT_LABELS[etapa as EtapaOtLabelKey];
  }
  return etapa?.trim() || "—";
}

/** Etiqueta legible de etapa OT (kanban) o estado terminal. */
export function etiquetaEtapaOt(etapa: string | null, estadoOt: JobStatus | null): string {
  if (estadoOt === "done") return "Entregada";
  if (estadoOt === "cancelled") return "Cancelada";
  if (!etapa) return "Sin OT";
  if (etapa in ETAPA_OT_LABELS) return ETAPA_OT_LABELS[etapa as EtapaOtLabelKey];
  return "Sin OT";
}

/** Pestaña de OT donde cae la etapa (Medición no es pestaña de OT). */
export function etiquetaTabDestino(etapa: string | null | undefined): string {
  return etiquetaEtapaKanban(etapa);
}

export function etiquetaAvanceEtapa(etapaDestino: string): string {
  return `A ${etiquetaTabDestino(etapaDestino)}`;
}
