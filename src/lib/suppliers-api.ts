import type { Database } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];
type SupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];
type SupplierUpdate = Database["public"]["Tables"]["suppliers"]["Update"];

export type SupplierOrigen = SupplierRow["origen"];

export const RUBROS_PROVEEDOR = [
  { value: "placas_naturales", label: "Placas naturales" },
  { value: "placas_industriales", label: "Placas industriales" },
  { value: "piedra_kg", label: "Piedra por kg" },
  { value: "otros", label: "Otros" },
] as const;

export const ORIGENES_PROVEEDOR = [
  { value: "nacional", label: "Nacional" },
  { value: "exterior", label: "Exterior" },
  { value: "propio", label: "Cantera propia" },
] as const;

export const CONDICIONES_IVA = [
  "Responsable Inscripto",
  "Monotributo",
  "Exento",
  "No Inscripto",
  "Consumidor Final",
] as const;

export function rubroLabel(v: string): string {
  return RUBROS_PROVEEDOR.find((r) => r.value === v)?.label ?? v;
}

export function origenLabel(v: string): string {
  return ORIGENES_PROVEEDOR.find((o) => o.value === v)?.label ?? v;
}

export async function fetchSuppliers(): Promise<SupplierRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("activo", { ascending: false })
    .order("name");
  if (error) {
    const fallback = await supabase
      .from("suppliers")
      .select("*")
      .order("name");
    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []).map((r) => ({
      ...r,
      rubros: r.rubros ?? [],
      origen: r.origen ?? "nacional",
      pais: r.pais ?? null,
      contact_name: r.contact_name ?? null,
      notes: r.notes ?? null,
      activo: r.activo ?? true,
    }));
  }
  return data ?? [];
}

export async function insertSupplier(
  payload: Omit<SupplierInsert, "id" | "created_at">,
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { data, error } = await supabase.from("suppliers").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateSupplier(
  id: string,
  payload: Omit<SupplierUpdate, "id" | "created_at">,
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { error } = await supabase.from("suppliers").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSupplier(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type SupplierRemitoRow = {
  id: string;
  branch_code: string;
  serial_code: string;
  issue_date: string;
  notes: string | null;
  origen_placa: string;
  created_at: string;
  total_slabs: number;
  total_m2: number;
};

export type SupplierLoteRow = {
  id: string;
  material_name: string;
  qty_kg_initial: number;
  qty_kg_remaining: number;
  purchase_uom: string;
  issue_date: string;
  receipt_ref: string | null;
  created_at: string;
};

export type SupplierMovimientoRow = {
  id: string;
  tipo: string;
  monto: number;
  moneda: string;
  fecha: string;
  metodo: string;
  concepto: string | null;
  descripcion: string | null;
  created_at: string;
};

export type SupplierActividad = {
  remitos: SupplierRemitoRow[];
  lotes: SupplierLoteRow[];
  movimientos: SupplierMovimientoRow[];
  totalesEgresos: { ars: number; usd: number };
};

export async function fetchSupplierActividad(supplierId: string): Promise<SupplierActividad> {
  const empty: SupplierActividad = {
    remitos: [],
    lotes: [],
    movimientos: [],
    totalesEgresos: { ars: 0, usd: 0 },
  };
  if (!isSupabaseConfigured) return empty;

  const [remitosRes, lotesRes, movsRes] = await Promise.all([
    supabase
      .from("remitos")
      .select(
        `id, branch_code, serial_code, issue_date, notes, origen_placa, created_at,
         remito_lines ( qty_slabs, largo_cm, ancho_cm, m2_total )`,
      )
      .eq("supplier_id", supplierId)
      .order("issue_date", { ascending: false }),

    supabase
      .from("lotes_cantera")
      .select(`id, qty_kg_initial, qty_kg_remaining, purchase_uom, issue_date, receipt_ref, created_at, materials ( name )`)
      .eq("supplier_id", supplierId)
      .order("issue_date", { ascending: false }),

    supabase
      .from("movimientos_caja")
      .select("id, tipo, monto, moneda, fecha, metodo, concepto, descripcion, created_at")
      .eq("supplier_id", supplierId)
      .order("fecha", { ascending: false }),
  ]);

  const remitos: SupplierRemitoRow[] = (remitosRes.data ?? []).map((raw: unknown) => {
    const r = raw as {
      id: string;
      branch_code: string;
      serial_code: string;
      issue_date: string;
      notes: string | null;
      origen_placa: string;
      created_at: string;
      remito_lines?: { qty_slabs: number; largo_cm: number | null; ancho_cm: number | null; m2_total?: number | null }[];
    };
    let total_slabs = 0;
    let total_m2 = 0;
    for (const l of r.remito_lines ?? []) {
      total_slabs += l.qty_slabs;
      if (l.m2_total != null && Number.isFinite(Number(l.m2_total))) {
        total_m2 += Number(l.m2_total);
      } else if (l.largo_cm != null && l.ancho_cm != null) {
        total_m2 += (Number(l.largo_cm) / 100) * (Number(l.ancho_cm) / 100) * l.qty_slabs;
      }
    }
    return {
      id: r.id,
      branch_code: r.branch_code,
      serial_code: r.serial_code,
      issue_date: r.issue_date,
      notes: r.notes,
      origen_placa: r.origen_placa,
      created_at: r.created_at,
      total_slabs,
      total_m2,
    };
  });

  const lotes: SupplierLoteRow[] = (lotesRes.data ?? []).map((raw: unknown) => {
    const r = raw as {
      id: string;
      qty_kg_initial: number;
      qty_kg_remaining: number;
      purchase_uom: string;
      issue_date: string;
      receipt_ref: string | null;
      created_at: string;
      materials?: { name: string } | { name: string }[] | null;
    };
    const mat = r.materials;
    const material_name = Array.isArray(mat) ? (mat[0]?.name ?? "—") : (mat?.name ?? "—");
    return {
      id: r.id,
      material_name,
      qty_kg_initial: Number(r.qty_kg_initial),
      qty_kg_remaining: Number(r.qty_kg_remaining),
      purchase_uom: r.purchase_uom,
      issue_date: r.issue_date,
      receipt_ref: r.receipt_ref,
      created_at: r.created_at,
    };
  });

  const movimientos: SupplierMovimientoRow[] = (movsRes.data ?? []).map((r: unknown) => {
    const m = r as SupplierMovimientoRow;
    return { ...m, monto: Number(m.monto) };
  });

  let arsTotal = 0;
  let usdTotal = 0;
  for (const m of movimientos) {
    if (m.tipo === "egreso") {
      if (m.moneda === "ars") arsTotal += m.monto;
      else if (m.moneda === "usd") usdTotal += m.monto;
    }
  }

  return {
    remitos,
    lotes,
    movimientos,
    totalesEgresos: { ars: arsTotal, usd: usdTotal },
  };
}
