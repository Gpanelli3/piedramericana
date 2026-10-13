import type {
  Database,
  ExportacionDocumentoTipo,
  ExportacionEstado,
  ExportacionGastoConcepto,
  ImportacionMedioTransporte,
} from "@/types/database";
import { registrarMovimientoPorExportacion } from "@/lib/finanzas-api";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  descripcionIngresoExportacion,
  EXPORTACION_ESTADOS,
  puedeRegistrarCobro,
  pideDatosCobro,
  yaTieneIngreso,
} from "@/lib/exportacion-reglas";

export type ExportacionRow = Database["public"]["Tables"]["exportaciones"]["Row"];
export type ExportacionInsert = Database["public"]["Tables"]["exportaciones"]["Insert"];
export type ExportacionUpdate = Database["public"]["Tables"]["exportaciones"]["Update"];
export type ExportacionGastoRow = Database["public"]["Tables"]["exportacion_gastos"]["Row"];
export type ExportacionDocumentoRow = Database["public"]["Tables"]["exportacion_documentos"]["Row"];

export type ExportacionListRow = ExportacionRow & {
  client_name: string;
};

export type ExportacionDetalle = {
  exportacion: ExportacionListRow;
  gastos: ExportacionGastoRow[];
  documentos: ExportacionDocumentoRow[];
};

export {
  EXPORTACION_ESTADOS,
  estadoExportacionLabel,
  yaTieneIngreso,
  pideDatosCobro,
  puedeRegistrarCobro,
  descripcionIngresoExportacion,
  camposFaltantesExportacion,
} from "@/lib/exportacion-reglas";

export const EXPORTACION_GASTOS: { value: ExportacionGastoConcepto; label: string }[] = [
  { value: "valor_mercaderia", label: "Valor mercadería" },
  { value: "flete_internacional", label: "Flete internacional" },
  { value: "seguro", label: "Seguro" },
  { value: "gasto_despachante", label: "Despachante" },
  { value: "otro", label: "Otro" },
];

export const EXPORTACION_DOCUMENTOS: { value: ExportacionDocumentoTipo; label: string }[] = [
  { value: "factura", label: "Factura" },
  { value: "packing_list", label: "Packing list" },
  { value: "bill_of_lading", label: "BL / AWB" },
  { value: "otro", label: "Otro" },
];

export const EXPORTACION_DOCS_BUCKET = "exportacion-documentos";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 10 * 1024 * 1024;

export function gastoExportacionLabel(v: string): string {
  return EXPORTACION_GASTOS.find((e) => e.value === v)?.label ?? v;
}

export function documentoExportacionLabel(v: string): string {
  return EXPORTACION_DOCUMENTOS.find((e) => e.value === v)?.label ?? v;
}

export function documentosExportacionPorEtapa(
  docs: ExportacionDocumentoRow[],
): { etapa: ExportacionEstado | null; label: string; docs: ExportacionDocumentoRow[] }[] {
  const groups: { etapa: ExportacionEstado | null; label: string; docs: ExportacionDocumentoRow[] }[] = [];
  for (const e of EXPORTACION_ESTADOS) {
    const list = docs.filter((d) => d.etapa === e.value);
    if (list.length) groups.push({ etapa: e.value, label: e.label, docs: list });
  }
  const sin = docs.filter((d) => !d.etapa);
  if (sin.length) groups.push({ etapa: null, label: "Sin etapa", docs: sin });
  return groups;
}

export function summarizeGastosExportacion(gastos: ExportacionGastoRow[]): { ars: number; usd: number } {
  const out = { ars: 0, usd: 0 };
  for (const g of gastos) {
    const monto = Number(g.monto) || 0;
    if (g.moneda === "ars") out.ars += monto;
    else out.usd += monto;
  }
  return out;
}

function mapListRow(
  r: ExportacionRow & { clients?: { name: string } | { name: string }[] | null },
): ExportacionListRow {
  const rel = r.clients;
  const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
  const { clients: _c, ...rest } = r;
  return { ...rest, client_name: name ?? "—" };
}

export async function fetchExportaciones(): Promise<ExportacionListRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("exportaciones")
    .select("*, clients(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) =>
    mapListRow(r as ExportacionRow & { clients?: { name: string } | null }),
  );
}

export async function fetchExportacionDetalle(id: string): Promise<ExportacionDetalle> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");

  const [expRes, gastosRes, docsRes] = await Promise.all([
    supabase.from("exportaciones").select("*, clients(name)").eq("id", id).single(),
    supabase.from("exportacion_gastos").select("*").eq("exportacion_id", id).order("created_at"),
    supabase.from("exportacion_documentos").select("*").eq("exportacion_id", id).order("created_at"),
  ]);

  if (expRes.error) throw new Error(expRes.error.message);
  if (gastosRes.error) throw new Error(gastosRes.error.message);
  if (docsRes.error) throw new Error(docsRes.error.message);

  return {
    exportacion: mapListRow(expRes.data as ExportacionRow & { clients?: { name: string } | null }),
    gastos: (gastosRes.data ?? []) as ExportacionGastoRow[],
    documentos: (docsRes.data ?? []) as ExportacionDocumentoRow[],
  };
}

