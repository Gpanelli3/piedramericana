import type { Database } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type OrigenPlaca = "nacional" | "importado" | "cantera" | "otro";
export type ModoMedidasRemito = "iguales" | "distintas";

export type RemitoMedidaChapa = {
  largo_cm: number;
  ancho_cm: number;
};

export type ChapaRow = {
  id?: string;
  bulto: string;
  material: string;
  materialId?: string | null;
  largoCm: number;
  anchoCm: number;
  espesorCm?: number | null;
  estado: "Disponible" | "Reservada" | "Usada" | "Baja";
  loteCodigo?: string | null;
  otReservaId?: string | null;
  motivoEstado?: string | null;
  origenPlaca?: OrigenPlaca | null;
  chapaOrigenId?: string | null;
};

export type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];
export type RemitoRow = Database["public"]["Tables"]["remitos"]["Row"];
export type StockScrapRow = Database["public"]["Tables"]["stock_scraps"]["Row"];
export type RemitoLineDetail = Database["public"]["Tables"]["remito_lines"]["Row"];

type SupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];
type ScrapInsert = Database["public"]["Tables"]["stock_scraps"]["Insert"];

/** Inventario inicial si Supabase no está configurado */
export const STOCK_CHAPAS_INICIAL: ChapaRow[] = [
  { bulto: "#8890", material: "Granito Negro Brasil Extra 20mm", largoCm: 320, anchoCm: 180, estado: "Disponible" },
  { bulto: "#8891", material: "Silestone Blanco Stellar", largoCm: 305, anchoCm: 140, estado: "Disponible" },
  { bulto: "#8876", material: "Cuarcita Blue Roma", largoCm: 290, anchoCm: 165, estado: "Reservada" },
  { bulto: "#8850", material: "Dekton TRILIUM 12mm", largoCm: 320, anchoCm: 145, estado: "Disponible" },
  { bulto: "#8851", material: "Dekton TRILIUM 12mm", largoCm: 300, anchoCm: 150, estado: "Reservada" },
  { bulto: "#8845", material: "Granito Black Cosmic Leather 20mm", largoCm: 310, anchoCm: 175, estado: "Disponible" },
];

export function slabRowToChapa(row: {
  id: string;
  bulto: string;
  material_label: string;
  material_id?: string | null;
  largo_cm: number;
  ancho_cm: number;
  espesor_cm?: number | null;
  estado: ChapaRow["estado"];
  lote_codigo?: string | null;
  ot_reserva_id?: string | null;
  motivo_estado?: string | null;
  origen_placa?: OrigenPlaca | null;
  chapa_origen_id?: string | null;
}): ChapaRow {
  return {
    id: row.id,
    bulto: row.bulto,
    material: row.material_label,
    materialId: row.material_id ?? null,
    largoCm: Number(row.largo_cm),
    anchoCm: Number(row.ancho_cm),
    espesorCm: row.espesor_cm != null ? Number(row.espesor_cm) : null,
    estado: row.estado,
    loteCodigo: row.lote_codigo ?? null,
    otReservaId: row.ot_reserva_id ?? null,
    motivoEstado: row.motivo_estado ?? null,
    origenPlaca: row.origen_placa ?? null,
    chapaOrigenId: row.chapa_origen_id ?? null,
  };
}

