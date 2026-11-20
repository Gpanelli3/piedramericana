import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database, MaterialKindDb } from "@/types/database";
import type { MaterialWizardRow } from "@/types/material-catalog";

type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];
type MaterialInsert = Database["public"]["Tables"]["materials"]["Insert"];

const MATERIAL_SELECT =
  "id,name,unit,material_kind,peso_por_m2_kg,bulk_stock_kg,stock_qty,familia,codigo,costo_usd,espesor_mm,uso";

export function materialRowToWizard(row: MaterialRow): MaterialWizardRow {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    material_kind: row.material_kind,
    peso_por_m2_kg: row.peso_por_m2_kg,
    bulk_stock_kg: row.bulk_stock_kg,
    stock_qty: row.stock_qty,
    familia: row.familia ?? null,
    codigo: row.codigo ?? null,
    costo_usd: row.costo_usd != null ? Number(row.costo_usd) : null,
    espesor_mm: row.espesor_mm != null ? Number(row.espesor_mm) : null,
    uso: row.uso === "producto" ? "producto" : "piedra",
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
    .select(MATERIAL_SELECT)
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
  familia?: string | null;
  codigo?: string | null;
  costo_usd?: number | null;
  espesor_mm?: number | null;
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
    familia: input.familia?.trim() || null,
    codigo: input.codigo?.trim() || null,
    costo_usd: input.costo_usd ?? null,
    espesor_mm: input.espesor_mm ?? null,
  };

  const { data, error } = await supabase
    .from("materials")
    .insert(payload)
    .select(MATERIAL_SELECT)
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return {
    data: materialRowToWizard(data as MaterialRow),
    error: null,
  };
}

type MaterialUpdate = Database["public"]["Tables"]["materials"]["Update"];

export async function fetchMaterialById(id: string): Promise<{
  data: MaterialWizardRow | null;
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }
  const { data, error } = await supabase
    .from("materials")
    .select(MATERIAL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data ? materialRowToWizard(data as MaterialRow) : null, error: null };
}

/**
 * Edita los datos de una piedra. El nombre no se edita acá: está copiado en
 * planchas, remitos y retazos, y las pantallas de stock agrupan por ese nombre.
 */
export async function updateMaterial(
  id: string,
  patch: {
    codigo?: string | null;
    familia?: string | null;
    espesor_mm?: number | null;
    peso_por_m2_kg?: number | null;
    material_kind?: MaterialKindDb;
    uso?: "piedra" | "producto";
  },
): Promise<{ data: MaterialWizardRow | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }
  const update: MaterialUpdate = {};
  if (patch.codigo !== undefined) update.codigo = patch.codigo?.trim() || null;
  if (patch.familia !== undefined) update.familia = patch.familia?.trim() || null;
  if (patch.espesor_mm !== undefined) update.espesor_mm = patch.espesor_mm;
  if (patch.peso_por_m2_kg !== undefined) update.peso_por_m2_kg = patch.peso_por_m2_kg;
  if (patch.material_kind !== undefined) update.material_kind = patch.material_kind;
  if (patch.uso !== undefined) update.uso = patch.uso;

  const { data, error } = await supabase
    .from("materials")
    .update(update)
    .eq("id", id)
    .select(MATERIAL_SELECT)
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: materialRowToWizard(data as MaterialRow), error: null };
}

export type StockResumenMaterial = {
  estado: string;
  cantidad: number;
  m2: number;
};

/** Planchas de una piedra agrupadas por estado, con sus m². */
export async function fetchStockResumenMaterial(materialId: string): Promise<{
  data: StockResumenMaterial[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }
  const { data, error } = await supabase
    .from("chapas_inventario")
    .select("estado, largo_cm, ancho_cm")
    .eq("material_id", materialId);
  if (error) return { data: [], error: new Error(error.message) };

  const porEstado = new Map<string, StockResumenMaterial>();
  for (const row of data ?? []) {
    const estado = String(row.estado);
    const m2 = (Number(row.largo_cm) * Number(row.ancho_cm)) / 10000;
    const acc = porEstado.get(estado) ?? { estado, cantidad: 0, m2: 0 };
    acc.cantidad += 1;
    acc.m2 += Number.isFinite(m2) ? m2 : 0;
    porEstado.set(estado, acc);
  }
  return { data: [...porEstado.values()], error: null };
}
