import type { Database } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type CanteraPurchaseUom = "KG" | "T";

export type RegisterCanteraLineInput = {
  material_id: string;
  quantity: number;
  purchase_uom: CanteraPurchaseUom;
  supplier_id?: string | null;
  receipt_ref?: string;
  notes?: string;
  issue_date?: string;
  largo_cm?: number | null;
  ancho_cm?: number | null;
  espesor_cm?: number | null;
  created_by?: string | null;
};

export type InventoryLoteListItem = {
  id: string;
  material_id: string;
  material_name: string | null;
  qty_kg_remaining: number;
  qty_kg_initial: number;
  purchase_uom: string;
  receipt_ref: string | null;
  notes: string | null;
  issue_date: string;
  supplier_name: string | null;
  created_at: string;
};

export type ConversionRowUi = {
  id: string;
  parent_material_id: string;
  child_material_id: string;
  child_name: string | null;
  kg_parent_per_m2_child: number;
  notes: string | null;
};

const demoLotesInternal: InventoryLoteListItem[] = [];

function qtyToKg(qty: number, uom: CanteraPurchaseUom): number {
  return uom === "T" ? qty * 1000 : qty;
}

async function insertLotesDirect(lines: RegisterCanteraLineInput[]): Promise<void> {
  for (const line of lines) {
    const qty_kg = qtyToKg(line.quantity, line.purchase_uom);
    const { error } = await supabase.from("lotes_cantera").insert({
      material_id: line.material_id,
      qty_kg_remaining: qty_kg,
      qty_kg_initial: qty_kg,
      purchase_uom: line.purchase_uom,
      supplier_id: line.supplier_id ?? null,
      receipt_ref: line.receipt_ref?.trim() || null,
      notes: line.notes?.trim() || null,
      issue_date:
        line.issue_date && line.issue_date.trim() !== ""
          ? line.issue_date
          : new Date().toISOString().slice(0, 10),
      largo_cm: line.largo_cm ?? null,
      ancho_cm: line.ancho_cm ?? null,
      espesor_cm: line.espesor_cm ?? null,
      created_by: line.created_by ?? null,
    });
    if (error) throw error;
  }
}

export async function registerCanteraIngreso(lines: RegisterCanteraLineInput[]): Promise<void> {
  if (lines.length === 0) return;

  if (!isSupabaseConfigured) {
    for (const line of lines) {
      const qty_kg = qtyToKg(line.quantity, line.purchase_uom);
      demoLotesInternal.unshift({
        id: `demo-${typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random()}`,
        material_id: line.material_id,
        material_name: null,
        qty_kg_remaining: qty_kg,
        qty_kg_initial: qty_kg,
        purchase_uom: line.purchase_uom,
        receipt_ref: line.receipt_ref?.trim() ?? null,
        notes: line.notes?.trim() ?? null,
        issue_date:
          line.issue_date && line.issue_date.trim() !== ""
            ? line.issue_date
            : new Date().toISOString().slice(0, 10),
        supplier_name: null,
        created_at: new Date().toISOString(),
      });
    }
    return;
  }

  const payload = {
    lines: lines.map((line) => ({
      material_id: line.material_id,
      quantity: line.quantity,
      purchase_uom: line.purchase_uom,
      supplier_id: line.supplier_id ?? null,
      receipt_ref: line.receipt_ref?.trim() ?? "",
      notes: line.notes?.trim() ?? "",
      issue_date: line.issue_date ?? "",
      largo_cm: line.largo_cm != null ? String(line.largo_cm) : "",
      ancho_cm: line.ancho_cm != null ? String(line.ancho_cm) : "",
      espesor_cm: line.espesor_cm != null ? String(line.espesor_cm) : "",
      created_by: line.created_by ?? null,
    })),
  };

  const { error: rpcError } = await supabase.rpc("register_cantera_ingreso", { p_payload: payload });
  if (!rpcError) return;

  try {
    await insertLotesDirect(lines);
  } catch (directErr) {
    console.error("[cantera] RPC falló e insert directo también:", rpcError, directErr);
    throw rpcError;
  }
}

export async function fetchInventoryLotesList(): Promise<InventoryLoteListItem[]> {
  if (!isSupabaseConfigured) return [...demoLotesInternal];

  const { data, error } = await supabase
    .from("lotes_cantera")
    .select(
      `
      id,
      material_id,
      qty_kg_remaining,
      qty_kg_initial,
      purchase_uom,
      receipt_ref,
      notes,
      issue_date,
      created_at,
      materials ( name ),
      suppliers ( name )
    `,
    )
    .order("created_at", { ascending: false });

  if (error && /lotes_cantera|does not exist|schema cache/i.test(error.message)) {
    return [...demoLotesInternal];
  }
  if (error) throw error;

  return (data ?? []).map((row: unknown) => {
    const r = row as {
      id: string;
      material_id: string;
      qty_kg_remaining: number;
      qty_kg_initial: number;
      purchase_uom: string;
      receipt_ref: string | null;
      notes: string | null;
      issue_date: string;
      created_at: string;
      materials: { name: string } | { name: string }[] | null;
      suppliers: { name: string | null } | { name: string | null }[] | null;
    };
    const m = r.materials;
    const materialName = Array.isArray(m) ? (m[0]?.name ?? null) : (m?.name ?? null);
    const s = r.suppliers;
    const supplierName = Array.isArray(s) ? (s[0]?.name ?? null) : (s?.name ?? null);
    return {
      id: r.id,
      material_id: r.material_id,
      material_name: materialName,
      qty_kg_remaining: r.qty_kg_remaining,
      qty_kg_initial: r.qty_kg_initial,
      purchase_uom: r.purchase_uom,
      receipt_ref: r.receipt_ref,
      notes: r.notes,
      issue_date: r.issue_date,
      supplier_name: supplierName,
      created_at: r.created_at,
    };
  });
}

export async function fetchMaterialConversionsByParent(
  parentMaterialId: string | null | undefined,
): Promise<ConversionRowUi[]> {
  if (!parentMaterialId || !isSupabaseConfigured) return [];

  const { data: rows, error } = await supabase
    .from("conversiones_materiales")
    .select("id,parent_material_id,child_material_id,kg_parent_per_m2_child,notes")
    .eq("parent_material_id", parentMaterialId);

  if (error && /conversiones_materiales|does not exist|schema cache/i.test(error.message)) {
    return [];
  }
  if (error) throw error;
  const list = (rows ?? []) as Omit<ConversionRowUi, "child_name">[];
  if (!list.length) return [];

  const childIds = [...new Set(list.map((x) => x.child_material_id))];
  const { data: mats, error: mErr } = await supabase
    .from("materials")
    .select("id,name")
    .in("id", childIds);

  const nameMap = new Map<string, string | null>((mErr ? [] : mats ?? []).map((m: { id: string; name: string }) => [m.id, m.name]));

  return list.map((r) => ({
    ...r,
    child_name: nameMap.get(r.child_material_id) ?? null,
  }));
}

export async function patchMaterialCatalogoCampos(params: {
  materialId: string;
  peso_por_m2_kg?: number | null;
  material_kind?: Database["public"]["Enums"]["material_kind"];
}): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Sin base de datos: no se puede guardar el maestro.");
  }
  const patch: Database["public"]["Tables"]["materials"]["Update"] = {};
  if (params.peso_por_m2_kg !== undefined) patch.peso_por_m2_kg = params.peso_por_m2_kg;
  if (params.material_kind !== undefined) patch.material_kind = params.material_kind;
  const { error } = await supabase.from("materials").update(patch).eq("id", params.materialId);
  if (error) throw error;
}
