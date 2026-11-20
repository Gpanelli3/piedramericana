import type { Database } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type VacacionRow = Database["public"]["Tables"]["vacaciones_empleado"]["Row"];

export type VacacionInput = {
  empleado_id: string;
  desde: string;
  hasta: string;
  dias?: number;
  notas?: string;
  created_by?: string | null;
};

/** Días corridos entre dos fechas ISO (inclusive). */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export async function listVacaciones(empleadoId: string): Promise<{
  data: VacacionRow[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }
  const { data, error } = await supabase
    .from("vacaciones_empleado")
    .select("*")
    .eq("empleado_id", empleadoId)
    .order("desde", { ascending: false });
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as VacacionRow[], error: null };
}

export async function createVacacion(
  input: VacacionInput,
): Promise<{ data: VacacionRow | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }
  if (!input.desde || !input.hasta) {
    return { data: null, error: new Error("Indicá las fechas desde y hasta") };
  }
  const dias = input.dias ?? diasEntre(input.desde, input.hasta);
  if (dias <= 0) {
    return { data: null, error: new Error("El rango de fechas no es válido") };
  }
  const { data, error } = await supabase
    .from("vacaciones_empleado")
    .insert({
      empleado_id: input.empleado_id,
      desde: input.desde,
      hasta: input.hasta,
      dias,
      notas: input.notas?.trim() || null,
      created_by: input.created_by ?? null,
    })
    .select("*")
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as VacacionRow, error: null };
}

export async function deleteVacacion(id: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error("Supabase no está configurado") };
  }
  const { error } = await supabase.from("vacaciones_empleado").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