export async function fetchInventorySlabs(): Promise<ChapaRow[]> {
  if (!isSupabaseConfigured) return [...STOCK_CHAPAS_INICIAL];
  const { data, error } = await supabase
    .from("chapas_inventario")
    .select(
      "id,bulto,material_id,material_label,largo_cm,ancho_cm,espesor_cm,estado,lote_codigo,ot_reserva_id,motivo_estado,origen_placa,chapa_origen_id,created_at",
    )
    .order("created_at", { ascending: false });
  if (error) {
    // Columna espesor_cm aún no aplicada
    const fallback = await supabase
      .from("chapas_inventario")
      .select(
        "id,bulto,material_id,material_label,largo_cm,ancho_cm,estado,lote_codigo,ot_reserva_id,motivo_estado,origen_placa,chapa_origen_id,created_at",
      )
      .order("created_at", { ascending: false });
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((r) =>
      slabRowToChapa({
        id: r.id,
        bulto: r.bulto,
        material_label: r.material_label,
        material_id: r.material_id,
        largo_cm: Number(r.largo_cm),
        ancho_cm: Number(r.ancho_cm),
        estado: r.estado as ChapaRow["estado"],
        lote_codigo: r.lote_codigo,
        ot_reserva_id: r.ot_reserva_id,
        motivo_estado: r.motivo_estado,
        origen_placa: (r as { origen_placa?: OrigenPlaca }).origen_placa ?? null,
        chapa_origen_id: r.chapa_origen_id ?? null,
      }),
    );
  }
  return (data ?? []).map((r) =>
    slabRowToChapa({
      id: r.id,
      bulto: r.bulto,
      material_label: r.material_label,
      material_id: r.material_id,
      largo_cm: Number(r.largo_cm),
      ancho_cm: Number(r.ancho_cm),
      espesor_cm: (r as { espesor_cm?: number | null }).espesor_cm ?? null,
      estado: r.estado as ChapaRow["estado"],
      lote_codigo: r.lote_codigo,
      ot_reserva_id: r.ot_reserva_id,
      motivo_estado: r.motivo_estado,
      origen_placa: (r as { origen_placa?: OrigenPlaca }).origen_placa ?? null,
      chapa_origen_id: r.chapa_origen_id ?? null,
    }),
  );
}

export async function fetchSuppliers(): Promise<SupplierRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function insertSupplier(
  payload: Omit<SupplierInsert, "id" | "created_at">,
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { data, error } = await supabase.from("suppliers").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

export type RemitoLineInput = {
  material_id?: string | null;
  material_label: string;
  qty_slabs: number;
  /** Requerido si modo_medidas = iguales */
  largo_cm?: number | null;
  /** Requerido si modo_medidas = iguales */
  ancho_cm?: number | null;
  bulto_numero_inicio: number;
  precio_unitario?: number | null;
  lote_codigo: string;
  origen_placa?: OrigenPlaca;
  sort_order?: number;
  modo_medidas?: ModoMedidasRemito;
  /** Requerido si modo_medidas = distintas; length === qty_slabs */
  medidas?: RemitoMedidaChapa[];
};

export type CreateRemitoPayload = {
  supplier_id: string;
  branch_code: string;
  serial_code: string;
  issue_date: string;
  notes?: string | null;
  origen_placa: OrigenPlaca;
  created_by?: string | null;
  importacion_id?: string | null;
  lines: RemitoLineInput[];
};

/** `remitos.created_by` FK → `usuarios.id` (no auth.users). Si no hay fila, null. */
async function resolveUsuariosCreatedBy(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("usuarios")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data?.id) return null;
  return data.id;
}

