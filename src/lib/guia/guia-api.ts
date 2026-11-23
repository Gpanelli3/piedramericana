import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/**
 * Qué guías ya vio cada persona. Se guarda en `usuarios.guias_vistas` para que no
 * vuelvan a aparecer en otra computadora; localStorage queda como respaldo si la
 * base no responde.
 */

const claveLocal = (userId: string) => `marmogest:guias:${userId}`;

function leerLocal(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(claveLocal(userId));
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function escribirLocal(userId: string, vistas: string[]) {
  try {
    window.localStorage.setItem(claveLocal(userId), JSON.stringify(vistas));
  } catch {
    // sin almacenamiento local: no pasa nada, queda la base
  }
}

export async function leerGuiasVistas(userId: string): Promise<string[]> {
  const local = leerLocal(userId);
  if (!isSupabaseConfigured) return local;
  const { data, error } = await supabase
    .from("usuarios")
    .select("guias_vistas")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return local;
  const remotas = (data.guias_vistas ?? []) as string[];
  return [...new Set([...remotas, ...local])];
}

export async function guardarGuiasVistas(userId: string, vistas: string[]): Promise<void> {
  const unicas = [...new Set(vistas)];
  escribirLocal(userId, unicas);
  if (!isSupabaseConfigured) return;
  await supabase.from("usuarios").update({ guias_vistas: unicas }).eq("id", userId);
}
