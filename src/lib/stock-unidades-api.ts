import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type StockProductoUnidad = {
  material_id: string;
  name: string;
  unit: string;
  qty_disponible: number;
  qty_reservada: number;
};

export type OtStockUnidadRow = {
  id: string;
  ot_id: string;
  material_id: string;
  qty_reservada: number;
  qty_consumida: number;
  name: string;
  unit: string;
};

function asNum(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function rpcMessage(err: { message?: string } | null | undefined, fallback: string) {
  return err?.message?.trim() || fallback;
}

/** Productos con stock disponible o reservas abiertas (no planchas). */
export async function listStockProductosUnidades(): Promise<{
  data: StockProductoUnidad[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured) return { data: [], error: null };

  const [mats, reservas] = await Promise.all([
    supabase.from("materials").select("id,name,unit,stock_qty"),
    supabase.from("ot_stock_unidades").select("material_id,qty_reservada").gt("qty_reservada", 0),
  ]);

  if (mats.error) return { data: [], error: new Error(mats.error.message) };
  if (reservas.error) return { data: [], error: new Error(reservas.error.message) };

  const reservadoPorMaterial = new Map<string, number>();
  for (const r of reservas.data ?? []) {
    const id = r.material_id as string;
    reservadoPorMaterial.set(id, (reservadoPorMaterial.get(id) ?? 0) + asNum(r.qty_reservada));
  }

  const byId = new Map<string, StockProductoUnidad>();
  for (const m of mats.data ?? []) {
    const disponible = asNum(m.stock_qty);
    const reservada = reservadoPorMaterial.get(m.id) ?? 0;
    if (disponible <= 0 && reservada <= 0) continue;
    byId.set(m.id, {
      material_id: m.id,
      name: m.name,
      unit: m.unit?.trim() || "u.",
      qty_disponible: disponible,
      qty_reservada: reservada,
    });
  }

  for (const [id, qty] of reservadoPorMaterial) {
    if (byId.has(id)) continue;
    const mat = (mats.data ?? []).find((m) => m.id === id);
    byId.set(id, {
      material_id: id,
      name: mat?.name ?? "Producto",
      unit: mat?.unit?.trim() || "u.",
      qty_disponible: asNum(mat?.stock_qty),
      qty_reservada: qty,
    });
  }

  const data = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { data, error: null };
}

export async function listOtStockUnidades(
  otId: string,
): Promise<{ data: OtStockUnidadRow[]; error: Error | null }> {
  if (!isSupabaseConfigured) return { data: [], error: null };

  const { data, error } = await supabase
    .from("ot_stock_unidades")
    .select("id,ot_id,material_id,qty_reservada,qty_consumida,materials ( name, unit )")
    .eq("ot_id", otId)
    .order("created_at", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };

  const rows: OtStockUnidadRow[] = (data ?? []).map((row) => {
    const mat = (
      row as unknown as {
        materials: { name: string; unit: string } | { name: string; unit: string }[] | null;
      }
    ).materials;
    const m = Array.isArray(mat) ? mat[0] : mat;
    return {
      id: row.id,
      ot_id: row.ot_id,
      material_id: row.material_id,
      qty_reservada: asNum(row.qty_reservada),
      qty_consumida: asNum(row.qty_consumida),
      name: m?.name ?? "Producto",
      unit: m?.unit?.trim() || "u.",
    };
  });

  return { data: rows, error: null };
}

export async function reservarOtStockUnidades(opts: {
  otId: string;
  materialId: string;
  qty: number;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no configurado.") };
  if (!(opts.qty > 0)) return { error: new Error("La cantidad a reservar debe ser mayor a 0.") };

  const { error } = await supabase.rpc("reservar_ot_stock_unidades", {
    p_ot_id: opts.otId,
    p_material_id: opts.materialId,
    p_qty: opts.qty,
    p_created_by: opts.created_by ?? null,
  });
  if (error) return { error: new Error(rpcMessage(error, "No se pudo reservar el producto.")) };
  return { error: null };
}

export async function consumirOtStockUnidades(opts: {
  otId: string;
  materialId: string;
  qty?: number | null;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no configurado.") };

  const { error } = await supabase.rpc("consumir_ot_stock_unidades", {
    p_ot_id: opts.otId,
    p_material_id: opts.materialId,
    p_qty: opts.qty ?? null,
    p_created_by: opts.created_by ?? null,
  });
  if (error) return { error: new Error(rpcMessage(error, "No se pudo consumir el producto.")) };
  return { error: null };
}

export async function liberarOtStockUnidades(opts: {
  otId: string;
  materialId: string;
  qty?: number | null;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no configurado.") };

  const { error } = await supabase.rpc("liberar_ot_stock_unidades", {
    p_ot_id: opts.otId,
    p_material_id: opts.materialId,
    p_qty: opts.qty ?? null,
    p_created_by: opts.created_by ?? null,
  });
  if (error) return { error: new Error(rpcMessage(error, "No se pudo liberar el producto.")) };
  return { error: null };
}

export function formatQtyUnidad(n: number, unit: string): string {
  const qty = n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  return `${qty} ${unit.trim() || "u."}`;
}

export type ProductoOtUso = {
  ot_id: string;
  ot_titulo: string;
  qty_reservada: number;
  qty_consumida: number;
};

export type ProductoMovimiento = {
  id: string;
  tipo: "reserva" | "liberacion" | "consumo" | "baja" | "retazo_alta";
  detalle: string | null;
  created_at: string;
  ot_id: string | null;
  ot_titulo: string | null;
};

export type StockProductoDetalle = {
  ots: ProductoOtUso[];
  movimientos: ProductoMovimiento[];
  qty_consumida: number;
};

function otTituloFromJoin(
  raw:
    | { titulo?: string | null }
    | { titulo?: string | null }[]
    | null
    | undefined,
): string {
  const ot = Array.isArray(raw) ? raw[0] : raw;
  return ot?.titulo?.trim() || "OT";
}

export async function getStockProductoDetalle(materialId: string): Promise<{
  data: StockProductoDetalle;
  error: Error | null;
}> {
  const empty: StockProductoDetalle = { ots: [], movimientos: [], qty_consumida: 0 };
  if (!isSupabaseConfigured) return { data: empty, error: null };

  const { data: usos, error: usosErr } = await supabase
    .from("ot_stock_unidades")
    .select("ot_id,qty_reservada,qty_consumida,ordenes_trabajo ( titulo )")
    .eq("material_id", materialId)
    .order("updated_at", { ascending: false });

  if (usosErr) return { data: empty, error: new Error(usosErr.message) };

  const ots: ProductoOtUso[] = (usos ?? []).map((row) => ({
    ot_id: row.ot_id,
    ot_titulo: otTituloFromJoin(
      (row as { ordenes_trabajo?: { titulo?: string | null } | { titulo?: string | null }[] | null })
        .ordenes_trabajo,
    ),
    qty_reservada: asNum(row.qty_reservada),
    qty_consumida: asNum(row.qty_consumida),
  }));

  const qty_consumida = ots.reduce((acc, r) => acc + r.qty_consumida, 0);
  const otIds = [...new Set(ots.map((o) => o.ot_id))];
  const tituloByOt = new Map(ots.map((o) => [o.ot_id, o.ot_titulo]));

  if (otIds.length === 0) {
    return { data: { ots, movimientos: [], qty_consumida }, error: null };
  }

  const { data: mat } = await supabase.from("materials").select("name").eq("id", materialId).maybeSingle();
  const nombre = (mat?.name ?? "").trim();

  const { data: movs, error: movErr } = await supabase
    .from("stock_movimientos")
    .select("id,tipo,detalle,created_at,ot_id")
    .in("ot_id", otIds)
    .is("chapa_id", null)
    .order("created_at", { ascending: false })
    .limit(80);

  if (movErr) return { data: { ots, movimientos: [], qty_consumida }, error: new Error(movErr.message) };

  const movimientos: ProductoMovimiento[] = (movs ?? [])
    .filter((m) => !nombre || (m.detalle ?? "").startsWith(nombre))
    .slice(0, 40)
    .map((m) => ({
      id: m.id,
      tipo: m.tipo as ProductoMovimiento["tipo"],
      detalle: m.detalle,
      created_at: m.created_at,
      ot_id: m.ot_id,
      ot_titulo: m.ot_id ? tituloByOt.get(m.ot_id) ?? null : null,
    }));

  return { data: { ots, movimientos, qty_consumida }, error: null };
}