export async function createRemitoWithSlabsViaRpc(payload: CreateRemitoPayload): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  for (const l of payload.lines) {
    if (!l.lote_codigo?.trim()) {
      throw new Error("lote_codigo es obligatorio en cada línea de remito");
    }
    const modo: ModoMedidasRemito = l.modo_medidas ?? "iguales";
    if (modo === "iguales") {
      if (!(Number(l.largo_cm) > 0) || !(Number(l.ancho_cm) > 0)) {
        throw new Error("largo_cm y ancho_cm son obligatorios en modo medidas iguales");
      }
    } else {
      if (!l.medidas?.length || l.medidas.length !== l.qty_slabs) {
        throw new Error("En modo medidas distintas, medidas[] debe coincidir con qty_slabs");
      }
      for (const m of l.medidas) {
        if (!(m.largo_cm > 0) || !(m.ancho_cm > 0)) {
          throw new Error("Cada placa en medidas distintas necesita largo y ancho > 0");
        }
      }
    }
  }

  const createdBy = await resolveUsuariosCreatedBy(payload.created_by);

  const body = {
    supplier_id: payload.supplier_id,
    branch_code: payload.branch_code?.trim() ?? "",
    serial_code: payload.serial_code?.trim() ?? "",
    issue_date: payload.issue_date,
    notes: payload.notes?.slice(0, 200) ?? null,
    origen_placa: payload.origen_placa,
    created_by: createdBy,
    importacion_id: payload.importacion_id ?? null,
    lines: payload.lines.map((l, i) => {
      const modo: ModoMedidasRemito = l.modo_medidas ?? "iguales";
      return {
        material_id: l.material_id ?? null,
        material_label: l.material_label.trim(),
        qty_slabs: l.qty_slabs,
        largo_cm: modo === "iguales" ? l.largo_cm : null,
        ancho_cm: modo === "iguales" ? l.ancho_cm : null,
        bulto_numero_inicio: l.bulto_numero_inicio,
        precio_unitario: l.precio_unitario ?? null,
        lote_codigo: l.lote_codigo.trim(),
        origen_placa: l.origen_placa ?? payload.origen_placa,
        sort_order: l.sort_order ?? i,
        modo_medidas: modo,
        ...(modo === "distintas" && l.medidas ? { medidas: l.medidas } : {}),
      };
    }),
  };

  const { data, error } = await supabase.rpc("create_remito_with_slabs", {
    p_payload: body,
  });
  if (error) throw new Error(error.message || "No se pudo crear el remito");
  return data as string;
}

export type MaterialOption = Pick<
  Database["public"]["Tables"]["materials"]["Row"],
  | "id"
  | "name"
  | "unit"
  | "material_kind"
  | "peso_por_m2_kg"
  | "bulk_stock_kg"
  | "stock_qty"
  | "familia"
  | "codigo"
  | "costo_usd"
  | "espesor_mm"
>;

const DEFAULT_MAT_OPT = (
  r: Pick<Database["public"]["Tables"]["materials"]["Row"], "id" | "name" | "unit">,
): MaterialOption => ({
  ...r,
  material_kind: "marmol",
  peso_por_m2_kg: null,
  bulk_stock_kg: 0,
  stock_qty: 0,
  familia: null,
  codigo: null,
  costo_usd: null,
  espesor_mm: null,
});

export async function fetchMaterialsForStock(): Promise<MaterialOption[]> {
  if (!isSupabaseConfigured) return [];
  const ext = await supabase
    .from("materials")
    .select(
      "id,name,unit,material_kind,peso_por_m2_kg,bulk_stock_kg,stock_qty,familia,codigo,costo_usd,espesor_mm",
    )
    .order("name");
  if (ext.error) {
    const basic = await supabase.from("materials").select("id,name,unit").order("name");
    if (basic.error) throw basic.error;
    return (basic.data ?? []).map((r) => DEFAULT_MAT_OPT(r as { id: string; name: string; unit: string }));
  }
  return (ext.data ?? []).map((r) => ({
    ...(r as MaterialOption),
    costo_usd: r.costo_usd != null ? Number(r.costo_usd) : null,
    espesor_mm: r.espesor_mm != null ? Number(r.espesor_mm) : null,
  }));
}

export type RemitoListRow = RemitoRow & {
  supplier_name: string | null;
  total_slabs: number;
  total_m2: number;
};

type RemitoLineAgg = {
  qty_slabs: number;
  largo_cm: number | null;
  ancho_cm: number | null;
  m2_total?: number | null;
  modo_medidas?: ModoMedidasRemito | null;
};

