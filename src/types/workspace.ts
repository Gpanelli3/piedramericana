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

/** Filtros de OT tipo Cero, bajo Producción (`?ot=`). */
export const PRODUCCION_OT_FILTROS = [
  "general",
  "venta_retenida",
  "produccion",
  "logistica",
  "entregadas",
] as const;

export type ProduccionOtFiltro = (typeof PRODUCCION_OT_FILTROS)[number];

export const PRODUCCION_OT_LABELS: Record<ProduccionOtFiltro, string> = {
  general: "General",
  venta_retenida: "Venta retenida",
  produccion: "Producción",
  logistica: "Logística",
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
export const FINANZAS_SECCIONES = ["libro", "gastos_fijos"] as const;

export type FinanzasSeccion = (typeof FINANZAS_SECCIONES)[number];

export const FINANZAS_SECCION_LABELS: Record<FinanzasSeccion, string> = {
  libro: "Libro",
  gastos_fijos: "Gastos fijos",
};

export function finanzasSeccionDesdeParam(v: string | null): FinanzasSeccion {
  return v && (FINANZAS_SECCIONES as readonly string[]).includes(v)
    ? (v as FinanzasSeccion)
    : "libro";
}
