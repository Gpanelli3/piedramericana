import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
export type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

/** Vista usada por el wizard de presupuesto y el módulo Clientes. */
export type ClientePresupuesto = {
  id: string;
  nombre: string;
  contacto: string;
  tel: string;
  email: string;
  direccion: string;
  notes: string;
};

export type ClienteInput = {
  nombre: string;
  contacto?: string;
  tel?: string;
  email?: string;
  direccion?: string;
  notes?: string;
};

export function clientRowToClientePresupuesto(row: ClientRow): ClientePresupuesto {
  return {
    id: row.id,
    nombre: row.name,
    contacto: row.contact_name?.trim() || row.name,
    tel: row.phone ?? "",
    email: row.email ?? "",
    direccion: row.address ?? "",
    notes: row.notes ?? "",
  };
}

function toInsertPayload(input: ClienteInput): ClientInsert | { error: string } {
  const name = input.nombre.trim();
  if (!name) {
    return { error: "El nombre del cliente es obligatorio" };
  }
  return {
    name,
    contact_name: input.contacto?.trim() || null,
    phone: input.tel?.trim() || null,
    email: input.email?.trim() || null,
    address: input.direccion?.trim() || null,
    notes: input.notes?.trim() || null,
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

export async function createClient(
  input: ClienteInput,
): Promise<{ data: ClientePresupuesto | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }

  const payload = toInsertPayload(input);
  if ("error" in payload) {
    return { data: null, error: new Error(payload.error) };
  }

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

export async function updateClient(
  id: string,
  input: ClienteInput,
): Promise<{ data: ClientePresupuesto | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }

  const payload = toInsertPayload(input);
  if ("error" in payload) {
    return { data: null, error: new Error(payload.error) };
  }

  const update: ClientUpdate = {
    name: payload.name,
    contact_name: payload.contact_name,
    phone: payload.phone,
    email: payload.email,
    address: payload.address,
    notes: payload.notes,
  };

  const { data, error } = await supabase
    .from("clients")
    .update(update)
    .eq("id", id)
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
