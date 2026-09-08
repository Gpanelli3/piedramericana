import type { Database } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type EmpleadoRow = Database["public"]["Tables"]["empleados"]["Row"];
type EmpleadoInsert = Database["public"]["Tables"]["empleados"]["Insert"];
type EmpleadoUpdate = Database["public"]["Tables"]["empleados"]["Update"];

export const PUESTOS_EMPLEADO = [
  { value: "vendedor", label: "Vendedor" },
  { value: "medidor", label: "Medidor" },
  { value: "cortador", label: "Cortador" },
  { value: "produccion", label: "Producción" },
  { value: "instalador", label: "Instalador" },
  { value: "reparador", label: "Reparador" },
  { value: "chofer", label: "Chofer" },
  { value: "administracion", label: "Administración" },
  { value: "otro", label: "Otro" },
] as const;

export type PuestoEmpleado = (typeof PUESTOS_EMPLEADO)[number]["value"];

export function puestoLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return PUESTOS_EMPLEADO.find((p) => p.value === v)?.label ?? v;
}

export function nombreEmpleado(e: { apellido: string; nombre: string }): string {
  return `${e.apellido}, ${e.nombre}`;
}

export type EmpleadoInput = {
  nombre: string;
  apellido: string;
  dni?: string;
  cuil?: string;
  telefono?: string;
  email?: string;
  fecha_ingreso?: string;
  puesto?: string;
  sueldo_base?: number;
  activo?: boolean;
  notas?: string;
};

function blankToNull(v: string | undefined): string | null {
  const t = v?.trim() ?? "";
  return t ? t : null;
}

function toPayload(input: EmpleadoInput): EmpleadoInsert | { error: string } {
  const nombre = input.nombre.trim();
  const apellido = input.apellido.trim();
  if (!nombre) return { error: "El nombre es obligatorio" };
  if (!apellido) return { error: "El apellido es obligatorio" };
  const sueldo = Number(input.sueldo_base ?? 0);
  if (!Number.isFinite(sueldo) || sueldo < 0) {
    return { error: "El sueldo base no es válido" };
  }
  return {
    nombre,
    apellido,
    dni: blankToNull(input.dni),
    cuil: blankToNull(input.cuil),
    telefono: blankToNull(input.telefono),
    email: blankToNull(input.email),
    fecha_ingreso: blankToNull(input.fecha_ingreso),
    puesto: blankToNull(input.puesto),
    sueldo_base: sueldo,
    activo: input.activo ?? true,
    notas: blankToNull(input.notas),
  };
}

function coerceRow(row: EmpleadoRow): EmpleadoRow {
  return { ...row, sueldo_base: Number(row.sueldo_base) || 0 };
}

function sortEmpleados(rows: EmpleadoRow[]): EmpleadoRow[] {
  return [...rows].sort((a, b) => {
    if (a.activo !== b.activo) return a.activo ? -1 : 1;
    const ap = a.apellido.localeCompare(b.apellido, "es");
    if (ap !== 0) return ap;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

export async function listEmpleados(): Promise<{
  data: EmpleadoRow[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }

  const { data, error } = await supabase
    .from("empleados")
    .select("*")
    .order("apellido", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  return {
    data: sortEmpleados(((data ?? []) as EmpleadoRow[]).map(coerceRow)),
    error: null,
  };
}

export async function createEmpleado(
  input: EmpleadoInput,
): Promise<{ data: EmpleadoRow | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }

  const payload = toPayload(input);
  if ("error" in payload) {
    return { data: null, error: new Error(payload.error) };
  }

  const { data, error } = await supabase
    .from("empleados")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: coerceRow(data as EmpleadoRow), error: null };
}

export async function updateEmpleado(
  id: string,
  input: EmpleadoInput,
): Promise<{ data: EmpleadoRow | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }

  const payload = toPayload(input);
  if ("error" in payload) {
    return { data: null, error: new Error(payload.error) };
  }

  const update: EmpleadoUpdate = {
    nombre: payload.nombre,
    apellido: payload.apellido,
    dni: payload.dni,
    cuil: payload.cuil,
    telefono: payload.telefono,
    email: payload.email,
    fecha_ingreso: payload.fecha_ingreso,
    puesto: payload.puesto,
    sueldo_base: payload.sueldo_base,
    activo: payload.activo,
    notas: payload.notas,
  };

  const { data, error } = await supabase
    .from("empleados")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: coerceRow(data as EmpleadoRow), error: null };
}