export async function insertExportacion(
  payload: Omit<ExportacionInsert, "id" | "created_at" | "updated_at">,
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { data, error } = await supabase.from("exportaciones").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateExportacion(id: string, payload: ExportacionUpdate): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { error } = await supabase
    .from("exportaciones")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteExportacion(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");

  const { data: docs } = await supabase
    .from("exportacion_documentos")
    .select("url")
    .eq("exportacion_id", id);
  const paths = (docs ?? []).map((d) => d.url).filter(Boolean);
  if (paths.length) {
    await supabase.storage.from(EXPORTACION_DOCS_BUCKET).remove(paths);
  }

  const delDocs = await supabase.from("exportacion_documentos").delete().eq("exportacion_id", id);
  if (delDocs.error) throw new Error(delDocs.error.message);
  const delGastos = await supabase.from("exportacion_gastos").delete().eq("exportacion_id", id);
  if (delGastos.error) throw new Error(delGastos.error.message);
  const { error } = await supabase.from("exportaciones").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertGastoExportacion(payload: {
  exportacion_id: string;
  concepto: ExportacionGastoConcepto;
  monto: number;
  moneda: "ars" | "usd";
  notas?: string | null;
}): Promise<ExportacionGastoRow> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { data, error } = await supabase.from("exportacion_gastos").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data as ExportacionGastoRow;
}

export async function deleteGastoExportacion(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { error } = await supabase.from("exportacion_gastos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "archivo";
  return base.slice(0, 120);
}

export async function fetchExportacionDocumentos(
  exportacionId: string,
): Promise<ExportacionDocumentoRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("exportacion_documentos")
    .select("*")
    .eq("exportacion_id", exportacionId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as ExportacionDocumentoRow[];
}

export function validateExportacionFile(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) return "Solo PDF o imagen (JPEG, PNG, WebP, GIF).";
  if (file.size > MAX_BYTES) return "El archivo no puede superar 10 MB.";
  return null;
}

export async function uploadExportacionDocumento(opts: {
  exportacionId: string;
  tipo: ExportacionDocumentoTipo;
  file: File;
  etapa: ExportacionEstado;
  createdBy?: string | null;
}): Promise<ExportacionDocumentoRow> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const validation = validateExportacionFile(opts.file);
  if (validation) throw new Error(validation);

  const safe = sanitizeFileName(opts.file.name);
  const path = `${opts.exportacionId}/${Date.now()}-${safe}`;

  const { error: upErr } = await supabase.storage.from(EXPORTACION_DOCS_BUCKET).upload(path, opts.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: opts.file.type,
  });
  if (upErr) throw new Error(upErr.message);

  const { data, error } = await supabase
    .from("exportacion_documentos")
    .insert({
      exportacion_id: opts.exportacionId,
      tipo: opts.tipo,
      nombre_archivo: opts.file.name,
      url: path,
      etapa: opts.etapa,
      created_by: opts.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from(EXPORTACION_DOCS_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return data as ExportacionDocumentoRow;
}

export async function getExportacionDocumentoSignedUrl(
  storagePath: string,
  expiresInSec = 3600,
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  const { data, error } = await supabase.storage
    .from(EXPORTACION_DOCS_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteDocumentoExportacion(doc: ExportacionDocumentoRow): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  if (doc.url) {
    await supabase.storage.from(EXPORTACION_DOCS_BUCKET).remove([doc.url]);
  }
  const { error } = await supabase.from("exportacion_documentos").delete().eq("id", doc.id);
  if (error) throw new Error(error.message);
}

export async function marcarExportacionCobrada(opts: {
  exportacion: ExportacionListRow;
  monto: number;
  fecha: string;
  cuentaId: string;
  createdBy?: string | null;
}): Promise<ExportacionListRow> {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");

  const check = puedeRegistrarCobro({
    monto: opts.monto,
    fecha: opts.fecha,
    cuentaId: opts.cuentaId,
  });
  if (!check.ok) throw new Error(check.faltantes.join(" "));

  let movimientoId = opts.exportacion.movimiento_id;
  if (!yaTieneIngreso(opts.exportacion)) {
    const mov = await registrarMovimientoPorExportacion({
      cuentaId: opts.cuentaId,
      exportacionId: opts.exportacion.id,
      monto: opts.monto,
      moneda: opts.exportacion.moneda,
      fecha: opts.fecha,
      descripcion: descripcionIngresoExportacion({
        cliente: opts.exportacion.client_name,
        descripcion: opts.exportacion.descripcion,
        nroFactura: opts.exportacion.nro_factura,
      }),
      created_by: opts.createdBy ?? null,
    });
    if (mov.error || !mov.id) {
      throw mov.error ?? new Error("No se pudo registrar el ingreso.");
    }
    movimientoId = mov.id;
  }

  const patch: ExportacionUpdate = {
    estado: "cobrada",
    fecha_cobro: opts.fecha,
    cuenta_id: opts.cuentaId,
    movimiento_id: movimientoId,
  };
  await updateExportacion(opts.exportacion.id, patch);
  return { ...opts.exportacion, ...patch, movimiento_id: movimientoId ?? opts.exportacion.movimiento_id };
}

export async function cambiarEtapaExportacion(opts: {
  exportacion: ExportacionListRow;
  estado: ExportacionEstado;
}): Promise<ExportacionListRow> {
  if (pideDatosCobro(opts.estado, opts.exportacion.movimiento_id)) {
    throw new Error("Para pasar a Cobrada hay que registrar el ingreso.");
  }
  await updateExportacion(opts.exportacion.id, { estado: opts.estado });
  return { ...opts.exportacion, estado: opts.estado };
}

export type { ExportacionEstado, ExportacionGastoConcepto, ExportacionDocumentoTipo, ImportacionMedioTransporte };
