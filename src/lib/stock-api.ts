import type { Database, InventorySlabEstado } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  bachaCorrespondeACliente,
  esBloqueoPorBacha,
} from "@/lib/bacha-reglas";

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
  estado: InventorySlabEstado;
  loteCodigo?: string | null;
  otReservaId?: string | null;
  motivoEstado?: string | null;
  origenPlaca?: OrigenPlaca | null;
  chapaOrigenId?: string | null;
  precioM2?: number | null;
};

export type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];
export type RemitoRow = Database["public"]["Tables"]["remitos"]["Row"];
export type StockScrapRow = Database["public"]["Tables"]["stock_scraps"]["Row"];
export type RemitoLineDetail = Database["public"]["Tables"]["remito_lines"]["Row"];

type SupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];
type ScrapInsert = Database["public"]["Tables"]["stock_scraps"]["Insert"];

/** Inventario inicial si Supabase no está configurado */
export const STOCK_CHAPAS_INICIAL: ChapaRow[] = [
  { bulto: "#8890", material: "Granito Negro Brasil Extra 20mm", largoCm: 320, anchoCm: 180, estado: "Disponible", precioM2: 95 },
  { bulto: "#8891", material: "Silestone Blanco Stellar", largoCm: 305, anchoCm: 140, estado: "Disponible", precioM2: 180 },
  { bulto: "#8876", material: "Cuarcita Blue Roma", largoCm: 290, anchoCm: 165, estado: "Reservada", precioM2: 210 },
  { bulto: "#8850", material: "Dekton TRILIUM 12mm", largoCm: 320, anchoCm: 145, estado: "Disponible", precioM2: 160 },
  { bulto: "#8851", material: "Dekton TRILIUM 12mm", largoCm: 300, anchoCm: 150, estado: "Reservada", precioM2: 160 },
  { bulto: "#8845", material: "Granito Black Cosmic Leather 20mm", largoCm: 310, anchoCm: 175, estado: "Disponible", precioM2: 110 },
];

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

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
  precio_m2?: number | null;
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
    precioM2: numOrNull(row.precio_m2),
  };
}

const CHAPA_COLS =
  "id,bulto,material_id,material_label,largo_cm,ancho_cm,espesor_cm,estado,lote_codigo,ot_reserva_id,motivo_estado,origen_placa,chapa_origen_id,precio_m2,created_at";
const CHAPA_COLS_SIN_PRECIO =
  "id,bulto,material_id,material_label,largo_cm,ancho_cm,espesor_cm,estado,lote_codigo,ot_reserva_id,motivo_estado,origen_placa,chapa_origen_id,created_at";
const CHAPA_COLS_MIN =
  "id,bulto,material_id,material_label,largo_cm,ancho_cm,estado,lote_codigo,ot_reserva_id,motivo_estado,origen_placa,chapa_origen_id,created_at";

function mapChapaSelectRow(r: {
  id: string;
  bulto: string;
  material_label: string;
  material_id: string | null;
  largo_cm: number;
  ancho_cm: number;
  estado: string;
  lote_codigo: string | null;
  ot_reserva_id: string | null;
  motivo_estado?: string | null;
  chapa_origen_id?: string | null;
  espesor_cm?: number | null;
  origen_placa?: OrigenPlaca | null;
  precio_m2?: number | null;
}): ChapaRow {
  return slabRowToChapa({
    id: r.id,
    bulto: r.bulto,
    material_label: r.material_label,
    material_id: r.material_id,
    largo_cm: Number(r.largo_cm),
    ancho_cm: Number(r.ancho_cm),
    espesor_cm: r.espesor_cm ?? null,
    estado: r.estado as ChapaRow["estado"],
    lote_codigo: r.lote_codigo,
    ot_reserva_id: r.ot_reserva_id,
    motivo_estado: r.motivo_estado ?? null,
    origen_placa: r.origen_placa ?? null,
    chapa_origen_id: r.chapa_origen_id ?? null,
    precio_m2: r.precio_m2 ?? null,
  });
}

