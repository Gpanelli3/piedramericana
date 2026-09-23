import type { UnidadArticuloDb } from "./database";

/**
 * Tipo de trabajo (artículo) con precio fijo en ARS o USD.
 * El precio no depende de listas: las listas valen para stock (materiales).
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
  /** Precio fijo del tipo de trabajo. En Pieza no se usa: cobra la lista del material. */
  precio: number | null;
  moneda: "ars" | "usd";
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
