import type { PresupuestoEstado } from "@/types/database";
import type { PresupuestoPayloadV1 } from "@/types/presupuesto-payload";
import {
  mergeVentasResumenIntoPresupuestos,
  ensureVentaForPresupuestoAprobado,
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
  return ensureVentaForPresupuestoAprobado(presupuestoId);
}

export async function getPresupuestoById(id: string) {
  return supabase.from("presupuestos").select("*").eq("id", id).maybeSingle();
}

export async function insertPresupuestoRow(input: {
  numero: string;
  cliente: string;
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
      total: input.total,
      moneda: input.moneda,
      status: input.status,
      payload: input.payload,
      created_by: input.created_by,
    })
    .select("id, numero")
    .single();
}

export async function patchPresupuestoStatus(id: string, status: PresupuestoEstado) {
  const now = new Date().toISOString();
  return supabase.from("presupuestos").update({ status, updated_at: now }).eq("id", id);
}
