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

export type ProcesamientoLineInput = {
  material_producto_id: string;
  cantidad: number;
};

export type RegisterCanteraProcesamientoInput = {
  lote_id: string;
  qty_kg_consumidos: number;
  issue_date?: string;
  notes?: string;
  created_by?: string | null;
  lines: ProcesamientoLineInput[];
};

export type ProcesamientoLineListItem = {
  id: string;
  material_producto_id: string;
  material_producto_name: string | null;
  cantidad: number;
  unit: string;
};

export type ProcesamientoListItem = {
  id: string;
  lote_id: string;
  material_bruto_id: string;
  material_bruto_name: string | null;
  qty_kg_consumidos: number;
  issue_date: string;
  notes: string | null;
  created_at: string;
  lineas: ProcesamientoLineListItem[];
};

const demoLotesInternal: InventoryLoteListItem[] = [];
const demoProcesamientosInternal: ProcesamientoListItem[] = [];

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

export async function findOrCreateMaterialByName(
  name: string,
  unit: string = "u.",
): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre del producto no puede estar vacío");

  if (!isSupabaseConfigured) {
    return `demo-mat-${trimmed.toLowerCase().replace(/\s+/g, "-")}`;
  }

  const { data: existing, error: findErr } = await supabase
    .from("materials")
    .select("id")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing) return existing.id;

  // Producto de cantera (adoquines, granzas…): no se ofrece como piedra al presupuestar.
  const { data: created, error: createErr } = await supabase
    .from("materials")
    .insert({
      name: trimmed,
      unit,
      stock_qty: 0,
      bulk_stock_kg: 0,
      uso: "producto",
    })
    .select("id")
    .single();

  if (createErr) throw createErr;
  return created!.id;
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

async function registerCanteraProcesamientoDirect(input: RegisterCanteraProcesamientoInput): Promise<void> {
  const { data: lote, error: loteErr } = await supabase
    .from("lotes_cantera")
    .select("id,material_id,qty_kg_remaining")
    .eq("id", input.lote_id)
    .single();

  if (loteErr || !lote) throw loteErr ?? new Error("Lote no encontrado");
  if (lote.qty_kg_remaining < input.qty_kg_consumidos) {
    throw new Error(`Kg insuficientes en el lote (restante: ${lote.qty_kg_remaining})`);
  }

  const { error: loteUpdErr } = await supabase
    .from("lotes_cantera")
    .update({ qty_kg_remaining: lote.qty_kg_remaining - input.qty_kg_consumidos })
    .eq("id", input.lote_id);
  if (loteUpdErr) throw loteUpdErr;

  const { data: brutoMat, error: brutoErr } = await supabase
    .from("materials")
    .select("bulk_stock_kg")
    .eq("id", lote.material_id)
    .single();
  if (brutoErr || !brutoMat) throw brutoErr ?? new Error("Material bruto no encontrado");

  const { error: bulkErr } = await supabase
    .from("materials")
    .update({
      bulk_stock_kg: Math.max((brutoMat.bulk_stock_kg ?? 0) - input.qty_kg_consumidos, 0),
    })
    .eq("id", lote.material_id);
  if (bulkErr) throw bulkErr;

  const issueDate =
    input.issue_date && input.issue_date.trim() !== ""
      ? input.issue_date
      : new Date().toISOString().slice(0, 10);

  const { data: proc, error: procErr } = await supabase
    .from("procesamientos_cantera")
    .insert({
      lote_id: input.lote_id,
      material_bruto_id: lote.material_id,
      qty_kg_consumidos: input.qty_kg_consumidos,
      issue_date: issueDate,
      notes: input.notes?.trim() || null,
      created_by: input.created_by ?? null,
    })
    .select("id")
    .single();
  if (procErr || !proc) throw procErr ?? new Error("No se pudo crear el procesamiento");

  for (const line of input.lines) {
    const { data: prodMat, error: prodErr } = await supabase
      .from("materials")
      .select("unit,stock_qty")
      .eq("id", line.material_producto_id)
      .single();
    if (prodErr || !prodMat) throw prodErr ?? new Error("Material producto no encontrado");

    const { error: stockErr } = await supabase
      .from("materials")
      .update({ stock_qty: (prodMat.stock_qty ?? 0) + line.cantidad })
      .eq("id", line.material_producto_id);
    if (stockErr) throw stockErr;

    const { error: lineErr } = await supabase.from("procesamiento_lineas").insert({
      procesamiento_id: proc.id,
      material_producto_id: line.material_producto_id,
      cantidad: line.cantidad,
      unit: prodMat.unit,
    });
    if (lineErr) throw lineErr;
  }
}

