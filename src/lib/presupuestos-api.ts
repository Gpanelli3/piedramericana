import type { PresupuestoEstado } from "@/types/database";
import type { PresupuestoPayloadV1 } from "@/types/presupuesto-payload";
import type { ArticuloConPrecio, ListaPrecioRow } from "@/types/articulos";
import {
  mergeVentasResumenIntoPresupuestos,
  type VentaResumenMerged,
} from "@/lib/ventas-api";
import { supabase } from "@/lib/supabase";

export type PresupuestoRowLista = {
  id: string;
  numero: string;
  cliente: string;
  total: number;
  moneda: "ars" | "usd";
  status: PresupuestoEstado;
  created_at: string;
  updated_at: string;
};

export async function listPresupuestosLista(): Promise<{
  data: PresupuestoRowLista[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("presupuestos")
    .select("id, numero, cliente, total, moneda, status, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as PresupuestoRowLista[], error: null };
}

export type PresupuestoRowList = PresupuestoRowLista & VentaResumenMerged;

export async function listPresupuestosResumen(): Promise<{
  data: PresupuestoRowList[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("presupuestos")
    .select("id, numero, cliente, total, moneda, status, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: new Error(error.message) };
  try {
    const merged = await mergeVentasResumenIntoPresupuestos(
      data as Omit<PresupuestoRowList, keyof VentaResumenMerged>[],
    );
    return { data: merged as PresupuestoRowList[], error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error("No se pudo cargar datos de venta."),
    };
  }
}

export async function approvePresupuestoWithVenta(presupuestoId: string): Promise<{
  error: Error | null;
}> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("presupuestos")
    .update({ status: "aprobado", updated_at: nowIso })
    .eq("id", presupuestoId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function getPresupuestoById(id: string) {
  return supabase.from("presupuestos").select("*").eq("id", id).maybeSingle();
}

export async function insertPresupuestoRow(input: {
  numero: string;
  cliente: string;
  client_id?: string | null;
  total: number;
  moneda: "ars" | "usd";
  status: PresupuestoEstado;
  payload: PresupuestoPayloadV1;
  created_by: string | null;
}) {
  return supabase
    .from("presupuestos")
    .insert({
      numero: input.numero,
      cliente: input.cliente,
      client_id: input.client_id ?? null,
      total: input.total,
      moneda: input.moneda,
      status: input.status,
      payload: input.payload,
      created_by: input.created_by,
    })
    .select("id, numero")
    .single();
}

/** Actualiza un presupuesto solo si sigue en estado `pendiente`. */
export async function updatePresupuestoRow(
  id: string,
  input: {
    cliente: string;
    client_id?: string | null;
    total: number;
    moneda: "ars" | "usd";
    payload: PresupuestoPayloadV1;
  },
) {
  const now = new Date().toISOString();
  return supabase
    .from("presupuestos")
    .update({
      cliente: input.cliente,
      client_id: input.client_id ?? null,
      total: input.total,
      moneda: input.moneda,
      payload: input.payload,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "pendiente")
    .select("id, numero")
    .maybeSingle();
}

export async function patchPresupuestoStatus(id: string, status: PresupuestoEstado) {
  const now = new Date().toISOString();
  return supabase.from("presupuestos").update({ status, updated_at: now }).eq("id", id);
}

// ─── Artículos y Listas de Precio ────────────────────────────

/**
 * Trae todas las listas de precio activas, ordenadas por sort_order.
 */
export async function listListasPrecio(): Promise<{
  data: ListaPrecioRow[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("listas_precio")
    .select("id, codigo, label, moneda, descripcion, sort_order")
    .eq("activa", true)
    .order("sort_order");
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as ListaPrecioRow[], error: null };
}

/**
 * Trae todos los artículos activos con el precio de la lista indicada.
 * Usa la RPC get_articulos_con_precios para evitar N+1.
 * Si el artículo no tiene precio en esa lista, precio = null.
 */
export async function listArticulosConPrecios(listaPrecioId: string): Promise<{
  data: ArticuloConPrecio[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc("get_articulos_con_precios", {
    p_lista_precio_id: listaPrecioId,
  });
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as ArticuloConPrecio[], error: null };
}

/**
 * Trae todos los artículos activos sin precio (útil para selects sin contexto de lista).
 */
export async function listArticulos(): Promise<{
  data: ArticuloConPrecio[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("articulos")
    .select("id, codigo, descripcion, unidad, calcula_material, medida_estandar_m2, prefer_modo_manual, sort_order")
    .eq("activo", true)
    .order("sort_order");
  if (error) return { data: null, error: new Error(error.message) };
  const mapped = (data ?? []).map((a) => ({ ...a, precio: null })) as ArticuloConPrecio[];
  return { data: mapped, error: null };
}

/**
 * Valida que un artículo exista y esté activo.
 */
export async function getArticuloById(id: string): Promise<{
  data: ArticuloConPrecio | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("articulos")
    .select("id, codigo, descripcion, unidad, calcula_material, medida_estandar_m2, prefer_modo_manual, sort_order")
    .eq("id", id)
    .eq("activo", true)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };
  return { data: { ...data, precio: null } as ArticuloConPrecio, error: null };
}
