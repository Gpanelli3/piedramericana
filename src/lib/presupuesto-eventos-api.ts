import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Json } from "@/types/database";

export type PresupuestoEventoPrecioTipo =
  | "primer_precio"
  | "enviado_pdf"
  | "version_nueva"
  | "ajuste";

export type PresupuestoEventoPrecio = {
  id: string;
  presupuesto_id: string;
  tipo: PresupuestoEventoPrecioTipo;
  monto: number;
  moneda: "ars" | "usd";
  created_at: string;
  created_by: string | null;
  created_by_nombre: string | null;
  meta: Json;
};

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function etiquetaEventoPrecio(tipo: PresupuestoEventoPrecioTipo): string {
  switch (tipo) {
    case "primer_precio":
      return "Primer precio";
    case "enviado_pdf":
      return "Le llegó al cliente · PDF";
    case "version_nueva":
      return "Nueva versión";
    case "ajuste":
      return "Ajuste de precio";
    default:
      return tipo;
  }
}

export async function registrarEventoPrecio(opts: {
  presupuestoId: string;
  tipo: PresupuestoEventoPrecioTipo;
  monto: number;
  moneda: "ars" | "usd";
  createdBy?: string | null;
  meta?: Json;
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: null };
  const createdBy = opts.createdBy === undefined ? await currentUserId() : opts.createdBy;
  const row = {
    presupuesto_id: opts.presupuestoId,
    tipo: opts.tipo,
    monto: opts.monto,
    moneda: opts.moneda,
    created_by: createdBy,
    meta: opts.meta ?? {},
  };
  let { error } = await supabase.from("presupuesto_eventos_precio").insert(row);
  if (error?.code === "23503" && createdBy) {
    ({ error } = await supabase.from("presupuesto_eventos_precio").insert({
      ...row,
      created_by: null,
    }));
  }
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function ensurePrimerPrecio(opts: {
  presupuestoId: string;
  monto: number;
  moneda: "ars" | "usd";
  createdBy?: string | null;
  createdAt?: string;
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: null };
  const existing = await supabase
    .from("presupuesto_eventos_precio")
    .select("id")
    .eq("presupuesto_id", opts.presupuestoId)
    .eq("tipo", "primer_precio")
    .limit(1);
  if (existing.error) return { error: new Error(existing.error.message) };
  if ((existing.data ?? []).length > 0) return { error: null };
  return registrarEventoPrecio({
    presupuestoId: opts.presupuestoId,
    tipo: "primer_precio",
    monto: opts.monto,
    moneda: opts.moneda,
    createdBy: opts.createdBy,
    meta: opts.createdAt ? { created_at_origen: opts.createdAt } : {},
  });
}

export async function listEventosPrecio(
  presupuestoId: string,
): Promise<{ data: PresupuestoEventoPrecio[]; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado.") };
  }
  const { data, error } = await supabase
    .from("presupuesto_eventos_precio")
    .select("id, presupuesto_id, tipo, monto, moneda, created_at, created_by, meta")
    .eq("presupuesto_id", presupuestoId)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: new Error(error.message) };

  const rows = (data ?? []) as Array<{
    id: string;
    presupuesto_id: string;
    tipo: PresupuestoEventoPrecioTipo;
    monto: number;
    moneda: "ars" | "usd";
    created_at: string;
    created_by: string | null;
    meta: Json;
  }>;

  const ids = [...new Set(rows.map((r) => r.created_by).filter((id): id is string => Boolean(id)))];
  const nombrePorId = new Map<string, string>();
  if (ids.length > 0) {
    const usuarios = await supabase.from("usuarios").select("id, full_name").in("id", ids);
    if (!usuarios.error) {
      for (const u of usuarios.data ?? []) {
        const name = typeof u.full_name === "string" ? u.full_name.trim() : "";
        if (u.id && name) nombrePorId.set(u.id, name);
      }
    }
  }

  return {
    data: rows.map((r) => ({
      ...r,
      monto: Number(r.monto) || 0,
      created_by_nombre: r.created_by ? nombrePorId.get(r.created_by) ?? null : null,
    })),
    error: null,
  };
}
