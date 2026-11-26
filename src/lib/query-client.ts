import { QueryClient } from "@tanstack/react-query";

/**
 * Caché de datos compartida por toda la app.
 *
 * Al volver a una pantalla ya visitada se muestran al instante los datos guardados
 * y se actualizan por detrás (staleTime 0 = siempre se revalida al entrar).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

/** Claves de caché. Invalidar `["ots"]` refresca todas las listas de OTs. */
export const queryKeys = {
  ots: ["ots"] as const,
  otsGrupos: (filtro: string) => ["ots", "grupos", filtro] as const,
  ventas: ["ventas"] as const,
  ventasLista: ["ventas", "lista"] as const,
  /** Todos los presupuestos con resumen de venta: lo comparten Ventas y Clientes. */
  ventasResumen: ["ventas", "resumen"] as const,
  clientes: ["clientes"] as const,
  clientesLista: ["clientes", "lista"] as const,
  clienteFicha: (id: string) => ["clientes", "ficha", id] as const,
  planificacion: ["planificacion"] as const,
  planEventos: (desde: string, hasta: string) => ["planificacion", "eventos", desde, hasta] as const,
  planCola: ["planificacion", "cola"] as const,
  planSinMarcar: (hoy: string) => ["planificacion", "sinMarcar", hoy] as const,
  empleadosAsignables: ["empleados", "asignables"] as const,
  dashboard: ["dashboard"] as const,
  finanzas: ["finanzas"] as const,
  finanzasResumen: (hoy: string) => ["finanzas", "resumen", hoy] as const,
  finanzasSaldos: ["finanzas", "saldos"] as const,
  finanzasCuentas: ["finanzas", "cuentas"] as const,
  proveedores: ["proveedores"] as const,
  stock: ["stock"] as const,
  stockChapas: ["stock", "chapas"] as const,
  stockMateriales: ["stock", "materiales"] as const,
  stockProductos: ["stock", "productos"] as const,
  medicion: ["medicion"] as const,
  medicionCola: ["medicion", "cola"] as const,
};
