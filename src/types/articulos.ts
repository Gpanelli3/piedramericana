import type { UnidadArticuloDb } from "./database";

/**
 * Artículo tal como lo devuelve la RPC get_articulos_con_precios.
 * Precio puede ser null si el artículo no tiene entrada en la lista solicitada.
 */
export interface ArticuloConPrecio {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: UnidadArticuloDb;
  calcula_material: boolean;
  medida_estandar_m2: number | null;
  prefer_modo_manual: boolean;
  sort_order: number;
  /** Precio en la moneda de la lista. null si no tiene precio en esa lista. */
  precio: number | null;
}

/**
 * Fila básica de lista de precio (cabecera).
 */
export interface ListaPrecioRow {
  id: string;
  codigo: string;
  label: string;
  moneda: "ars" | "usd";
  descripcion: string | null;
  sort_order: number;
  activa?: boolean;
}

/** Precio de un artículo en una lista. */
export interface PrecioArticuloLista {
  lista_precio_id: string;
  articulo_id: string;
  precio: number;
  activo: boolean;
}
