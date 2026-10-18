import type { Database, IncentivoTipo } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { listEmpleados, nombreEmpleado, type EmpleadoRow } from "@/lib/empleados-api";
import { registrarMovimientoManual } from "@/lib/finanzas-api";
import { parseMonto } from "@/lib/sueldos-calculos";

export type IncentivoRow = Database["public"]["Tables"]["incentivos"]["Row"];

export type IncentivoConEmpleado = IncentivoRow & {
  empleados: Pick<EmpleadoRow, "nombre" | "apellido" | "puesto" | "activo"> | null;
};

export const INCENTIVO_TIPOS: { value: IncentivoTipo; label: string }[] = [
  { value: "comision", label: "Comisión" },
  { value: "premio", label: "Premio" },
  { value: "bono", label: "Bono" },
];

export function etiquetaIncentivoTipo(t: string | null | undefined): string {
  return INCENTIVO_TIPOS.find((x) => x.value === t)?.label ?? t ?? "—";
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function coerce(row: IncentivoRow): IncentivoRow {
  return { ...row, monto: num(row.monto) };
}

export type IncentivoInput = {
  empleado_id: string;
  fecha: string;
  tipo: IncentivoTipo;
  descripcion?: string;
  monto: number;
  moneda: "ars" | "usd";
  metodo: "efectivo" | "transferencia" | "cheque";
  notas?: string;
  created_by?: string | null;
};

export async function listIncentivos(): Promise<{
  data: IncentivoConEmpleado[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }
  const { data, error } = await supabase
    .from("incentivos")
    .select("*, empleados ( nombre, apellido, puesto, activo )")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: new Error(error.message) };
  return {
    data: ((data ?? []) as IncentivoConEmpleado[]).map((r) => ({ ...coerce(r), empleados: r.empleados })),
    error: null,
  };
}

export async function createIncentivo(
  input: IncentivoInput,
): Promise<{ data: IncentivoConEmpleado | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }
  const monto = parseMonto(input.monto);
  if (!(monto > 0)) return { data: null, error: new Error("El monto no es válido.") };
  if (!input.empleado_id) return { data: null, error: new Error("Elegí un empleado.") };

  const emps = await listEmpleados();
  const emp = emps.data.find((e) => e.id === input.empleado_id);
  const nombre = emp ? nombreEmpleado(emp) : "empleado";
  const tipoLbl = etiquetaIncentivoTipo(input.tipo);
  const mov = await registrarMovimientoManual({
    tipo: "egreso",
    monto,
    moneda: input.moneda,
    fecha: input.fecha,
    metodo: input.metodo,
    concepto: "sueldos",
    descripcion: input.descripcion?.trim() || `${tipoLbl} · ${nombre}`,
    created_by: input.created_by ?? null,
  });
  if (mov.error) return { data: null, error: mov.error };

  const { data, error } = await supabase
    .from("incentivos")
    .insert({
      empleado_id: input.empleado_id,
      fecha: input.fecha,
      tipo: input.tipo,
      descripcion: input.descripcion?.trim() || null,
      monto,
      moneda: input.moneda,
      metodo: input.metodo,
      movimiento_id: mov.id,
      notas: input.notas?.trim() || null,
      created_by: input.created_by ?? null,
    })
    .select("*, empleados ( nombre, apellido, puesto, activo )")
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: { ...coerce(data as IncentivoRow), empleados: (data as IncentivoConEmpleado).empleados }, error: null };
}

export async function deleteIncentivo(id: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no está configurado") };
  const prev = await supabase.from("incentivos").select("movimiento_id").eq("id", id).maybeSingle();
  if (prev.error) return { error: new Error(prev.error.message) };
  const del = await supabase.from("incentivos").delete().eq("id", id);
  if (del.error) return { error: new Error(del.error.message) };
  if (prev.data?.movimiento_id) {
    await supabase.from("movimientos_caja").delete().eq("id", prev.data.movimiento_id);
  }
  return { error: null };
}
