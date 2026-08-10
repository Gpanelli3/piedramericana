import type { LineaItemOT, OrdenTrabajoWizard } from "@/components/presupuesto/wizard/types";
import { parseDecimalInput } from "@/lib/presupuesto-calculos";

/**
 * Convierte valores históricos guardados en centímetros (>20) a metros.
 * Payloads nuevos ya persisten metros en `altoM` / `anchoM`.
 */
export function normalizeDimensionInputM(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const n = parseDecimalInput(trimmed);
  if (n > 20) return String(n / 100);
  return trimmed;
}

export function normalizeLineaItemFromPayload(raw: unknown): LineaItemOT {
  const line = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const altoRaw = line.altoM ?? line.altoCm ?? "";
  const anchoRaw = line.anchoM ?? line.anchoCm ?? "";

  return {
    key: typeof line.key === "string" ? line.key : crypto.randomUUID(),
    articuloId: typeof line.articuloId === "string" ? line.articuloId : "",
    modoIngreso: line.modoIngreso === "manual" ? "manual" : "dimensiones",
    cantidad: typeof line.cantidad === "string" ? line.cantidad : "",
    precioUnitario: typeof line.precioUnitario === "string" ? line.precioUnitario : "",
    altoM: normalizeDimensionInputM(altoRaw),
    anchoM: normalizeDimensionInputM(anchoRaw),
    desperdicioPct: typeof line.desperdicioPct === "string" ? line.desperdicioPct : "",
  };
}

export function normalizeOrdenesFromPayload(raw: unknown): OrdenTrabajoWizard[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((otRaw) => {
    const ot = (typeof otRaw === "object" && otRaw !== null ? otRaw : {}) as Record<string, unknown>;
    const itemsRaw = Array.isArray(ot.items) ? ot.items : [];
    return {
      key: typeof ot.key === "string" ? ot.key : crypto.randomUUID(),
      titulo: typeof ot.titulo === "string" ? ot.titulo : "",
      fecha: typeof ot.fecha === "string" ? ot.fecha : "",
      tecnicoId: typeof ot.tecnicoId === "string" ? ot.tecnicoId : "",
      fechaMedicion: typeof ot.fechaMedicion === "string" ? ot.fechaMedicion : "",
      fechaEntrega: typeof ot.fechaEntrega === "string" ? ot.fechaEntrega : "",
      materialId: typeof ot.materialId === "string" ? ot.materialId : "",
      chapaSugeridaId: typeof ot.chapaSugeridaId === "string" ? ot.chapaSugeridaId : null,
      chapaSugeridaBulto: typeof ot.chapaSugeridaBulto === "string" ? ot.chapaSugeridaBulto : "",
      chapaSugeridaLabel: typeof ot.chapaSugeridaLabel === "string" ? ot.chapaSugeridaLabel : "",
      tipoColocacion:
        ot.tipoColocacion === "sobre" || ot.tipoColocacion === "ras" || ot.tipoColocacion === "bajo"
          ? ot.tipoColocacion
          : "bajo",
      bachaId: typeof ot.bachaId === "string" ? ot.bachaId : "johnson-ss",
      items: itemsRaw.map(normalizeLineaItemFromPayload),
      mMedicion: ot.mMedicion !== false,
      mEntrega: ot.mEntrega !== false,
      mColocacion: ot.mColocacion !== false,
      totalMec: typeof ot.totalMec === "string" ? ot.totalMec : "1",
      panelExpandido: ot.panelExpandido !== false,
    };
  });
}
