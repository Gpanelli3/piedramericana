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

export type TipoArchivoPresupuesto = "hoja_trabajo_firmada" | "plano" | "archivo";

export type ArchivoPresupuesto = {
  name: string;
  mime: string;
  storagePath: string;
  size: number;
  createdAt: string;
  tipo: TipoArchivoPresupuesto;
};

function inferTipoArchivo(file: File): TipoArchivoPresupuesto {
  const n = file.name.toLowerCase();
  if (n.includes("hoja") && n.includes("trabajo")) return "hoja_trabajo_firmada";
  if (file.type.startsWith("image/")) return "plano";
  return "archivo";
}

function tipoDesdePath(path: string): TipoArchivoPresupuesto {
  if (path.includes("/hoja_trabajo_firmada/")) return "hoja_trabajo_firmada";
  if (path.includes("/plano/")) return "plano";
  return "archivo";
}

export function etiquetaTipoArchivo(tipo: TipoArchivoPresupuesto): string {
  switch (tipo) {
    case "hoja_trabajo_firmada":
      return "Hoja de trabajo firmada";
    case "plano":
      return "Plano de presupuestación";
    default:
      return "Archivo";
  }
}

/** Sube un archivo al presupuesto (no a una OT). */
export async function uploadPlanoPresupuesto(opts: {
  presupuestoId: string;
  file: File;
  tipo?: TipoArchivoPresupuesto;
}): Promise<{ data: ArchivoPresupuesto | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado.") };
  }
  const validation = validatePlanoFile(opts.file);
  if (validation) {
    return { data: null, error: new Error(validation) };
  }

  const tipo = opts.tipo ?? inferTipoArchivo(opts.file);
  const safe = sanitizeFileName(opts.file.name);
  const path = `archivos/${opts.presupuestoId}/${tipo}/${Date.now()}-${safe}`;

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
      createdAt: new Date().toISOString(),
      tipo,
    },
    error: null,
  };
}

/** Lista archivos subidos al presupuesto (carpeta `archivos/{id}`). */
export async function listPlanosByPresupuesto(
  presupuestoId: string,
): Promise<{ data: ArchivoPresupuesto[]; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado.") };
  }

  const tipos: TipoArchivoPresupuesto[] = ["hoja_trabajo_firmada", "plano", "archivo"];
  const out: ArchivoPresupuesto[] = [];

  for (const tipo of tipos) {
    const prefix = `archivos/${presupuestoId}/${tipo}`;
    const { data, error } = await supabase.storage
      .from(PRESUPUESTO_PLANOS_BUCKET)
      .list(prefix, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("not found") || msg.includes("does not exist")) continue;
      return { data: [], error: new Error(error.message) };
    }
    for (const item of data ?? []) {
      if (!item.name || item.name === ".emptyFolderPlaceholder") continue;
      const meta = (item.metadata ?? {}) as { size?: number; mimetype?: string };
      out.push({
        name: item.name.replace(/^\d+-/, ""),
        mime: typeof meta.mimetype === "string" ? meta.mimetype : "",
        storagePath: `${prefix}/${item.name}`,
        size: typeof meta.size === "number" ? meta.size : 0,
        createdAt: item.created_at ?? new Date().toISOString(),
        tipo: tipoDesdePath(`${prefix}/${item.name}`),
      });
    }
  }

  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return { data: out, error: null };
}
