import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type NafeOpcionRow = Database["public"]["Tables"]["nafe_opciones"]["Row"];

export async function listNafeOpciones(): Promise<{
  data: NafeOpcionRow[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from("nafe_opciones")
    .select("*")
    .eq("activo", true)
    .order("etiqueta", { ascending: true });
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as NafeOpcionRow[], error: null };
}

export async function asegurarNafeOpcion(etiqueta: string): Promise<{ error: Error | null }> {
  const t = etiqueta.trim();
  if (!t || !isSupabaseConfigured) return { error: null };
  const { data: existing, error: selErr } = await supabase
    .from("nafe_opciones")
    .select("id")
    .ilike("etiqueta", t)
    .maybeSingle();
  if (selErr) return { error: new Error(selErr.message) };
  if (existing?.id) return { error: null };
  const { error } = await supabase.from("nafe_opciones").insert({ etiqueta: t, activo: true });
  return { error: error ? new Error(error.message) : null };
}
