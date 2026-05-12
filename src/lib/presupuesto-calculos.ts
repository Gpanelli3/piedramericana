/**
 * Cálculos de líneas de presupuesto (modelo tipo OTflex, v1 mock).
 *
 * Ejemplos:
 * - Mesada 2 × 2 m con 1 % desperdicio, cant. art 1 → m² = 1 × 2 × 2 × 1.01 = 4,04
 * - ML cant. 1, alto 0,5 m → m² = 1 × 0,5 × (1 + desperdicio/100)
 */

import type { ArticuloMock, UnidadArticulo } from "@/data/presupuesto-articulos-mock";
import type { Database } from "@/types/database";

export type ModoIngresoM2 = "dimensiones" | "manual";

export interface LineaItemOTCalcInput {
  articuloId: string;
  modoIngreso: ModoIngresoM2;
  cantidad: string;
  precioUnitario: string;
  altoM: string;
  anchoM: string;
  desperdicioPct: string;
}

/**
 * Valores de línea en UI: `altoCm` guarda **centímetros** en M2 modo dimensiones, y **metros**
 * en artículos ML (único dato de altura). Nombre histórico del campo.
 */
export interface LineaItemOTUiInput {
  articuloId: string;
  modoIngreso: ModoIngresoM2;
  cantidad: string;
  precioUnitario: string;
  altoCm: string;
  anchoCm: string;
  desperdicioPct: string;
}

/** Convierte entradas de interfaz a metros para `computeLineaPresupuesto`. */
export function buildLineaCalcInput(art: ArticuloMock, line: LineaItemOTUiInput): LineaItemOTCalcInput {
  const cmToMStr = (cm: string) => {
    const m = parseDecimalInput(cm) / 100;
    return String(m);
  };
  const base = {
    articuloId: line.articuloId,
    modoIngreso: line.modoIngreso,
    cantidad: line.cantidad,
    precioUnitario: line.precioUnitario,
    desperdicioPct: line.desperdicioPct,
  };

  if (!art.calculaMaterial || (art.medidaEstandarM2 != null && art.medidaEstandarM2 > 0)) {
    return { ...base, altoM: "0", anchoM: "0" };
  }
  if (art.unidad === "ML") {
    return { ...base, altoM: String(parseDecimalInput(line.altoCm)), anchoM: "0" };
  }
  if (art.unidad === "M2" && line.modoIngreso === "manual") {
    return { ...base, altoM: "0", anchoM: "0" };
  }
  if (art.unidad === "M2" && line.modoIngreso === "dimensiones") {
    return { ...base, altoM: cmToMStr(line.altoCm), anchoM: cmToMStr(line.anchoCm) };
  }
  return { ...base, altoM: "0", anchoM: "0" };
}

/** Parse decimal con coma como separador (es-AR). */
export function parseDecimalInput(v: string): number {
  const t = v.trim().replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

export function factorDesperdicio(desperdicioPct: string): number {
  const p = Math.max(0, parseDecimalInput(desperdicioPct));
  return 1 + p / 100;
}

export interface ResultadoLineaPresupuesto {
  m2Linea: number;
  subtotal: number;
}

/**
 * m² que aporta la línea al total del presupuesto (solo si calcula material).
 * subtotal en dinero según reglas mock (precio unitario = $/m² para material M2/ML;
 * $/unidad para ítems que no calculan material).
 */
export function computeLineaPresupuesto(
  art: ArticuloMock,
  line: LineaItemOTCalcInput
): ResultadoLineaPresupuesto {
  const pu = parseDecimalInput(line.precioUnitario);
  const qty = parseDecimalInput(line.cantidad);
  const alto = parseDecimalInput(line.altoM);
  const ancho = parseDecimalInput(line.anchoM);
  const f = factorDesperdicio(line.desperdicioPct);

  if (!art.calculaMaterial) {
    return { m2Linea: 0, subtotal: qty * pu };
  }

  if (art.medidaEstandarM2 != null && art.medidaEstandarM2 > 0) {
    const m2 = qty * art.medidaEstandarM2;
    return { m2Linea: m2, subtotal: m2 * pu };
  }

  if (art.unidad === "M2") {
    if (line.modoIngreso === "manual") {
      const m2 = qty;
      return { m2Linea: m2, subtotal: m2 * pu };
    }
    /** Cantidad vacía = una pieza (1× alto × ancho). "0" explícito sigue siendo 0. */
    const qtyPiezas =
      line.cantidad.trim() === "" ? 1 : qty;
    if (qtyPiezas > 0 && alto > 0 && ancho > 0) {
      const m2 = qtyPiezas * alto * ancho * f;
      return { m2Linea: m2, subtotal: m2 * pu };
    }
    return { m2Linea: 0, subtotal: 0 };
  }

  if (art.unidad === "ML") {
    if (qty > 0 && alto > 0) {
      const m2 = qty * alto * f;
      return { m2Linea: m2, subtotal: m2 * pu };
    }
    return { m2Linea: 0, subtotal: 0 };
  }

  if (art.unidad === "UNI" && art.calculaMaterial) {
    const m2 = qty * (art.medidaEstandarM2 ?? 0);
    return { m2Linea: m2, subtotal: (m2 > 0 ? m2 : qty) * pu };
  }

  return { m2Linea: 0, subtotal: qty * pu };
}

export function dimensionesHabilitadas(art: ArticuloMock): boolean {
  if (!art.calculaMaterial) return false;
  if (art.medidaEstandarM2 != null && art.medidaEstandarM2 > 0) return false;
  return art.unidad === "M2" || art.unidad === "ML";
}

export function altoRequerido(art: ArticuloMock): boolean {
  return art.calculaMaterial && art.unidad === "ML" && !art.medidaEstandarM2;
}

export function anchoRequerido(art: ArticuloMock, modo: ModoIngresoM2): boolean {
  return (
    art.calculaMaterial &&
    art.unidad === "M2" &&
    modo === "dimensiones" &&
    !art.medidaEstandarM2
  );
}

export function permiteModoManualCantidadM2(art: ArticuloMock): boolean {
  return art.calculaMaterial && art.unidad === "M2" && !art.medidaEstandarM2;
}

export function labelUnidad(u: UnidadArticulo): string {
  switch (u) {
    case "M2":
      return "m²";
    case "ML":
      return "ml";
    case "UNI":
      return "u.";
    default:
      return u;
  }
}

/** Peso estimado de piedra (ton equiv en presupuesto), según tipo y kg/m² del maestro. */
export function materialPesoEstimadoDesdeOt(
  m2Linea: number,
  opts: {
    materialKind: Database["public"]["Enums"]["material_kind"];
    pesoPorM2Kg: number | null | undefined;
  },
): { kg: number; ton: number } | null {
  if (m2Linea <= 0) return null;
  if (opts.materialKind === "marmol") return null;
  const p = opts.pesoPorM2Kg;
  if (p == null || !(p > 0)) return null;
  const kg = m2Linea * p;
  return { kg, ton: kg / 1000 };
}
