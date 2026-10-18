import type { Database, GastoFijoConcepto } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { registrarMovimientoManual } from "@/lib/finanzas-api";
import { parseMonto } from "@/lib/sueldos-calculos";

export type GastoFijoRow = Database["public"]["Tables"]["gastos_fijos"]["Row"];

export const GASTOS_FIJOS_CONCEPTOS: { value: GastoFijoConcepto; label: string }[] = [
  { value: "alquiler", label: "Alquiler" },
  { value: "luz", label: "Luz" },
  { value: "gas", label: "Gas" },
  { value: "impuestos", label: "Impuestos" },
];

export function etiquetaGastoFijo(c: string | null | undefined): string {
  return GASTOS_FIJOS_CONCEPTOS.find((x) => x.value === c)?.label ?? c ?? "—";
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function coerce(row: GastoFijoRow): GastoFijoRow {
  return { ...row, monto: num(row.monto) };
}

export async function listGastosFijos(): Promise<{
  data: GastoFijoRow[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }
  const { data, error } = await supabase
    .from("gastos_fijos")
    .select("*")
    .order("activo", { ascending: false })
    .order("concepto", { ascending: true });
  if (error) return { data: [], error: new Error(error.message) };
  return { data: ((data ?? []) as GastoFijoRow[]).map(coerce), error: null };
}

export type GastoFijoInput = {
  concepto: GastoFijoConcepto;
  descripcion: string;
  monto: number;
  moneda: "ars" | "usd";
  metodo: "efectivo" | "transferencia" | "cheque" | "tarjeta";
  activo?: boolean;
};

export async function upsertGastoFijo(
  id: string | null,
  input: GastoFijoInput,
): Promise<{ data: GastoFijoRow | null; error: Error | null }> {
  const descripcion = input.descripcion.trim();
  if (!descripcion) return { data: null, error: new Error("La descripción es obligatoria.") };
  const monto = parseMonto(input.monto);
  if (!(monto > 0)) return { data: null, error: new Error("El monto no es válido.") };
  if (!isSupabaseConfigured) return { data: null, error: new Error("Supabase no está configurado") };

  const payload = {
    concepto: input.concepto,
    descripcion,
    monto,
    moneda: input.moneda,
    metodo: input.metodo,
    activo: input.activo ?? true,
    updated_at: new Date().toISOString(),
  };

  const q = id
    ? supabase.from("gastos_fijos").update(payload).eq("id", id)
    : supabase.from("gastos_fijos").insert(payload);
  const { data, error } = await q.select("*").single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: coerce(data as GastoFijoRow), error: null };
}

export async function deleteGastoFijo(id: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no está configurado") };
  const { error } = await supabase.from("gastos_fijos").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

function periodoMes(fecha: string): { desde: string; hasta: string } {
  const day = fecha.slice(0, 10);
  const [y, m] = day.split("-");
  const desde = `${y}-${m}-01`;
  const last = new Date(Number(y), Number(m), 0).getDate();
  const hasta = `${y}-${m}-${String(last).padStart(2, "0")}`;
  return { desde, hasta };
}

export async function registrarGastoFijoDelMes(opts: {
  gasto: GastoFijoRow;
  fecha: string;
  created_by?: string | null;
}): Promise<{ yaEstaba: boolean; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { yaEstaba: false, error: new Error("Supabase no está configurado") };
  }
  const { desde, hasta } = periodoMes(opts.fecha);
  const existing = await supabase
    .from("movimientos_caja")
    .select("id")
    .eq("referencia_tipo", "gasto_fijo")
    .eq("referencia_id", opts.gasto.id)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .maybeSingle();
  if (existing.error) return { yaEstaba: false, error: new Error(existing.error.message) };
  if (existing.data?.id) return { yaEstaba: true, error: null };

  const mov = await registrarMovimientoManual({
    tipo: "egreso",
    monto: opts.gasto.monto,
    moneda: opts.gasto.moneda,
    fecha: opts.fecha,
    metodo: opts.gasto.metodo,
    concepto: opts.gasto.concepto,
    descripcion: opts.gasto.descripcion,
    created_by: opts.created_by ?? null,
  });
  if (mov.error || !mov.id) return { yaEstaba: false, error: mov.error };
  const up = await supabase
    .from("movimientos_caja")
    .update({ referencia_tipo: "gasto_fijo", referencia_id: opts.gasto.id })
    .eq("id", mov.id);
  if (up.error) return { yaEstaba: false, error: new Error(up.error.message) };
  return { yaEstaba: false, error: null };
}
