export const WORKSPACE_TABS = [
  "dashboard",
  "ventas",
  "clientes",
  "articulos",
  "administracion",
  "medicion",
  "produccion",
  "cantera",
  "stock",
  "proveedores",
  "comercio_exterior",
  "finanzas",
  "equipo",
  "reportes",
  "configuracion",
] as const;

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

/** Filtros de OT tipo Cero, bajo Órdenes de Trabajo (`?ot=`). Medición no es OT todavía. */
export const PRODUCCION_OT_FILTROS = [
  "general",
  "corte",
  "produccion",
  "logistica",
  "entregadas",
  "venta_retenida",
] as const;

export type ProduccionOtFiltro = (typeof PRODUCCION_OT_FILTROS)[number];

export const PRODUCCION_OT_LABELS: Record<ProduccionOtFiltro, string> = {
  general: "General",
  venta_retenida: "Venta Retenida",
  corte: "Corte",
  produccion: "Producción",
  logistica: "Instalaciones",
  entregadas: "Entregadas",
};

export function produccionOtDesdeParam(v: string | null): ProduccionOtFiltro {
  return v && (PRODUCCION_OT_FILTROS as readonly string[]).includes(v)
    ? (v as ProduccionOtFiltro)
    : "general";
}

/** Secciones del módulo Equipo (`?eq=`). */
export const EQUIPO_SECCIONES = [
  "empleados",
  "sueldos",
  "adelantos",
  "incentivos",
  "prestadores",
] as const;

export type EquipoSeccion = (typeof EQUIPO_SECCIONES)[number];

export const EQUIPO_SECCION_LABELS: Record<EquipoSeccion, string> = {
  empleados: "Empleados",
  sueldos: "Sueldos",
  adelantos: "Adelantos",
  incentivos: "Incentivos",
  prestadores: "No empleados",
};

export function equipoSeccionDesdeParam(v: string | null): EquipoSeccion {
  return v && (EQUIPO_SECCIONES as readonly string[]).includes(v)
    ? (v as EquipoSeccion)
    : "empleados";
}

/** Secciones de Finanzas (`?fn=`). */
export const FINANZAS_SECCIONES = [
  "resumen",
  "movimientos",
  "proveedores_cc",
  "disponibilidad",
  "comisiones",
  "flujo_caja",
  "gastos_fijos",
] as const;

export type FinanzasSeccion = (typeof FINANZAS_SECCIONES)[number];

/** Tabs visibles en el header de Finanzas (sin gastos fijos). */
export const FINANZAS_TABS_HEADER = [
  "resumen",
  "movimientos",
  "proveedores_cc",
  "disponibilidad",
  "comisiones",
  "flujo_caja",
] as const satisfies readonly FinanzasSeccion[];

export const FINANZAS_SECCION_LABELS: Record<FinanzasSeccion, string> = {
  resumen: "Resumen",
  movimientos: "Movimientos",
  proveedores_cc: "Proveedores",
  disponibilidad: "Disponibilidad",
  comisiones: "Comisiones",
  flujo_caja: "Flujo de caja",
  gastos_fijos: "Gastos fijos",
};

export function finanzasSeccionDesdeParam(v: string | null): FinanzasSeccion {
  if (v === "libro") return "resumen";
  return v && (FINANZAS_SECCIONES as readonly string[]).includes(v)
    ? (v as FinanzasSeccion)
    : "resumen";
}

/** Sub-tabs de Stock (`?st=`). */
export const STOCK_TABS = [
  "placas",
  "productos",
  "bloqueados",
  "bachas",
  "listas",
  "trabajos",
] as const;

export type StockTab = (typeof STOCK_TABS)[number];

export function stockTabDesdeParam(v: string | null): StockTab {
  return v && (STOCK_TABS as readonly string[]).includes(v)
    ? (v as StockTab)
    : "placas";
}