export async function fetchInventorySlabs(): Promise<ChapaRow[]> {
  if (!isSupabaseConfigured) return [...STOCK_CHAPAS_INICIAL];
  const { data, error } = await supabase
    .from("chapas_inventario")
    .select(CHAPA_COLS)
    .order("created_at", { ascending: false });
  if (!error) return (data ?? []).map((r) => mapChapaSelectRow(r));

  const sinPrecio = await supabase
    .from("chapas_inventario")
    .select(CHAPA_COLS_SIN_PRECIO)
    .order("created_at", { ascending: false });
  if (!sinPrecio.error) return (sinPrecio.data ?? []).map((r) => mapChapaSelectRow(r));

  const fallback = await supabase
    .from("chapas_inventario")
    .select(CHAPA_COLS_MIN)
    .order("created_at", { ascending: false });
  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []).map((r) => mapChapaSelectRow(r));
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
  m2SobrantePrevisto: number;
  previstosCount: number;
  costoUsdTotal: number | null;
};

function m2DeChapa(largoCm: number, anchoCm: number): number {
  return (largoCm / 100) * (anchoCm / 100);
}

export function esChapaRetazo(c: {
  chapaOrigenId?: string | null;
  motivoEstado?: string | null;
  estado?: string | null;
}): boolean {
  if (c.estado === "Prevista") return true;
  if (c.chapaOrigenId) return true;
  const m = (c.motivoEstado ?? "").toLowerCase();
  return m.includes("retazo") || m.includes("recorte") || m.includes("previsto");
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
        m2SobrantePrevisto: 0,
        previstosCount: 0,
        costoUsdTotal: null,
      };
      map.set(key, row);
    }
    const m2 = m2DeChapa(c.largoCm, c.anchoCm);
    const esRetazo = esChapaRetazo(c);
    if (c.estado === "Prevista") {
      row.m2SobrantePrevisto += m2;
      row.previstosCount += 1;
    } else if (c.estado === "Disponible") {
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

export type BachaInventarioRow = Database["public"]["Tables"]["bachas_inventario"]["Row"];
export type BachaInventarioLista = BachaInventarioRow & {
  ot_titulo: string | null;
  ot_estado: "pending" | "in_progress" | "done" | "cancelled" | null;
};
type BachaInventarioInsert = Database["public"]["Tables"]["bachas_inventario"]["Insert"];

export async function fetchBachasInventario(): Promise<BachaInventarioLista[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("bachas_inventario")
    .select("*, ot:ordenes_trabajo!bachas_inventario_ot_id_fkey(titulo,estado)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const joined = row as BachaInventarioRow & {
      ot?: { titulo?: string | null; estado?: BachaInventarioLista["ot_estado"] } | null;
    };
    const { ot, ...bacha } = joined;
    const otEstado = ot?.estado ?? null;
    return {
      ...bacha,
      ot_titulo: ot?.titulo?.trim() || null,
      ot_estado: otEstado === "pending" || otEstado === "in_progress" || otEstado === "done" || otEstado === "cancelled"
        ? otEstado
        : null,
    };
  });
}

export async function fetchBachasDisponiblesParaOt(opts?: {
  clienteNombre?: string | null;
  clienteId?: string | null;
}): Promise<BachaInventarioRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("bachas_inventario")
    .select("*")
    .eq("estado", "disponible")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as BachaInventarioRow[];
  return rows.filter((b) =>
    bachaCorrespondeACliente(b, {
      clienteNombre: opts?.clienteNombre,
      clienteId: opts?.clienteId,
    }),
  );
}

export async function createBachaInventario(
  input: Omit<BachaInventarioInsert, "id" | "created_at">,
): Promise<BachaInventarioRow> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase no está configurado");
  }
  const origen = input.origen === "cliente" ? "cliente" : "propia";
  const clienteNombre =
    origen === "cliente" ? (input.cliente_nombre ?? "").trim() : null;
  const clienteId = origen === "cliente" ? input.cliente_id ?? null : null;
  if (origen === "cliente" && !clienteNombre) {
    throw new Error("Elegí el cliente.");
  }
  const { data, error } = await supabase
    .from("bachas_inventario")
    .insert({
      origen,
      cliente_nombre: clienteNombre,
      cliente_id: clienteId,
      modelo: input.modelo?.trim() || null,
      medidas: input.medidas?.trim() || null,
      ubicacion: input.ubicacion?.trim() || null,
      estado: input.estado ?? "disponible",
      ot_id: input.ot_id ?? null,
      notas: input.notas?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message || "No se pudo registrar la bacha");
  return data as BachaInventarioRow;
}

