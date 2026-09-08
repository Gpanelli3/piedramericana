import type {
  Database,
  ImportacionDocumentoTipo,
  ImportacionEstado,
  ImportacionGastoConcepto,
  ImportacionMedioTransporte,
} from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type ImportacionRow = Database["public"]["Tables"]["importaciones"]["Row"];
export type ImportacionInsert = Database["public"]["Tables"]["importaciones"]["Insert"];
export type ImportacionUpdate = Database["public"]["Tables"]["importaciones"]["Update"];
export type ImportacionGastoRow = Database["public"]["Tables"]["importacion_gastos"]["Row"];
export type ImportacionDocumentoRow = Database["public"]["Tables"]["importacion_documentos"]["Row"];

export type ImportacionListRow = ImportacionRow & {
  supplier_name: string;
};

export type ImportacionRemitoRow = {
  id: string;
  branch_code: string;
  serial_code: string;
  issue_date: string;
  origen_placa: string;
  total_slabs: number;
  total_m2: number;
};

export type ImportacionDetalle = {
  importacion: ImportacionListRow;
  gastos: ImportacionGastoRow[];
  documentos: ImportacionDocumentoRow[];
  remitos: ImportacionRemitoRow[];
};

export const IMPORTACION_ESTADOS: { value: ImportacionEstado; label: string }[] = [
  { value: "orden_compra", label: "Orden de compra" },
  { value: "embarque", label: "Embarque" },
  { value: "en_transito", label: "En tránsito" },
  { value: "en_aduana", label: "En aduana" },
  { value: "nacionalizada", label: "Nacionalizada" },
  { value: "en_deposito", label: "En depósito" },
];

export const IMPORTACION_GASTOS: { value: ImportacionGastoConcepto; label: string }[] = [
  { value: "valor_mercaderia", label: "Valor mercadería (FOB)" },
  { value: "flete_internacional", label: "Flete internacional" },
  { value: "seguro", label: "Seguro" },
  { value: "derechos_importacion", label: "Derechos de importación" },
  { value: "iva_importacion", label: "IVA importación" },
  { value: "ingresos_brutos", label: "Ingresos brutos" },
  { value: "percepcion_ganancias", label: "Percepción ganancias" },
  { value: "gasto_despachante", label: "Despachante" },
  { value: "flete_local", label: "Flete local" },
  { value: "otro", label: "Otro" },
];

export const IMPORTACION_DOCUMENTOS: { value: ImportacionDocumentoTipo; label: string }[] = [
  { value: "factura_provisoria", label: "Factura provisoria" },
  { value: "factura_definitiva", label: "Factura definitiva" },
  { value: "despacho", label: "Despacho de aduana" },
  { value: "bill_of_lading", label: "BL / AWB" },
  { value: "packing_list", label: "Packing list" },
  { value: "otro", label: "Otro" },
];

export const MEDIOS_TRANSPORTE: { value: ImportacionMedioTransporte; label: string }[] = [
  { value: "maritimo", label: "Marítimo" },
  { value: "aereo", label: "Aéreo" },
  { value: "terrestre", label: "Terrestre" },
];

export const IMPORTACION_DOCS_BUCKET = "importacion-documentos";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 10 * 1024 * 1024;

export function documentosPorEtapa(
  docs: ImportacionDocumentoRow[],
): { etapa: ImportacionEstado | null; label: string; docs: ImportacionDocumentoRow[] }[] {
  const groups: { etapa: ImportacionEstado | null; label: string; docs: ImportacionDocumentoRow[] }[] = [];
  for (const e of IMPORTACION_ESTADOS) {
    const list = docs.filter((d) => d.etapa === e.value);
    if (list.length) groups.push({ etapa: e.value, label: e.label, docs: list });
  }
  const sin = docs.filter((d) => !d.etapa);
  if (sin.length) groups.push({ etapa: null, label: "Sin etapa", docs: sin });
  return groups;
}

export function estadoLabel(v: string): string {
  return IMPORTACION_ESTADOS.find((e) => e.value === v)?.label ?? v;
}

