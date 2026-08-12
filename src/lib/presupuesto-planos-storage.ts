import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { PlanoAdjuntoOt } from "@/components/presupuesto/wizard/types";

export const PRESUPUESTO_PLANOS_BUCKET = "presupuesto-planos";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "archivo";
  return base.slice(0, 120);
}

export function validatePlanoFile(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return "Solo PDF o imagen (JPEG, PNG, WebP, GIF).";
  }
  if (file.size > MAX_BYTES) {
    return "El archivo no puede superar 10 MB.";
  }
  return null;
}

export async function uploadPlano(opts: {
  otKey: string;
  file: File;
}): Promise<{ data: PlanoAdjuntoOt | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado.") };
  }
  const validation = validatePlanoFile(opts.file);
  if (validation) {
    return { data: null, error: new Error(validation) };
  }

  const safe = sanitizeFileName(opts.file.name);
  const path = `planos/${opts.otKey}/${Date.now()}-${safe}`;

  const { error } = await supabase.storage
    .from(PRESUPUESTO_PLANOS_BUCKET)
    .upload(path, opts.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: opts.file.type,
    });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return {
    data: {
      name: opts.file.name,
      mime: opts.file.type,
      storagePath: path,
      size: opts.file.size,
    },
    error: null,
  };
}

export async function getPlanoSignedUrl(
  storagePath: string,
  expiresInSec = 3600,
): Promise<{ url: string | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { url: null, error: new Error("Supabase no está configurado.") };
  }
  const { data, error } = await supabase.storage
    .from(PRESUPUESTO_PLANOS_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);

  if (error) {
    return { url: null, error: new Error(error.message) };
  }
  return { url: data.signedUrl, error: null };
}

export async function removePlano(
  storagePath: string,
): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error("Supabase no está configurado.") };
  }
  if (!storagePath.trim()) return { error: null };

  const { error } = await supabase.storage
    .from(PRESUPUESTO_PLANOS_BUCKET)
    .remove([storagePath]);

  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}