export async function updateBachaInventarioEstado(
  id: string,
  estado: BachaInventarioRow["estado"],
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("bachas_inventario").update({ estado }).eq("id", id);
  if (error) throw new Error(error.message || "No se pudo actualizar la bacha");
}

export async function asignarBachaAOt(opts: {
  bachaId: string;
  otId: string;
  clienteNombre?: string | null;
  clienteId?: string | null;
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no está configurado") };

  const [bachaRes, otRes] = await Promise.all([
    supabase.from("bachas_inventario").select("*").eq("id", opts.bachaId).maybeSingle(),
    supabase
      .from("ordenes_trabajo")
      .select("id,bacha_id,bloqueada,motivo_bloqueo")
      .eq("id", opts.otId)
      .maybeSingle(),
  ]);
  if (bachaRes.error) return { error: new Error(bachaRes.error.message) };
  if (otRes.error) return { error: new Error(otRes.error.message) };
  const bacha = bachaRes.data as BachaInventarioRow | null;
  const ot = otRes.data;
  if (!bacha) return { error: new Error("Bacha no encontrada.") };
  if (!ot) return { error: new Error("Orden de trabajo no encontrada.") };
  if (bacha.estado !== "disponible" && bacha.ot_id !== opts.otId) {
    return { error: new Error("Esa bacha no está disponible.") };
  }
  if (
    bacha.origen === "cliente" &&
    !bachaCorrespondeACliente(bacha, {
      clienteNombre: opts.clienteNombre,
      clienteId: opts.clienteId,
    })
  ) {
    return { error: new Error("La bacha del cliente no corresponde a esta OT.") };
  }

  if (ot.bacha_id && ot.bacha_id !== opts.bachaId) {
    const prev = await supabase
      .from("bachas_inventario")
      .update({ estado: "disponible", ot_id: null })
      .eq("id", ot.bacha_id)
      .eq("ot_id", opts.otId);
    if (prev.error) return { error: new Error(prev.error.message) };
  }

  const upB = await supabase
    .from("bachas_inventario")
    .update({ estado: "asignada", ot_id: opts.otId })
    .eq("id", opts.bachaId);
  if (upB.error) return { error: new Error(upB.error.message) };

  const otPatch: Database["public"]["Tables"]["ordenes_trabajo"]["Update"] = {
    bacha_id: opts.bachaId,
    actualizado_en: new Date().toISOString(),
  };
  if (ot.bloqueada && esBloqueoPorBacha(ot.motivo_bloqueo)) {
    otPatch.bloqueada = false;
    otPatch.motivo_bloqueo = null;
  }
  const upOt = await supabase.from("ordenes_trabajo").update(otPatch).eq("id", opts.otId);
  if (upOt.error) return { error: new Error(upOt.error.message) };
  return { error: null };
}

export async function liberarBachaDeOt(opts: {
  otId: string;
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no está configurado") };
  const otRes = await supabase
    .from("ordenes_trabajo")
    .select("id,bacha_id,bloqueada,motivo_bloqueo")
    .eq("id", opts.otId)
    .maybeSingle();
  if (otRes.error) return { error: new Error(otRes.error.message) };
  const ot = otRes.data;
  if (!ot) return { error: new Error("Orden de trabajo no encontrada.") };
  if (ot.bacha_id) {
    const upB = await supabase
      .from("bachas_inventario")
      .update({ estado: "disponible", ot_id: null })
      .eq("id", ot.bacha_id);
    if (upB.error) return { error: new Error(upB.error.message) };
  }
  const upOt = await supabase
    .from("ordenes_trabajo")
    .update({
      bacha_id: null,
      actualizado_en: new Date().toISOString(),
      ...(ot.bloqueada && esBloqueoPorBacha(ot.motivo_bloqueo)
        ? { bloqueada: false, motivo_bloqueo: null }
        : {}),
    })
    .eq("id", opts.otId);
  if (upOt.error) return { error: new Error(upOt.error.message) };
  return { error: null };
}

export async function actualizarOrigenBachaOt(opts: {
  otId: string;
  origen: "propia" | "cliente";
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no está configurado") };
  const origen = opts.origen === "cliente" ? "cliente" : "propia";
  const { error } = await supabase
    .from("ordenes_trabajo")
    .update({
      bacha_origen: origen,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", opts.otId);
  return { error: error ? new Error(error.message) : null };
}

export async function marcarBachaUsada(bachaId: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no está configurado") };
  const { error } = await supabase
    .from("bachas_inventario")
    .update({ estado: "usada" })
    .eq("id", bachaId);
  return { error: error ? new Error(error.message) : null };
}

export async function fetchSlabsByMaterialLabel(label: string): Promise<ChapaRow[]> {
  if (!isSupabaseConfigured) return STOCK_CHAPAS_INICIAL.filter((c) => c.material === label);
  const { data, error } = await supabase
    .from("chapas_inventario")
    .select(CHAPA_COLS)
    .eq("material_label", label)
    .order("bulto", { ascending: true });
  if (!error) return (data ?? []).map((r) => mapChapaSelectRow(r));

  const sinPrecio = await supabase
    .from("chapas_inventario")
    .select(CHAPA_COLS_SIN_PRECIO)
    .eq("material_label", label)
    .order("bulto", { ascending: true });
  if (sinPrecio.error) throw sinPrecio.error;
  return (sinPrecio.data ?? []).map((r) => mapChapaSelectRow(r));
}

export type PlanchaBuscadorRow = {
  id: string;
  bulto: string;
  materialId: string | null;
  materialLabel: string;
  familia: string | null;
  espesorCm: number | null;
  espesorMm: number | null;
  largoCm: number;
  anchoCm: number;
  proveedor: string | null;
  precioM2: number | null;
  estado: InventorySlabEstado;
};

const PLANCHAS_BUSCADOR_SELECT = `
  id, bulto, material_id, material_label, largo_cm, ancho_cm, espesor_cm, estado, precio_m2,
  materials ( name, familia, espesor_mm ),
  remito_lines ( remitos ( suppliers ( name ) ) )
`;

function firstRel(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object"
      ? (first as Record<string, unknown>)
      : null;
  }
  if (typeof value === "object") return value as Record<string, unknown>;
  return null;
}

function mapPlanchaBuscadorRow(r: Record<string, unknown>): PlanchaBuscadorRow {
  const materials = firstRel(r.materials);
  const remitoLines = firstRel(r.remito_lines);
  const remitos = remitoLines ? firstRel(remitoLines.remitos) : null;
  const suppliers = remitos ? firstRel(remitos.suppliers) : null;
  const familia =
    typeof materials?.familia === "string" && materials.familia.trim()
      ? materials.familia.trim()
      : null;
  const proveedor =
    typeof suppliers?.name === "string" && suppliers.name.trim()
      ? suppliers.name.trim()
      : null;
  return {
    id: String(r.id),
    bulto: String(r.bulto ?? ""),
    materialId: (r.material_id as string | null) ?? null,
    materialLabel: String(r.material_label ?? materials?.name ?? ""),
    familia,
    espesorCm: numOrNull(r.espesor_cm),
    espesorMm: numOrNull(materials?.espesor_mm),
    largoCm: Number(r.largo_cm),
    anchoCm: Number(r.ancho_cm),
    proveedor,
    precioM2: numOrNull(r.precio_m2),
    estado: r.estado as InventorySlabEstado,
  };
}

function chapaLocalAPlanchaBuscador(c: ChapaRow): PlanchaBuscadorRow {
  return {
    id: c.id ?? c.bulto,
    bulto: c.bulto,
    materialId: c.materialId ?? null,
    materialLabel: c.material,
    familia: null,
    espesorCm: c.espesorCm ?? null,
    espesorMm: null,
    largoCm: c.largoCm,
    anchoCm: c.anchoCm,
    proveedor: null,
    precioM2: c.precioM2 ?? null,
    estado: c.estado,
  };
}

export async function listPlanchasBuscador(opts?: {
  extraIds?: string[];
}): Promise<PlanchaBuscadorRow[]> {
  if (!isSupabaseConfigured) {
    return STOCK_CHAPAS_INICIAL.filter((c) => c.estado === "Disponible").map(
      chapaLocalAPlanchaBuscador,
    );
  }

  async function queryPlanchas(ids?: string[]) {
    const nested = ids?.length
      ? supabase.from("chapas_inventario").select(PLANCHAS_BUSCADOR_SELECT).in("id", ids)
      : supabase
          .from("chapas_inventario")
          .select(PLANCHAS_BUSCADOR_SELECT)
          .eq("estado", "Disponible")
          .order("material_label", { ascending: true })
          .order("bulto", { ascending: true });
    const first = await nested;
    if (!first.error) return first.data ?? [];

    const plainSelect =
      "id, bulto, material_id, material_label, largo_cm, ancho_cm, espesor_cm, estado, precio_m2";
    const plain = ids?.length
      ? await supabase.from("chapas_inventario").select(plainSelect).in("id", ids)
      : await supabase
          .from("chapas_inventario")
          .select(plainSelect)
          .eq("estado", "Disponible")
          .order("material_label", { ascending: true })
          .order("bulto", { ascending: true });
    if (plain.error) throw new Error(plain.error.message);
    return plain.data ?? [];
  }

  const byId = new Map<string, PlanchaBuscadorRow>();
  for (const row of await queryPlanchas()) {
    const mapped = mapPlanchaBuscadorRow(row as Record<string, unknown>);
    byId.set(mapped.id, mapped);
  }

  const extraIds = [...new Set((opts?.extraIds ?? []).filter(Boolean))].filter(
    (id) => !byId.has(id),
  );
  if (extraIds.length > 0) {
    for (const row of await queryPlanchas(extraIds)) {
      const mapped = mapPlanchaBuscadorRow(row as Record<string, unknown>);
      byId.set(mapped.id, mapped);
    }
  }

  return [...byId.values()];
}

export async function fetchOtTitulosByIds(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (!isSupabaseConfigured || unique.length === 0) return map;
  const { data, error } = await supabase
    .from("ordenes_trabajo")
    .select("id,titulo")
    .in("id", unique);
  if (error) throw error;
  for (const row of data ?? []) {
    map.set(row.id, (row.titulo ?? "").trim() || `OT`);
  }
  return map;
}

export type CreateRetazoManualInput = {
  material_id: string | null;
  material_label: string;
  largo_cm: number;
  ancho_cm: number;
  cantidad: number;
  bulto?: string | null;
  observacion?: string | null;
  created_by?: string | null;
};

async function nextBultoLibre(candidate: string): Promise<string> {
  let n = 0;
  let tryBulto = candidate;
  while (n < 80) {
    const { data } = await supabase.from("chapas_inventario").select("id").eq("bulto", tryBulto).maybeSingle();
    if (!data) return tryBulto;
    n += 1;
    tryBulto = `${candidate}-R${n}`;
  }
  return `${candidate}-${Date.now().toString(36)}`;
}

export async function createRetazosManual(rows: CreateRetazoManualInput[]): Promise<number> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  if (rows.length === 0) return 0;

  let inserted = 0;
  const seq = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(2, 14);

  for (const row of rows) {
    const qty = Math.max(1, Math.floor(row.cantidad));
    const baseBulto = row.bulto?.trim() || `REC-${seq}`;
    const motivoBase = row.observacion?.trim()
      ? `Retazo manual · ${row.observacion.trim()}`
      : "Retazo manual";
    const motivo = motivoBase.slice(0, 200);

    for (let i = 0; i < qty; i += 1) {
      const candidate = qty === 1 && row.bulto?.trim() ? baseBulto : `${baseBulto}${qty > 1 ? `-${String(i + 1).padStart(2, "0")}` : ""}`;
      const bulto = await nextBultoLibre(candidate);
      const { data: chapa, error: insErr } = await supabase
        .from("chapas_inventario")
        .insert({
          bulto,
          material_id: row.material_id,
          material_label: row.material_label,
          largo_cm: row.largo_cm,
          ancho_cm: row.ancho_cm,
          estado: "Disponible",
          origen_placa: "otro",
          motivo_estado: motivo,
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      inserted += 1;

      await supabase.from("stock_movimientos").insert({
        chapa_id: chapa.id,
        ot_id: null,
        tipo: "retazo_alta",
        detalle: `Retazo ${bulto} ${row.largo_cm}×${row.ancho_cm} cm`,
        created_by: row.created_by ?? null,
      });
    }

    await supabase.from("stock_scraps").insert({
      accion: "Reingresar",
      ingreso_tipo: "Recorte Cuadrado/Rectangulo",
      material_id: row.material_id,
      material_label: row.material_label,
      cantidad: qty,
      n_chapa: row.bulto?.trim() || null,
      observacion:
        `${row.largo_cm}×${row.ancho_cm} cm${row.observacion?.trim() ? ` · ${row.observacion.trim()}` : ""}`.slice(
          0,
          500,
        ),
      created_by: row.created_by ?? null,
    });
  }

  return inserted;
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
