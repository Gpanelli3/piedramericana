/**
 * Cálculos de líneas de presupuesto (modelo tipo OTflex, v1 mock).
 *
 * Ejemplos:
 * - Mesada 2 × 2 m con 1 % desperdicio, cant. art 1 → m² = 1 × 2 × 2 × 1.01 = 4,04
 * - ML cant. 1, alto 0,5 m → m² = 1 × 0,5 × (1 + desperdicio/100)
 */

import type { ArticuloConPrecio } from "@/types/articulos";
import type { OrdenTrabajoWizard } from "@/components/presupuesto/wizard/types";
import type { Database, UnidadArticuloDb } from "@/types/database";

/**
 * Interfaz mínima que los cálculos necesitan.
 * Interfaz mínima que consumen los cálculos del presupuesto.
 */
export type ArticuloCalculo = {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: UnidadArticuloDb;
  calculaMaterial: boolean;
  medidaEstandarM2?: number | null;
  preferModoManualM2?: boolean;
  precioUnitario?: number;
};

export function articuloConPrecioToMock(a: ArticuloConPrecio): ArticuloCalculo {
  return {
    id: a.id,
    codigo: a.codigo,
    descripcion: a.descripcion,
    unidad: a.unidad,
    calculaMaterial: a.calcula_material,
    medidaEstandarM2: a.medida_estandar_m2 ?? undefined,
    preferModoManualM2: a.prefer_modo_manual,
    precioUnitario: a.precio ?? 0,
  };
}

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

/** Valores de línea en UI: alto y ancho siempre en metros (modelo OtFlex). */
export interface LineaItemOTUiInput {
  articuloId: string;
  modoIngreso: ModoIngresoM2;
  cantidad: string;
  precioUnitario: string;
  altoM: string;
  anchoM: string;
  desperdicioPct: string;
}

