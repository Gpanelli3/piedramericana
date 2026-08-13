import type { JobStatus } from "@/types/database";

/** Etiqueta legible de etapa OT (kanban) o estado terminal. */
export function etiquetaEtapaOt(etapa: string | null, estadoOt: JobStatus | null): string {
  if (estadoOt === "done") return "Finalizada";
  if (estadoOt === "cancelled") return "Cancelada";
  switch (etapa) {
    case "medicion":
      return "Medición";
    case "corte":
      return "Corte";
    case "produccion":
      return "Producción";
    case "despacho":
      return "Despacho";
    default:
      return "Sin OT";
  }
}