export async function registerCanteraProcesamiento(input: RegisterCanteraProcesamientoInput): Promise<void> {
  if (input.lines.length === 0) {
    throw new Error("Se requiere al menos una línea de producto");
  }
  if (!(input.qty_kg_consumidos > 0)) {
    throw new Error("Los kg consumidos deben ser mayores a 0");
  }

  if (!isSupabaseConfigured) {
    const lote = demoLotesInternal.find((l) => l.id === input.lote_id);
    if (!lote) throw new Error("Lote no encontrado");
    if (lote.qty_kg_remaining < input.qty_kg_consumidos) {
      throw new Error(`Kg insuficientes en el lote (restante: ${lote.qty_kg_remaining})`);
    }
    lote.qty_kg_remaining -= input.qty_kg_consumidos;

    const procId = `demo-proc-${typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random()}`;
    demoProcesamientosInternal.unshift({
      id: procId,
      lote_id: input.lote_id,
      material_bruto_id: lote.material_id,
      material_bruto_name: lote.material_name,
      qty_kg_consumidos: input.qty_kg_consumidos,
      issue_date:
        input.issue_date && input.issue_date.trim() !== ""
          ? input.issue_date
          : new Date().toISOString().slice(0, 10),
      notes: input.notes?.trim() ?? null,
      created_at: new Date().toISOString(),
      lineas: input.lines.map((ln, i) => ({
        id: `${procId}-line-${i}`,
        material_producto_id: ln.material_producto_id,
        material_producto_name: null,
        cantidad: ln.cantidad,
        unit: "UNI",
      })),
    });
    return;
  }

  const payload = {
    lote_id: input.lote_id,
    qty_kg_consumidos: input.qty_kg_consumidos,
    issue_date: input.issue_date ?? "",
    notes: input.notes?.trim() ?? "",
    created_by: input.created_by ?? null,
    lines: input.lines.map((line) => ({
      material_producto_id: line.material_producto_id,
      cantidad: line.cantidad,
    })),
  };

  const { error: rpcError } = await supabase.rpc("register_cantera_procesamiento", { p_payload: payload });
  if (!rpcError) return;

  try {
    await registerCanteraProcesamientoDirect(input);
  } catch (directErr) {
    console.error("[cantera] RPC procesamiento falló e insert directo también:", rpcError, directErr);
    throw rpcError;
  }
}

export async function fetchProcesamientosRecientes(limit = 20): Promise<ProcesamientoListItem[]> {
  if (!isSupabaseConfigured) return [...demoProcesamientosInternal].slice(0, limit);

  const { data, error } = await supabase
    .from("procesamientos_cantera")
    .select(
      `
      id,
      lote_id,
      material_bruto_id,
      qty_kg_consumidos,
      issue_date,
      notes,
      created_at,
      material_bruto:materials!procesamientos_cantera_material_bruto_id_fkey ( name ),
      procesamiento_lineas (
        id,
        material_producto_id,
        cantidad,
        unit,
        material_producto:materials!procesamiento_lineas_material_producto_id_fkey ( name )
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error && /procesamientos_cantera|does not exist|schema cache/i.test(error.message)) {
    return [...demoProcesamientosInternal].slice(0, limit);
  }
  if (error) throw error;

  return (data ?? []).map((row: unknown) => {
    const r = row as {
      id: string;
      lote_id: string;
      material_bruto_id: string;
      qty_kg_consumidos: number;
      issue_date: string;
      notes: string | null;
      created_at: string;
      material_bruto: { name: string } | { name: string }[] | null;
      procesamiento_lineas: Array<{
        id: string;
        material_producto_id: string;
        cantidad: number;
        unit: string;
        material_producto: { name: string } | { name: string }[] | null;
      }> | null;
    };
    const bruto = r.material_bruto;
    const brutoName = Array.isArray(bruto) ? (bruto[0]?.name ?? null) : (bruto?.name ?? null);
    return {
      id: r.id,
      lote_id: r.lote_id,
      material_bruto_id: r.material_bruto_id,
      material_bruto_name: brutoName,
      qty_kg_consumidos: r.qty_kg_consumidos,
      issue_date: r.issue_date,
      notes: r.notes,
      created_at: r.created_at,
      lineas: (r.procesamiento_lineas ?? []).map((ln) => {
        const prod = ln.material_producto;
        const prodName = Array.isArray(prod) ? (prod[0]?.name ?? null) : (prod?.name ?? null);
        return {
          id: ln.id,
          material_producto_id: ln.material_producto_id,
          material_producto_name: prodName,
          cantidad: ln.cantidad,
          unit: ln.unit,
        };
      }),
    };
  });
}
