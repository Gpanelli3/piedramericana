import { supabase } from "@/lib/supabase";
import type { ArticuloConPrecio, ListaPrecioRow } from "@/types/articulos";

export async function fetchListasPrecio(): Promise<{
  data: ListaPrecioRow[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from("listas_precio")
      .select("id, codigo, label, moneda, descripcion, sort_order")
      .eq("activa", true)
      .order("sort_order");

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data ?? []) as ListaPrecioRow[], error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("No se pudieron cargar las listas de precio."),
    };
  }
}

export async function fetchArticulos(): Promise<{
  data: ArticuloConPrecio[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from("articulos")
      .select(
        "id, codigo, descripcion, unidad, calcula_material, medida_estandar_m2, prefer_modo_manual, sort_order",
      )
      .eq("activo", true)
      .order("sort_order");

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const mapped = (data ?? []).map((articulo) => ({
      ...articulo,
      precio: null,
    })) as ArticuloConPrecio[];

    return { data: mapped, error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("No se pudieron cargar los artículos."),
    };
  }
}

export async function fetchArticulosConPrecios(
  listaPrecioId: string,
): Promise<{
  data: ArticuloConPrecio[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc("get_articulos_con_precios", {
      p_lista_precio_id: listaPrecioId,
    });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data ?? []) as ArticuloConPrecio[], error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("No se pudieron cargar los artículos con precios."),
    };
  }
}
