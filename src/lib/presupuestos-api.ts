import type { Json, PresupuestoEstado } from "@/types/database";
import type { ArticuloConPrecio, ListaPrecioRow } from "@/types/articulos";
import {
  hydratePresupuestoPayloadV1,
  isPresupuestoPayloadV1,
  type PresupuestoPayloadV1,
} from "@/types/presupuesto-payload";
import {
  mergeVentasResumenIntoPresupuestos,
  type VentaResumenMerged,
} from "@/lib/ventas-api";
import { supabase } from "@/lib/supabase";
import { removePlano } from "@/lib/presupuesto-planos-storage";

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

export type PresupuestoRowList = PresupuestoRowLista &
  VentaResumenMerged & {
    created_by: string | null;
    vendedor_nombre: string | null;
  };

export async function listPresupuestosResumen(): Promise<{
  data: PresupuestoRowList[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("presupuestos")
    .select("id, numero, cliente, total, moneda, status, created_at, updated_at, created_by")
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: new Error(error.message) };
  try {
    const base = (data ?? []) as Array<
      PresupuestoRowLista & { created_by: string | null }
    >;
    const merged = await mergeVentasResumenIntoPresupuestos(base);

    const creatorIds = [
      ...new Set(
        merged
          .map((r) => r.created_by)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const nombrePorId = new Map<string, string>();
    if (creatorIds.length > 0) {
      const { data: usuarios, error: uErr } = await supabase
        .from("usuarios")
        .select("id, full_name")
        .in("id", creatorIds);
      if (!uErr && usuarios) {
        for (const u of usuarios) {
          const name = typeof u.full_name === "string" ? u.full_name.trim() : "";
          if (u.id && name) nombrePorId.set(u.id, name);
        }
      }
    }

    const withVendedor: PresupuestoRowList[] = merged.map((r) => ({
      ...r,
      created_by: r.created_by ?? null,
      vendedor_nombre: r.created_by ? nombrePorId.get(r.created_by) ?? null : null,
    }));

    return { data: withVendedor, error: null };
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

export type PresupuestoVersionLista = {
  id: string;
  presupuesto_id: string;
  nro: number;
  total: number;
  m2: number;
  created_at: string;
};

export type PresupuestoVersionDetalle = PresupuestoVersionLista & {
  payload: PresupuestoPayloadV1;
};

export async function listPresupuestoVersiones(presupuestoId: string): Promise<{
  data: PresupuestoVersionLista[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("presupuesto_versiones")
    .select("id, presupuesto_id, nro, total, m2, created_at")
    .eq("presupuesto_id", presupuestoId)
    .order("nro", { ascending: true });
  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []) as PresupuestoVersionLista[], error: null };
}

export async function getPresupuestoVersion(
  presupuestoId: string,
  nro: number,
): Promise<{
  data: PresupuestoVersionDetalle | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("presupuesto_versiones")
    .select("id, presupuesto_id, nro, total, m2, payload, created_at")
    .eq("presupuesto_id", presupuestoId)
    .eq("nro", nro)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };
  const raw = data.payload as Json;
  if (!isPresupuestoPayloadV1(raw)) {
    return { data: null, error: new Error("La versión guardada no es compatible.") };
  }
  return {
    data: {
      id: data.id,
      presupuesto_id: data.presupuesto_id,
      nro: data.nro,
      total: Number(data.total) || 0,
      m2: Number(data.m2) || 0,
      created_at: data.created_at,
      payload: hydratePresupuestoPayloadV1(raw),
    },
    error: null,
  };
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

function storagePathsDePayload(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const ordenes = (payload as { ordenes?: unknown }).ordenes;
  if (!Array.isArray(ordenes)) return [];
  const out: string[] = [];
  for (const ot of ordenes) {
    if (!ot || typeof ot !== "object") continue;
    const path = (ot as { planoAdjunto?: { storagePath?: unknown } }).planoAdjunto
      ?.storagePath;
    if (typeof path === "string" && path.trim()) out.push(path);
  }
  return out;
}

/**
 * Rechazar = borrar. No se guarda historial.
 * Solo presupuestos pendientes, sin venta.
 */
export async function eliminarPresupuestoPendiente(id: string): Promise<{
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("presupuestos")
    .select("id, status, payload")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: new Error(error.message) };
  if (!data) return { error: new Error("El presupuesto no existe.") };
  if (data.status !== "pendiente") {
    return { error: new Error("Solo se puede eliminar un presupuesto pendiente.") };
  }

  const venta = await supabase
    .from("ventas")
    .select("id")
    .eq("presupuesto_id", id)
    .maybeSingle();
  if (venta.error) return { error: new Error(venta.error.message) };
  if (venta.data) {
    return { error: new Error("Este presupuesto ya tiene venta. No se puede eliminar.") };
  }

  const [seg, com] = await Promise.all([
    supabase.from("seguimiento_presupuestos").delete().eq("presupuesto_id", id),
    supabase.from("comisiones").delete().eq("presupuesto_id", id),
  ]);
  if (seg.error) return { error: new Error(seg.error.message) };
  if (com.error) return { error: new Error(com.error.message) };

  const paths = storagePathsDePayload(data.payload);
  if (paths.length > 0) {
    await Promise.all(paths.map((p) => removePlano(p)));
  }

  const del = await supabase
    .from("presupuestos")
    .delete()
    .eq("id", id)
    .eq("status", "pendiente");
  if (del.error) return { error: new Error(del.error.message) };
  return { error: null };
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
