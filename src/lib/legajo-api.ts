import type { Database, EmpleadoDocumentoTipo } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const LEGAJO_BUCKET = "empleados-legajo";
export const LEGAJO_TAMANO_MAX = 10 * 1024 * 1024;
const MIME_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export type EmpleadoDocumentoRow = Database["public"]["Tables"]["empleado_documentos"]["Row"];

export const DOCUMENTO_TIPOS: { value: EmpleadoDocumentoTipo; label: string }[] = [
  { value: "certificado_medico", label: "Certificado médico" },
  { value: "contrato", label: "Contrato" },
  { value: "dni", label: "DNI" },
  { value: "cuil", label: "CUIL" },
  { value: "otro", label: "Otro" },
];

export function etiquetaDocumentoTipo(t: string | null | undefined): string {
  return DOCUMENTO_TIPOS.find((d) => d.value === t)?.label ?? t ?? "—";
}

function nombreSeguro(nombre: string): string {
  return nombre.replace(/[^\w.\- ]+/g, "_").trim() || "archivo";
}

export async function listDocumentos(empleadoId: string): Promise<{
  data: EmpleadoDocumentoRow[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }
  const { data, error } = await supabase
    .from("empleado_documentos")
    .select("*")
    .eq("empleado_id", empleadoId)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as EmpleadoDocumentoRow[], error: null };
}

export async function subirDocumento(opts: {
  empleadoId: string;
  tipo: EmpleadoDocumentoTipo;
  archivo: File;
  nombre?: string;
  createdBy?: string | null;
}): Promise<{ data: EmpleadoDocumentoRow | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }
  if (!MIME_PERMITIDOS.includes(opts.archivo.type)) {
    return { data: null, error: new Error("Formato no permitido (PDF, JPG, PNG o WEBP)") };
  }
  if (opts.archivo.size > LEGAJO_TAMANO_MAX) {
    return { data: null, error: new Error("El archivo supera los 10 MB") };
  }

  const nombre = opts.nombre?.trim() || opts.archivo.name;
  const path = `${opts.empleadoId}/${crypto.randomUUID()}-${nombreSeguro(opts.archivo.name)}`;

  const { error: upErr } = await supabase.storage
    .from(LEGAJO_BUCKET)
    .upload(path, opts.archivo, { contentType: opts.archivo.type, upsert: false });
  if (upErr) return { data: null, error: new Error(upErr.message) };

  const { data, error } = await supabase
    .from("empleado_documentos")
    .insert({
      empleado_id: opts.empleadoId,
      tipo: opts.tipo,
      nombre,
      storage_path: path,
      mime_type: opts.archivo.type,
      size_bytes: opts.archivo.size,
      created_by: opts.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(LEGAJO_BUCKET).remove([path]);
    return { data: null, error: new Error(error.message) };
  }
  return { data: data as EmpleadoDocumentoRow, error: null };
}

export async function urlDocumento(
  storagePath: string,
  expiraEnSeg = 300,
): Promise<{ url: string | null; error: Error | null }> {
  const { data, error } = await supabase.storage
    .from(LEGAJO_BUCKET)
    .createSignedUrl(storagePath, expiraEnSeg);
  if (error || !data) return { url: null, error: new Error(error?.message ?? "Sin URL") };
  return { url: data.signedUrl, error: null };
}

export async function eliminarDocumento(doc: EmpleadoDocumentoRow): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error("Supabase no está configurado") };
  }
  const { error } = await supabase.from("empleado_documentos").delete().eq("id", doc.id);
  if (error) return { error: new Error(error.message) };
  await supabase.storage.from(LEGAJO_BUCKET).remove([doc.storage_path]);
  return { error: null };
}
