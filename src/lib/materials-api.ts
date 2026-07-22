import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database, MaterialKindDb } from "@/types/database";
import type { MaterialWizardRow } from "@/types/material-catalog";

type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];
type MaterialInsert = Database["public"]["Tables"]["materials"]["Insert"];

export function materialRowToWizard(row: MaterialRow): MaterialWizardRow {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    material_kind: row.material_kind,
    peso_por_m2_kg: row.peso_por_m2_kg,
    bulk_stock_kg: row.bulk_stock_kg,
    stock_qty: row.stock_qty,
  };
}

export async function listMaterials(): Promise<{
  data: MaterialWizardRow[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }

  const { data, error } = await supabase
    .from("materials")
    .select("id,name,unit,material_kind,peso_por_m2_kg,bulk_stock_kg,stock_qty")
    .order("name");

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  return {
    data: (data ?? []).map((row) =>
      materialRowToWizard(row as MaterialRow),
    ),
    error: null,
  };
}

export async function createMaterial(input: {
  name: string;
  unit?: string;
  material_kind?: MaterialKindDb;
  peso_por_m2_kg?: number | null;
}): Promise<{ data: MaterialWizardRow | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }

  const name = input.name.trim();
  if (!name) {
    return { data: null, error: new Error("El nombre del material es obligatorio") };
  }

  const payload: MaterialInsert = {
    name,
    unit: input.unit?.trim() || "m2",
    material_kind: input.material_kind ?? "marmol",
    peso_por_m2_kg: input.peso_por_m2_kg ?? null,
    stock_qty: 0,
    bulk_stock_kg: 0,
  };

  const { data, error } = await supabase
    .from("materials")
    .insert(payload)
    .select("id,name,unit,material_kind,peso_por_m2_kg,bulk_stock_kg,stock_qty")
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return {
    data: materialRowToWizard(data as MaterialRow),
    error: null,
  };
}
