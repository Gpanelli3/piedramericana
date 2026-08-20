export const WORKSPACE_TABS = [
  "dashboard",
  "ventas",
  "clientes",
  "articulos",
  "administracion",
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
  "tecnica",
  "produccion",
  "logistica",
  "entregadas",
] as const;

export type ProduccionOtFiltro = (typeof PRODUCCION_OT_FILTROS)[number];

export const PRODUCCION_OT_LABELS: Record<ProduccionOtFiltro, string> = {
  general: "General",
  venta_retenida: "Venta retenida",
  tecnica: "Técnica",
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
] as const;

export type EquipoSeccion = (typeof EQUIPO_SECCIONES)[number];

export const EQUIPO_SECCION_LABELS: Record<EquipoSeccion, string> = {
  empleados: "Empleados",
  sueldos: "Sueldos",
  adelantos: "Adelantos",
  incentivos: "Incentivos",
};

export function equipoSeccionDesdeParam(v: string | null): EquipoSeccion {
  return v && (EQUIPO_SECCIONES as readonly string[]).includes(v)
    ? (v as EquipoSeccion)
    : "empleados";
}
