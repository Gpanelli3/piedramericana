import { supabase } from "@/lib/supabase";
import type {
  ArticuloConPrecio,
  ListaPrecioRow,
  PrecioArticuloLista,
} from "@/types/articulos";

export async function fetchListasPrecio(): Promise<{
  data: ListaPrecioRow[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from("listas_precio")
      .select("id, codigo, label, moneda, descripcion, sort_order, activa")
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

/** Todas las listas (activas e inactivas) para administración. */
export async function fetchListasPrecioTodas(): Promise<{
  data: ListaPrecioRow[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from("listas_precio")
      .select("id, codigo, label, moneda, descripcion, sort_order, activa")
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

export type ListaPrecioUpsertInput = {
  codigo: string;
  label: string;
  moneda: "ars" | "usd";
  descripcion?: string | null;
  activa?: boolean;
  sort_order?: number;
};

export async function createListaPrecio(input: ListaPrecioUpsertInput): Promise<{
  data: ListaPrecioRow | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from("listas_precio")
      .insert({
        codigo: input.codigo.trim(),
        label: input.label.trim(),
        moneda: input.moneda,
        descripcion: input.descripcion?.trim() || null,
        activa: input.activa ?? true,
        sort_order: input.sort_order ?? 0,
      })
      .select("id, codigo, label, moneda, descripcion, sort_order, activa")
      .single();

    if (error) return { data: null, error: new Error(error.message) };
    return { data: data as ListaPrecioRow, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("No se pudo crear la lista."),
    };
  }
}

export async function updateListaPrecio(
  id: string,
  input: ListaPrecioUpsertInput,
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from("listas_precio")
      .update({
        codigo: input.codigo.trim(),
        label: input.label.trim(),
        moneda: input.moneda,
        descripcion: input.descripcion?.trim() || null,
        activa: input.activa ?? true,
        sort_order: input.sort_order ?? 0,
      })
      .eq("id", id);

    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("No se pudo actualizar la lista."),
    };
  }
}

export async function fetchPreciosDeArticulo(articuloId: string): Promise<{
  data: PrecioArticuloLista[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from("listas_precio_items")
      .select("lista_precio_id, articulo_id, precio, activo")
      .eq("articulo_id", articuloId)
      .eq("activo", true);

    if (error) return { data: null, error: new Error(error.message) };
    return { data: (data ?? []) as PrecioArticuloLista[], error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("No se pudieron cargar los precios del artículo."),
    };
  }
}

export type PrecioListaArticuloRow = {
  articulo_id: string;
  codigo: string;
  descripcion: string;
  unidad: ArticuloConPrecio["unidad"];
  precio: number | null;
  item_id: string | null;
};

/** Artículos activos con el precio (si hay) de una lista. */
export async function fetchArticulosPreciosDeLista(listaId: string): Promise<{
  data: PrecioListaArticuloRow[] | null;
  error: Error | null;
}> {
  try {
    const [artsRes, itemsRes] = await Promise.all([
      supabase
        .from("articulos")
        .select("id, codigo, descripcion, unidad")
        .eq("activo", true)
        .order("sort_order"),
      supabase
        .from("listas_precio_items")
        .select("id, articulo_id, precio, activo")
        .eq("lista_precio_id", listaId)
        .eq("activo", true),
    ]);

    if (artsRes.error) {
      return { data: null, error: new Error(artsRes.error.message) };
    }
    if (itemsRes.error) {
      return { data: null, error: new Error(itemsRes.error.message) };
    }

    const byArt = new Map(
      (itemsRes.data ?? []).map((i) => [i.articulo_id, i] as const),
    );

    const rows: PrecioListaArticuloRow[] = (artsRes.data ?? []).map((a) => {
      const item = byArt.get(a.id);
      return {
        articulo_id: a.id,
        codigo: a.codigo,
        descripcion: a.descripcion,
        unidad: a.unidad,
        precio: item != null ? Number(item.precio) : null,
        item_id: item?.id ?? null,
      };
    });

    return { data: rows, error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("No se pudieron cargar los precios de la lista."),
    };
  }
}

/**
 * Upsert precios de un artículo en varias listas.
 * `precios`: mapa listaId → string/number; vacío o inválido elimina/desactiva el ítem.
 */
export async function syncPreciosArticulo(
  articuloId: string,
  precios: Record<string, string>,
): Promise<{ error: Error | null }> {
  try {
    const entries = Object.entries(precios);
    for (const [listaId, raw] of entries) {
      const t = raw.trim().replace(",", ".");
      if (t === "") {
        await supabase
          .from("listas_precio_items")
          .update({ activo: false })
          .eq("articulo_id", articuloId)
          .eq("lista_precio_id", listaId);
        continue;
      }
      const n = Number.parseFloat(t);
      if (!Number.isFinite(n) || n < 0) {
        return { error: new Error("Hay un precio inválido.") };
      }
      const { error } = await supabase.from("listas_precio_items").upsert(
        {
          articulo_id: articuloId,
          lista_precio_id: listaId,
          precio: n,
          activo: true,
        },
        { onConflict: "lista_precio_id,articulo_id" },
      );
      if (error) return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("No se pudieron guardar los precios."),
    };
  }
}

export async function upsertPrecioListaArticulo(input: {
  lista_precio_id: string;
  articulo_id: string;
  precio: number | null;
}): Promise<{ error: Error | null }> {
  try {
    if (input.precio == null || !Number.isFinite(input.precio)) {
      const { error } = await supabase
        .from("listas_precio_items")
        .update({ activo: false })
        .eq("lista_precio_id", input.lista_precio_id)
        .eq("articulo_id", input.articulo_id);
      if (error) return { error: new Error(error.message) };
      return { error: null };
    }
    const { error } = await supabase.from("listas_precio_items").upsert(
      {
        lista_precio_id: input.lista_precio_id,
        articulo_id: input.articulo_id,
        precio: input.precio,
        activo: true,
      },
      { onConflict: "lista_precio_id,articulo_id" },
    );
    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("No se pudo guardar el precio."),
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
        "id, codigo, descripcion, unidad, calcula_material, medida_estandar_m2, prefer_modo_manual, sort_order, precio, moneda",
      )
      .eq("activo", true)
      .order("sort_order");

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const mapped = (data ?? []).map((articulo) => ({
      ...articulo,
      precio: articulo.precio != null ? Number(articulo.precio) : null,
        moneda: articulo.moneda === "usd" ? "usd" : "ars",
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

    return {
      data: ((data ?? []) as ArticuloConPrecio[]).map((a) => ({
        ...a,
        precio: a.precio != null ? Number(a.precio) : null,
        moneda: a.moneda === "usd" ? "usd" : "ars",
      })),
      error: null,
    };
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

export type PrecioListaMaterialRow = {
  material_id: string;
  codigo: string | null;
  name: string;
  precio: number | null;
};

export async function fetchMaterialesPreciosDeLista(listaId: string): Promise<{
  data: PrecioListaMaterialRow[] | null;
  error: Error | null;
}> {
  try {
    const [matsRes, itemsRes] = await Promise.all([
      supabase.from("materials").select("id, name, codigo").order("name"),
      supabase
        .from("listas_precio_materiales")
        .select("material_id, precio, activo")
        .eq("lista_precio_id", listaId)
        .eq("activo", true),
    ]);
    if (matsRes.error) return { data: null, error: new Error(matsRes.error.message) };
    if (itemsRes.error) return { data: null, error: new Error(itemsRes.error.message) };
    const byId = new Map((itemsRes.data ?? []).map((i) => [i.material_id, i] as const));
    return {
      data: (matsRes.data ?? []).map((m) => {
        const item = byId.get(m.id);
        return {
          material_id: m.id,
          codigo: m.codigo,
          name: m.name,
          precio: item != null ? Number(item.precio) : null,
        };
      }),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("No se pudieron cargar los precios de materiales."),
    };
  }
}

export async function fetchPreciosMaterialesPorLista(listaId: string): Promise<{
  data: Record<string, number> | null;
  error: Error | null;
}> {
  const { data, error } = await fetchMaterialesPreciosDeLista(listaId);
  if (error || !data) return { data: null, error };
  const map: Record<string, number> = {};
  for (const row of data) {
    if (row.precio != null && Number.isFinite(row.precio)) {
      map[row.material_id] = row.precio;
    }
  }
  return { data: map, error: null };
}

export async function upsertPrecioListaMaterial(input: {
  lista_precio_id: string;
  material_id: string;
  precio: number | null;
}): Promise<{ error: Error | null }> {
  try {
    if (input.precio == null || !Number.isFinite(input.precio)) {
      const { error } = await supabase
        .from("listas_precio_materiales")
        .update({ activo: false })
        .eq("lista_precio_id", input.lista_precio_id)
        .eq("material_id", input.material_id);
      if (error) return { error: new Error(error.message) };
      return { error: null };
    }
    const { error } = await supabase.from("listas_precio_materiales").upsert(
      {
        lista_precio_id: input.lista_precio_id,
        material_id: input.material_id,
        precio: input.precio,
        activo: true,
      },
      { onConflict: "lista_precio_id,material_id" },
    );
    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("No se pudo guardar el precio."),
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
  precio?: number | null;
  moneda?: "ars" | "usd";
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
        precio: input.precio ?? null,
        moneda: input.moneda ?? "ars",
      })
      .select(
        "id, codigo, descripcion, unidad, calcula_material, medida_estandar_m2, prefer_modo_manual, sort_order, precio, moneda",
      )
      .single();

    if (error) return { data: null, error: new Error(error.message) };
    const row = data as ArticuloConPrecio;
    return {
      data: {
        ...row,
        precio: row.precio != null ? Number(row.precio) : null,
        moneda: row.moneda === "usd" ? "usd" : "ars",
      },
      error: null,
    };
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
        precio: input.precio ?? null,
        moneda: input.moneda ?? "ars",
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
