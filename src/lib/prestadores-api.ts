import type { Database, PrestadorRubro } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { registrarMovimientoManual } from "@/lib/finanzas-api";
import { parseMonto } from "@/lib/sueldos-calculos";

export type PrestadorRow = Database["public"]["Tables"]["prestadores"]["Row"];
export type PagoPrestadorRow = Database["public"]["Tables"]["pagos_prestadores"]["Row"];

export type PagoPrestadorConNombre = PagoPrestadorRow & {
  prestadores: Pick<PrestadorRow, "nombre" | "rubro" | "activo"> | null;
};

export const PRESTADOR_RUBROS: { value: PrestadorRubro; label: string }[] = [
  { value: "contador", label: "Contador" },
  { value: "redes", label: "Redes" },
  { value: "otro", label: "Otro" },
];

export function etiquetaRubroPrestador(r: string | null | undefined): string {
  return PRESTADOR_RUBROS.find((x) => x.value === r)?.label ?? r ?? "—";
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function listPrestadores(): Promise<{
  data: PrestadorRow[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }
  const { data, error } = await supabase
    .from("prestadores")
    .select("*")
    .order("activo", { ascending: false })
    .order("nombre", { ascending: true });
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as PrestadorRow[], error: null };
}

export type PrestadorInput = {
  nombre: string;
  rubro: PrestadorRubro;
  cuit?: string;
  telefono?: string;
  email?: string;
  activo?: boolean;
  notas?: string;
};

export async function createPrestador(
  input: PrestadorInput,
): Promise<{ data: PrestadorRow | null; error: Error | null }> {
  const nombre = input.nombre.trim();
  if (!nombre) return { data: null, error: new Error("El nombre es obligatorio.") };
  if (!isSupabaseConfigured) return { data: null, error: new Error("Supabase no está configurado") };
  const { data, error } = await supabase
    .from("prestadores")
    .insert({
      nombre,
      rubro: input.rubro,
      cuit: input.cuit?.trim() || null,
      telefono: input.telefono?.trim() || null,
      email: input.email?.trim() || null,
      activo: input.activo ?? true,
      notas: input.notas?.trim() || null,
    })
    .select("*")
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as PrestadorRow, error: null };
}

export async function updatePrestador(
  id: string,
  input: PrestadorInput,
): Promise<{ data: PrestadorRow | null; error: Error | null }> {
  const nombre = input.nombre.trim();
  if (!nombre) return { data: null, error: new Error("El nombre es obligatorio.") };
  if (!isSupabaseConfigured) return { data: null, error: new Error("Supabase no está configurado") };
  const { data, error } = await supabase
    .from("prestadores")
    .update({
      nombre,
      rubro: input.rubro,
      cuit: input.cuit?.trim() || null,
      telefono: input.telefono?.trim() || null,
      email: input.email?.trim() || null,
      activo: input.activo ?? true,
      notas: input.notas?.trim() || null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as PrestadorRow, error: null };
}

export async function listPagosPrestadores(): Promise<{
  data: PagoPrestadorConNombre[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }
  const { data, error } = await supabase
    .from("pagos_prestadores")
    .select("*, prestadores ( nombre, rubro, activo )")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: new Error(error.message) };
  return {
    data: ((data ?? []) as PagoPrestadorConNombre[]).map((r) => ({ ...r, monto: num(r.monto) })),
    error: null,
  };
}

export type PagoPrestadorInput = {
  prestador_id: string;
  fecha: string;
  monto: number;
  moneda: "ars" | "usd";
  metodo: "efectivo" | "transferencia" | "cheque";
  descripcion?: string;
  created_by?: string | null;
};

export async function createPagoPrestador(
  input: PagoPrestadorInput,
): Promise<{ data: PagoPrestadorConNombre | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }
  const monto = parseMonto(input.monto);
  if (!(monto > 0)) return { data: null, error: new Error("El monto no es válido.") };
  if (!input.prestador_id) return { data: null, error: new Error("Elegí a quién se paga.") };

  const prest = await supabase
    .from("prestadores")
    .select("nombre")
    .eq("id", input.prestador_id)
    .maybeSingle();
  if (prest.error) return { data: null, error: new Error(prest.error.message) };
  const nombre = prest.data?.nombre ?? "prestador";

  const mov = await registrarMovimientoManual({
    tipo: "egreso",
    monto,
    moneda: input.moneda,
    fecha: input.fecha,
    metodo: input.metodo,
    concepto: "prestadores",
    descripcion: input.descripcion?.trim() || `Pago a ${nombre}`,
    created_by: input.created_by ?? null,
  });
  if (mov.error) return { data: null, error: mov.error };

  const { data, error } = await supabase
    .from("pagos_prestadores")
    .insert({
      prestador_id: input.prestador_id,
      fecha: input.fecha,
      monto,
      moneda: input.moneda,
      metodo: input.metodo,
      descripcion: input.descripcion?.trim() || null,
      movimiento_id: mov.id,
      created_by: input.created_by ?? null,
    })
    .select("*, prestadores ( nombre, rubro, activo )")
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  const row = data as PagoPrestadorConNombre;
  return { data: { ...row, monto: num(row.monto) }, error: null };
}

export async function deletePagoPrestador(id: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no está configurado") };
  const prev = await supabase.from("pagos_prestadores").select("movimiento_id").eq("id", id).maybeSingle();
  if (prev.error) return { error: new Error(prev.error.message) };
  const del = await supabase.from("pagos_prestadores").delete().eq("id", id);
  if (del.error) return { error: new Error(del.error.message) };
  if (prev.data?.movimiento_id) {
    await supabase.from("movimientos_caja").delete().eq("id", prev.data.movimiento_id);
  }
  return { error: null };
}
