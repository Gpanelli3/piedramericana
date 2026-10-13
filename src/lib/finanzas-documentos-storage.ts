import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const FINANZAS_COMPROBANTES_BUCKET = "finanzas-comprobantes";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 10 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "archivo";
  return base.slice(0, 120);
}

export function validateFinanzasComprobanteFile(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) return "Solo PDF o imagen (JPEG, PNG, WebP, GIF).";
  if (file.size > MAX_BYTES) return "El archivo no puede superar 10 MB.";
  return null;
}

export async function uploadFinanzasComprobante(opts: {
  movimientoId: string;
  file: File;
}): Promise<{ path: string | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { path: null, error: new Error("Supabase no está configurado.") };
  }
  const validation = validateFinanzasComprobanteFile(opts.file);
  if (validation) return { path: null, error: new Error(validation) };

  const safe = sanitizeFileName(opts.file.name);
  const path = `${opts.movimientoId}/${Date.now()}-${safe}`;

  const { error } = await supabase.storage
    .from(FINANZAS_COMPROBANTES_BUCKET)
    .upload(path, opts.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: opts.file.type,
    });
  if (error) return { path: null, error: new Error(error.message) };
  return { path, error: null };
}

export async function getFinanzasComprobanteSignedUrl(
  storagePath: string,
  expiresInSec = 3600,
): Promise<{ url: string | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { url: null, error: new Error("Supabase no está configurado.") };
  }
  const { data, error } = await supabase.storage
    .from(FINANZAS_COMPROBANTES_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) return { url: null, error: new Error(error.message) };
  return { url: data.signedUrl, error: null };
}

export async function removeFinanzasComprobante(storagePath: string): Promise<void> {
  if (!isSupabaseConfigured || !storagePath.trim()) return;
  await supabase.storage.from(FINANZAS_COMPROBANTES_BUCKET).remove([storagePath]);
}