function mapRemitosListRows(remitos: unknown[]): RemitoListRow[] {
  return remitos.map((raw) => {
    const r = raw as {
      remito_lines?: RemitoLineAgg[] | null;
      suppliers?: { name: string | null } | { name: string | null }[] | null;
    } & Omit<RemitoListRow, "supplier_name" | "total_slabs" | "total_m2">;
    const lines = r.remito_lines ?? [];
    let total_slabs = 0;
    let total_m2 = 0;
    for (const l of lines) {
      total_slabs += l.qty_slabs;
      if (l.m2_total != null && Number.isFinite(Number(l.m2_total))) {
        total_m2 += Number(l.m2_total);
      } else if (l.largo_cm != null && l.ancho_cm != null) {
        const m2piece = (Number(l.largo_cm) / 100) * (Number(l.ancho_cm) / 100);
        total_m2 += m2piece * l.qty_slabs;
      }
    }
    const sn = r.suppliers;
    const supplier_name = Array.isArray(sn) ? (sn[0]?.name ?? null) : (sn?.name ?? null);
    return {
      ...r,
      supplier_name,
      total_slabs,
      total_m2,
    };
  });
}

export async function fetchRemitosList(): Promise<RemitoListRow[]> {
  if (!isSupabaseConfigured) return [];
  const selectBase = `
      id,
      supplier_id,
      branch_code,
      serial_code,
      issue_date,
      notes,
      origen_placa,
      created_by,
      created_at,
      suppliers ( name ),
      remito_lines (
        qty_slabs,
        largo_cm,
        ancho_cm,
        m2_total,
        modo_medidas
      )
    `;
  const { data: remitos, error } = await supabase
    .from("remitos")
    .select(selectBase)
    .order("created_at", { ascending: false });
  if (error) {
    // Migración modo_medidas aún no aplicada
    const fallback = await supabase
      .from("remitos")
      .select(
        `
      id,
      supplier_id,
      branch_code,
      serial_code,
      issue_date,
      notes,
      origen_placa,
      created_by,
      created_at,
      suppliers ( name ),
      remito_lines (
        qty_slabs,
        largo_cm,
        ancho_cm
      )
    `,
      )
      .order("created_at", { ascending: false });
    if (fallback.error) throw fallback.error;
    return mapRemitosListRows(fallback.data ?? []);
  }

  return mapRemitosListRows(remitos ?? []);
}

