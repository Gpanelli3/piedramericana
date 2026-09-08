import type { JobStatus } from "@/types/database";

/**
 * Nombres de etapa alineados con las pestañas de Producción:
 * Técnica → Corte → Producción → Logística → Entregada.
 * El valor en DB de logística sigue siendo `despacho`.
 */
export const ETAPA_OT_LABELS = {
  medicion: "Técnica",
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

export function etiquetaAvanceEtapa(etapaDestino: string): string {
  return `A ${etiquetaEtapaKanban(etapaDestino)}`;
}
