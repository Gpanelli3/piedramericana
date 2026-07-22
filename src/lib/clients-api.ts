import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];

/** Vista usada por el wizard de presupuesto (mapeo amigable desde `clients`). */
export type ClientePresupuesto = {
  id: string;
  nombre: string;
  contacto: string;
  tel: string;
  email: string;
  direccion: string;
};

export function clientRowToClientePresupuesto(row: ClientRow): ClientePresupuesto {
  return {
    id: row.id,
    nombre: row.name,
    contacto: row.contact_name?.trim() || row.name,
    tel: row.phone ?? "",
    email: row.email ?? "",
    direccion: row.address ?? "",
  };
}

export async function listClients(): Promise<{
  data: ClientePresupuesto[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  return {
    data: (data ?? []).map((row) => clientRowToClientePresupuesto(row as ClientRow)),
    error: null,
  };
}

export async function createClient(input: {
  nombre: string;
  contacto?: string;
  tel?: string;
  email?: string;
  direccion?: string;
  notes?: string;
}): Promise<{ data: ClientePresupuesto | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }

  const name = input.nombre.trim();
  if (!name) {
    return { data: null, error: new Error("El nombre del cliente es obligatorio") };
  }

  const payload: ClientInsert = {
    name,
    contact_name: input.contacto?.trim() || null,
    phone: input.tel?.trim() || null,
    email: input.email?.trim() || null,
    address: input.direccion?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from("clients")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return {
    data: clientRowToClientePresupuesto(data as ClientRow),
    error: null,
  };
}