export function gastoLabel(v: string): string {
  return IMPORTACION_GASTOS.find((e) => e.value === v)?.label ?? v;
}

export function documentoLabel(v: string): string {
  return IMPORTACION_DOCUMENTOS.find((e) => e.value === v)?.label ?? v;
}

export function medioLabel(v: string | null): string {
  if (!v) return "—";
  return MEDIOS_TRANSPORTE.find((e) => e.value === v)?.label ?? v;
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isImportacionDemorada(imp: {
  fecha_estimada_llegada: string | null;
  estado: ImportacionEstado;
}): boolean {
  if (!imp.fecha_estimada_llegada || imp.estado === "en_deposito") return false;
  return imp.fecha_estimada_llegada < hoyISO();
}

export function camposFaltantes(imp: ImportacionRow): string[] {
  const falta: string[] = [];
  if (!imp.nro_orden_compra) falta.push("N° orden de compra");
  if (!imp.fecha_orden_compra) falta.push("Fecha OC");
  if (imp.monto_factura_usd == null) falta.push("Monto USD");
  if (!imp.fecha_embarque) falta.push("Fecha de embarque");
  if (!imp.fecha_estimada_llegada) falta.push("Fecha estimada de llegada");
  if (!imp.despachante_nombre) falta.push("Despachante");
  if (!imp.fecha_nacionalizacion) falta.push("Fecha de nacionalización");
  if (!imp.nro_despacho) falta.push("N° despacho");
  return falta;
}

export type LandedCost = {
  ars: { total: number; iva: number; puesto: number };
  usd: { total: number; iva: number; puesto: number };
};

export function summarizeGastos(gastos: ImportacionGastoRow[]): LandedCost {
  const empty = { total: 0, iva: 0, puesto: 0 };
  const out: LandedCost = { ars: { ...empty }, usd: { ...empty } };
  for (const g of gastos) {
    const bucket = g.moneda === "ars" ? out.ars : out.usd;
    const monto = Number(g.monto) || 0;
    bucket.total += monto;
    if (g.es_iva_recuperable) bucket.iva += monto;
  }
  out.ars.puesto = out.ars.total - out.ars.iva;
  out.usd.puesto = out.usd.total - out.usd.iva;
  return out;
}

function mapListRow(r: ImportacionRow & { suppliers?: { name: string } | { name: string }[] | null }): ImportacionListRow {
  const rel = r.suppliers;
  const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
  const { suppliers: _s, ...rest } = r;
  return { ...rest, supplier_name: name ?? "—" };
}

export async function fetchImportaciones(): Promise<ImportacionListRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("importaciones")
    .select("*, suppliers(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapListRow(r as ImportacionRow & { suppliers?: { name: string } | null }));
}

export async function fetchImportacionDetalle(id: string): Promise<ImportacionDetalle> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");

  const [impRes, gastosRes, docsRes, remitosRes] = await Promise.all([
    supabase.from("importaciones").select("*, suppliers(name)").eq("id", id).single(),
    supabase.from("importacion_gastos").select("*").eq("importacion_id", id).order("created_at"),
    supabase.from("importacion_documentos").select("*").eq("importacion_id", id).order("created_at"),
    supabase
      .from("remitos")
      .select("id, branch_code, serial_code, issue_date, origen_placa, remito_lines(qty_slabs, m2_total)")
      .eq("importacion_id", id)
      .order("issue_date", { ascending: false }),
  ]);

  if (impRes.error) throw new Error(impRes.error.message);
  if (gastosRes.error) throw new Error(gastosRes.error.message);
  if (docsRes.error) throw new Error(docsRes.error.message);

  const remitos: ImportacionRemitoRow[] = (remitosRes.data ?? []).map((r) => {
    const lines = (r.remito_lines ?? []) as { qty_slabs: number; m2_total: number }[];
    return {
      id: r.id,
      branch_code: r.branch_code,
      serial_code: r.serial_code,
      issue_date: r.issue_date,
      origen_placa: r.origen_placa,
      total_slabs: lines.reduce((s, l) => s + (Number(l.qty_slabs) || 0), 0),
      total_m2: lines.reduce((s, l) => s + (Number(l.m2_total) || 0), 0),
    };
  });

  return {
    importacion: mapListRow(impRes.data as ImportacionRow & { suppliers?: { name: string } | null }),
    gastos: (gastosRes.data ?? []) as ImportacionGastoRow[],
    documentos: (docsRes.data ?? []) as ImportacionDocumentoRow[],
    remitos,
  };
}

