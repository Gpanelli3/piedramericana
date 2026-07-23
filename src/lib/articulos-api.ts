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

export type ArticuloUpsertInput = {
  codigo: string;
  descripcion: string;
  unidad: ArticuloConPrecio["unidad"];
  calcula_material: boolean;
  medida_estandar_m2: number | null;
  prefer_modo_manual: boolean;
  sort_order?: number;
};

export async function createArticulo(input: ArticuloUpsertInput): Promise<{
  data: ArticuloConPrecio | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from("articulos")
      .insert({
        codigo: input.codigo.trim(),
        descripcion: input.descripcion.trim(),
        unidad: input.unidad,
        calcula_material: input.calcula_material,
        medida_estandar_m2: input.medida_estandar_m2,
        prefer_modo_manual: input.prefer_modo_manual,
        sort_order: input.sort_order ?? 0,
      })
      .select(
        "id, codigo, descripcion, unidad, calcula_material, medida_estandar_m2, prefer_modo_manual, sort_order",
      )
      .single();

    if (error) return { data: null, error: new Error(error.message) };
    return { data: { ...(data as ArticuloConPrecio), precio: null }, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("No se pudo crear el artículo."),
    };
  }
}

export async function updateArticulo(
  id: string,
  input: ArticuloUpsertInput,
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from("articulos")
      .update({
        codigo: input.codigo.trim(),
        descripcion: input.descripcion.trim(),
        unidad: input.unidad,
        calcula_material: input.calcula_material,
        medida_estandar_m2: input.medida_estandar_m2,
        prefer_modo_manual: input.prefer_modo_manual,
        sort_order: input.sort_order ?? 0,
      })
      .eq("id", id);

    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("No se pudo actualizar el artículo."),
    };
  }
}