export async function fetchRemitoLines(remitoId: string): Promise<RemitoLineDetail[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("remito_lines")
    .select("*")
    .eq("remito_id", remitoId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RemitoLineDetail[];
}

export type MaterialStockAgregado = {
  materialLabel: string;
  materialId: string | null;
  familia: string | null;
  codigo: string | null;
  costoUsdUnit: number | null;
  planchasDisponibles: number;
  planchasReservadas: number;
  planchasTotalActivas: number;
  m2Disponibles: number;
  m2Reservados: number;
  m2Retazo: number;
  retazosCount: number;
  costoUsdTotal: number | null;
};

function m2DeChapa(largoCm: number, anchoCm: number): number {
  return (largoCm / 100) * (anchoCm / 100);
}

export type MaterialCatalogLookup = {
  id: string;
  name: string;
  familia?: string | null;
  codigo?: string | null;
  costo_usd?: number | null;
};

/** Agrupa chapas locales por material (vista Stock / pickers). */
export function aggregateChapasPorMaterial(
  chapas: ChapaRow[],
  catalog?: MaterialCatalogLookup[],
): MaterialStockAgregado[] {
  const byId = new Map((catalog ?? []).map((m) => [m.id, m]));
  const byName = new Map(
    (catalog ?? []).map((m) => [m.name.trim().toLowerCase(), m]),
  );

  const map = new Map<string, MaterialStockAgregado>();
  for (const c of chapas) {
    const key = c.material.trim() || "Sin material";
    let row = map.get(key);
    if (!row) {
      const meta =
        (c.materialId ? byId.get(c.materialId) : undefined) ??
        byName.get(key.toLowerCase());
      const costoUnit =
        meta?.costo_usd != null && Number.isFinite(Number(meta.costo_usd))
          ? Number(meta.costo_usd)
          : null;
      row = {
        materialLabel: key,
        materialId: meta?.id ?? c.materialId ?? null,
        familia: meta?.familia?.trim() || null,
        codigo: meta?.codigo?.trim() || null,
        costoUsdUnit: costoUnit,
        planchasDisponibles: 0,
        planchasReservadas: 0,
        planchasTotalActivas: 0,
        m2Disponibles: 0,
        m2Reservados: 0,
        m2Retazo: 0,
        retazosCount: 0,
        costoUsdTotal: null,
      };
      map.set(key, row);
    }
    const m2 = m2DeChapa(c.largoCm, c.anchoCm);
    const esRetazo = Boolean(c.chapaOrigenId);
    if (c.estado === "Disponible") {
      row.planchasDisponibles += 1;
      row.planchasTotalActivas += 1;
      row.m2Disponibles += m2;
      if (esRetazo) {
        row.retazosCount += 1;
        row.m2Retazo += m2;
      }
    } else if (c.estado === "Reservada") {
      row.planchasReservadas += 1;
      row.planchasTotalActivas += 1;
      row.m2Reservados += m2;
    }
  }

  for (const row of map.values()) {
    row.costoUsdTotal =
      row.costoUsdUnit != null ? row.costoUsdUnit * row.m2Disponibles : null;
  }

  return [...map.values()].sort((a, b) =>
    a.materialLabel.localeCompare(b.materialLabel, "es"),
  );
}

export async function fetchStockAgregadoPorMaterial(): Promise<MaterialStockAgregado[]> {
  const [chapas, materials] = await Promise.all([
    fetchInventorySlabs(),
    fetchMaterialsForStock(),
  ]);
  return aggregateChapasPorMaterial(chapas, materials);
}

export type CreateManualSlabsPayload = {
  material_id: string;
  material_label?: string;
  modo_medidas?: "iguales" | "distintas";
  /** Modo iguales */
  qty_slabs?: number;
  largo_cm?: number;
  ancho_cm?: number;
  espesor_cm?: number | null;
  /** Modo distintas: una fila por plancha */
  medidas?: Array<{
    largo_cm: number;
    ancho_cm: number;
    espesor_cm?: number | null;
  }>;
  lote_codigo?: string | null;
  costo_usd?: number | null;
  origen_placa?: OrigenPlaca;
  notes?: string | null;
  created_by?: string | null;
};

export async function createManualSlabs(payload: CreateManualSlabsPayload): Promise<number> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase no está configurado");
  }
  const modo = payload.modo_medidas ?? "iguales";
  const body =
    modo === "distintas"
      ? {
          material_id: payload.material_id,
          material_label: payload.material_label ?? "",
          modo_medidas: "distintas",
          medidas: (payload.medidas ?? []).map((m) => ({
            largo_cm: m.largo_cm,
            ancho_cm: m.ancho_cm,
            espesor_cm: m.espesor_cm ?? null,
          })),
          lote_codigo: payload.lote_codigo ?? null,
          costo_usd: payload.costo_usd ?? null,
          origen_placa: payload.origen_placa ?? "otro",
          notes: payload.notes ?? null,
          created_by: payload.created_by ?? null,
        }
      : {
          material_id: payload.material_id,
          material_label: payload.material_label ?? "",
          modo_medidas: "iguales",
          qty_slabs: payload.qty_slabs ?? 1,
          largo_cm: payload.largo_cm ?? 0,
          ancho_cm: payload.ancho_cm ?? 0,
          espesor_cm: payload.espesor_cm ?? null,
          lote_codigo: payload.lote_codigo ?? null,
          costo_usd: payload.costo_usd ?? null,
          origen_placa: payload.origen_placa ?? "otro",
          notes: payload.notes ?? null,
          created_by: payload.created_by ?? null,
        };
  const { data, error } = await supabase.rpc("create_manual_slabs", {
    p_payload: body,
  });
  if (error) throw new Error(error.message || "No se pudo cargar las planchas");
  return Number(data ?? 0);
}