export async function insertImportacion(
  payload: Omit<ImportacionInsert, "id" | "created_at" | "updated_at">,
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { data, error } = await supabase.from("importaciones").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateImportacion(id: string, payload: ImportacionUpdate): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { error } = await supabase
    .from("importaciones")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteImportacion(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");

  const { data: docs } = await supabase
    .from("importacion_documentos")
    .select("url")
    .eq("importacion_id", id);
  const paths = (docs ?? []).map((d) => d.url).filter(Boolean);
  if (paths.length) {
    await supabase.storage.from(IMPORTACION_DOCS_BUCKET).remove(paths);
  }

  const delDocs = await supabase.from("importacion_documentos").delete().eq("importacion_id", id);
  if (delDocs.error) throw new Error(delDocs.error.message);
  const delGastos = await supabase.from("importacion_gastos").delete().eq("importacion_id", id);
  if (delGastos.error) throw new Error(delGastos.error.message);
  const { error } = await supabase.from("importaciones").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertGasto(payload: {
  importacion_id: string;
  concepto: ImportacionGastoConcepto;
  monto: number;
  moneda: "ars" | "usd";
  es_iva_recuperable: boolean;
  notas?: string | null;
}): Promise<ImportacionGastoRow> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { data, error } = await supabase.from("importacion_gastos").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data as ImportacionGastoRow;
}

export async function deleteGasto(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { error } = await supabase.from("importacion_gastos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "archivo";
  return base.slice(0, 120);
}

export async function fetchImportacionDocumentos(
  importacionId: string,
): Promise<ImportacionDocumentoRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("importacion_documentos")
    .select("*")
    .eq("importacion_id", importacionId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as ImportacionDocumentoRow[];
}

export function validateImportacionFile(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) return "Solo PDF o imagen (JPEG, PNG, WebP, GIF).";
  if (file.size > MAX_BYTES) return "El archivo no puede superar 10 MB.";
  return null;
}

export async function uploadImportacionDocumento(opts: {
  importacionId: string;
  tipo: ImportacionDocumentoTipo;
  file: File;
  etapa: ImportacionEstado;
  createdBy?: string | null;
}): Promise<ImportacionDocumentoRow> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const validation = validateImportacionFile(opts.file);
  if (validation) throw new Error(validation);

  const safe = sanitizeFileName(opts.file.name);
  const path = `${opts.importacionId}/${Date.now()}-${safe}`;

  const { error: upErr } = await supabase.storage.from(IMPORTACION_DOCS_BUCKET).upload(path, opts.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: opts.file.type,
  });
  if (upErr) throw new Error(upErr.message);

  const { data, error } = await supabase
    .from("importacion_documentos")
    .insert({
      importacion_id: opts.importacionId,
      tipo: opts.tipo,
      nombre_archivo: opts.file.name,
      url: path,
      etapa: opts.etapa,
      created_by: opts.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from(IMPORTACION_DOCS_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return data as ImportacionDocumentoRow;
}

export async function getDocumentoSignedUrl(storagePath: string, expiresInSec = 3600): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { data, error } = await supabase.storage
    .from(IMPORTACION_DOCS_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteDocumento(doc: ImportacionDocumentoRow): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  if (doc.url) {
    await supabase.storage.from(IMPORTACION_DOCS_BUCKET).remove([doc.url]);
  }
  const { error } = await supabase.from("importacion_documentos").delete().eq("id", doc.id);
  if (error) throw new Error(error.message);
}