/** Convierte entradas de interfaz a metros para `computeLineaPresupuesto`. */
export function buildLineaCalcInput(art: ArticuloCalculo, line: LineaItemOTUiInput): LineaItemOTCalcInput {
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
  if (art.unidad === "M2" && line.modoIngreso === "manual") {
    return { ...base, altoM: "0", anchoM: "0" };
  }
  if (art.unidad === "M2" && line.modoIngreso === "dimensiones") {
    return { ...base, altoM: line.altoM, anchoM: line.anchoM };
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
  mlLinea: number;
  subtotal: number;
}

function resultadoLinea(
  m2Linea: number,
  subtotal: number,
  mlLinea = 0,
): ResultadoLineaPresupuesto {
  return { m2Linea, mlLinea, subtotal };
}

/**
 * m² y ml se acumulan por separado. UNI no suma ni m² ni ml.
 */
export function computeLineaPresupuesto(
  art: ArticuloCalculo,
  line: LineaItemOTCalcInput,
): ResultadoLineaPresupuesto {
  const pu = parseDecimalInput(line.precioUnitario);
  const qty = parseDecimalInput(line.cantidad);
  const alto = parseDecimalInput(line.altoM);
  const ancho = parseDecimalInput(line.anchoM);
  const f = factorDesperdicio(line.desperdicioPct);

  if (art.unidad === "UNI" || !art.calculaMaterial) {
    return resultadoLinea(0, qty * pu);
  }

  if (art.unidad === "ML") {
    const ml = qty * f;
    return resultadoLinea(0, ml * pu, ml);
  }

  if (art.medidaEstandarM2 != null && art.medidaEstandarM2 > 0) {
    const m2 = qty * art.medidaEstandarM2;
    return resultadoLinea(m2, m2 * pu);
  }

  if (art.unidad === "M2") {
    if (line.modoIngreso === "manual") {
      const m2 = qty;
      return resultadoLinea(m2, m2 * pu);
    }
    /** Cantidad vacía = una pieza (1× alto × ancho). "0" explícito sigue siendo 0. */
    const qtyPiezas =
      line.cantidad.trim() === "" ? 1 : qty;
    if (qtyPiezas > 0 && alto > 0 && ancho > 0) {
      const m2 = qtyPiezas * alto * ancho * f;
      return resultadoLinea(m2, m2 * pu);
    }
    return resultadoLinea(0, 0);
  }

  return resultadoLinea(0, qty * pu);
}

export function dimensionesHabilitadas(art: ArticuloCalculo): boolean {
  if (!art.calculaMaterial) return false;
  if (art.medidaEstandarM2 != null && art.medidaEstandarM2 > 0) return false;
  return art.unidad === "M2";
}

export function altoRequerido(art: ArticuloCalculo): boolean {
  return (
    art.calculaMaterial &&
    art.unidad === "M2" &&
    !art.medidaEstandarM2
  );
}

export function anchoRequerido(art: ArticuloCalculo, modo: ModoIngresoM2): boolean {
  return (
    art.calculaMaterial &&
    art.unidad === "M2" &&
    modo === "dimensiones" &&
    !art.medidaEstandarM2
  );
}

export function permiteModoManualCantidadM2(art: ArticuloCalculo): boolean {
  return art.calculaMaterial && art.unidad === "M2" && !art.medidaEstandarM2;
}

export function labelUnidad(u: UnidadArticuloDb): string {
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

/**
 * Formato es-AR para m² / ml.
 * Usa 2–3 decimales con coma (`4,00`), nunca `4,000` que se lee como cuatro mil.
 */
export function formatMetraje(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}

/** Formato es-AR para toneladas estimadas. */
export function formatToneladas(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

/**
 * Si el artículo no está en el catálogo (p. ej. inactivo), igual se cotiza
 * con m² por dimensiones y el precio unitario ya cargado en la línea.
 */
export function articuloCalculoParaLinea(
  artBd: ArticuloConPrecio | undefined,
  line: { articuloId: string },
): ArticuloCalculo {
  if (artBd) return articuloConPrecioToMock(artBd);
  return {
    id: line.articuloId,
    codigo: "",
    descripcion: "Ítem",
    unidad: "M2",
    calculaMaterial: true,
    precioUnitario: 0,
  };
}

export function computePresupuestoTotalM2(
  ordenes: OrdenTrabajoWizard[],
  articulos: ArticuloConPrecio[],
): number {
  let totalM2 = 0;
  for (const ot of ordenes) {
    totalM2 += computeOrdenTotalM2(ot, articulos);
  }
  return totalM2;
}

/** m² de una sola OT del wizard (mesada / ambiente). */
export function computeOrdenTotalM2(
  orden: OrdenTrabajoWizard | undefined | null,
  articulos: ArticuloConPrecio[],
): number {
  if (!orden) return 0;
  let totalM2 = 0;
  for (const line of orden.items ?? []) {
    const art = articuloCalculoParaLinea(
      articulos.find((a) => a.id === line.articuloId),
      line,
    );
    const calc = buildLineaCalcInput(art, line);
    totalM2 += computeLineaPresupuesto(art, calc).m2Linea;
  }
  return totalM2;
}

export type M2Trio = {
  venta: number;
  obra: number;
  dif: number;
};

export function trioM2(venta: number, obra: number): M2Trio {
  return { venta, obra, dif: obra - venta };
}

/** m² cotizado vs obra para una OT (por `orden.key`) o el presupuesto entero si no hay key. */
export function trioM2DeOrden(opts: {
  ordenKey: string | null | undefined;
  ordenesVenta: OrdenTrabajoWizard[];
  ordenesObra: OrdenTrabajoWizard[];
  articulos: ArticuloConPrecio[];
}): M2Trio {
  const key = opts.ordenKey?.trim() || "";
  if (key) {
    return trioM2(
      computeOrdenTotalM2(
        opts.ordenesVenta.find((o) => o.key === key),
        opts.articulos,
      ),
      computeOrdenTotalM2(
        opts.ordenesObra.find((o) => o.key === key),
        opts.articulos,
      ),
    );
  }
  return trioM2(
    computePresupuestoTotalM2(opts.ordenesVenta, opts.articulos),
    computePresupuestoTotalM2(opts.ordenesObra, opts.articulos),
  );
}

export function formatDifMetraje(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatMetraje(n)}`;
}

/** True si hay al menos una OT y todas están marcadas sin MEC. */
export function todasOtsExcluyenMec(ordenes: { excluirMec?: boolean }[]): boolean {
  if (ordenes.length === 0) return false;
  return ordenes.every((o) => Boolean(o.excluirMec));
}

/** Importe MEC del presupuesto. El descuento no lo consume. Si todas las OTs lo excluyen, es 0. */
export function importeMecPresupuesto(opts: {
  mMedicion: boolean;
  mEntrega: boolean;
  mColocacion: boolean;
  totalMec: string | number;
  ordenes: { excluirMec?: boolean }[];
}): number {
  if (todasOtsExcluyenMec(opts.ordenes)) return 0;
  if (!(opts.mMedicion || opts.mEntrega || opts.mColocacion)) return 0;
  const n =
    typeof opts.totalMec === "number" ? opts.totalMec : parseDecimalInput(opts.totalMec);
  return Math.max(0, Number.isFinite(n) ? n : 0);
}

export type ResultadoPresupuestoComercial = {
  subtotalItems: number;
  netoItems: number;
  mec: number;
  total: number;
  m2: number;
};

/**
 * Recalcula m² y $ con los precios unitarios ya cargados.
 * El descuento aplica solo a materiales/ítems, no al MEC.
 */
export function computePresupuestoComercial(opts: {
  ordenes: OrdenTrabajoWizard[];
  articulos: ArticuloConPrecio[];
  descuentoGlobalPct: string;
  mMedicionGlobal: boolean;
  mEntregaGlobal: boolean;
  mColocacionGlobal: boolean;
  totalMecGlobal: string;
}): ResultadoPresupuestoComercial {
  let subtotalItems = 0;
  for (const ot of opts.ordenes) {
    for (const line of ot.items) {
      const art = articuloCalculoParaLinea(
        opts.articulos.find((a) => a.id === line.articuloId),
        line,
      );
      const calc = buildLineaCalcInput(art, line);
      subtotalItems += computeLineaPresupuesto(art, calc).subtotal;
    }
  }
  const dPct = Math.max(0, Math.min(parseDecimalInput(opts.descuentoGlobalPct), 100));
  const netoItems = subtotalItems * (1 - dPct / 100);
  const mec = importeMecPresupuesto({
    mMedicion: opts.mMedicionGlobal,
    mEntrega: opts.mEntregaGlobal,
    mColocacion: opts.mColocacionGlobal,
    totalMec: opts.totalMecGlobal,
    ordenes: opts.ordenes,
  });
  return {
    subtotalItems,
    netoItems,
    mec,
    total: netoItems + mec,
    m2: computePresupuestoTotalM2(opts.ordenes, opts.articulos),
  };
}

export function etiquetaVersionPresupuesto(
  nro: number,
  modo: "vigente" | "historica" = "vigente",
): string {
  if (modo === "historica") {
    return nro <= 1 ? `V${nro} · cotizado original` : `V${nro} · versión anterior`;
  }
  if (nro <= 1) return `V${nro}`;
  return `V${nro} · medidas de obra`;
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