export type BachaClienteRow = Database["public"]["Tables"]["bachas_clientes"]["Row"];
type BachaClienteInsert = Database["public"]["Tables"]["bachas_clientes"]["Insert"];

export async function fetchBachasClientes(): Promise<BachaClienteRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("bachas_clientes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BachaClienteRow[];
}

export async function createBachaCliente(
  input: Omit<BachaClienteInsert, "id" | "created_at">,
): Promise<BachaClienteRow> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase no está configurado");
  }
  const { data, error } = await supabase
    .from("bachas_clientes")
    .insert({
      cliente_nombre: input.cliente_nombre.trim(),
      modelo: input.modelo?.trim() || null,
      estado: input.estado ?? "pendiente",
      ubicacion: input.ubicacion?.trim() || null,
      ot_id: input.ot_id ?? null,
      notas: input.notas?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message || "No se pudo registrar la bacha");
  return data as BachaClienteRow;
}

export async function updateBachaClienteEstado(
  id: string,
  estado: BachaClienteRow["estado"],
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from("bachas_clientes")
    .update({ estado })
    .eq("id", id);
  if (error) throw new Error(error.message || "No se pudo actualizar la bacha");
}

export async function fetchSlabsByMaterialLabel(label: string): Promise<ChapaRow[]> {
  if (!isSupabaseConfigured) return STOCK_CHAPAS_INICIAL.filter((c) => c.material === label);
  const { data, error } = await supabase
    .from("chapas_inventario")
    .select(
      "id,bulto,material_label,largo_cm,ancho_cm,estado,lote_codigo,ot_reserva_id,motivo_estado,origen_placa,created_at",
    )
    .eq("material_label", label)
    .order("bulto", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) =>
    slabRowToChapa({
      id: r.id,
      bulto: r.bulto,
      material_label: r.material_label,
      largo_cm: Number(r.largo_cm),
      ancho_cm: Number(r.ancho_cm),
      estado: r.estado as ChapaRow["estado"],
      lote_codigo: r.lote_codigo,
      ot_reserva_id: r.ot_reserva_id,
      motivo_estado: r.motivo_estado,
      origen_placa: (r as { origen_placa?: OrigenPlaca }).origen_placa ?? null,
    }),
  );
}

export async function fetchScrapsByMaterialLabel(label: string): Promise<StockScrapRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("stock_scraps")
    .select("*")
    .eq("material_label", label)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StockScrapRow[];
}

export async function insertStockScraps(rows: ScrapInsert[]): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  if (rows.length === 0) return;
  const { error } = await supabase.from("stock_scraps").insert(rows);
  if (error) throw error;
}

export async function countScrapsSince(startIso: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const { count, error } = await supabase
    .from("stock_scraps")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startIso);
  if (error) throw error;
  return count ?? 0;
}

/** FIFO: primera chapa disponible que contenga la aguja en material_label */
export async function deleteFirstAvailableSlabMatching(needle: string): Promise<{ removed: boolean; bulto?: string }> {
  if (!isSupabaseConfigured) return { removed: false };
  const needleSafe = needle.trim();
  if (!needleSafe) return { removed: false };

  const { data: row, error: selErr } = await supabase
    .from("chapas_inventario")
    .select("id,bulto")
    .eq("estado", "Disponible")
    .ilike("material_label", `%${needleSafe}%`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selErr) throw selErr;
  if (!row) return { removed: false };

  const { error: delErr } = await supabase.from("chapas_inventario").delete().eq("id", row.id);
  if (delErr) throw delErr;
  return { removed: true, bulto: row.bulto };
}
