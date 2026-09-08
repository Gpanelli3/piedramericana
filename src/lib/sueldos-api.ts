import type { Database, LiquidacionConceptoTipo, LiquidacionEstado } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { listEmpleados, type EmpleadoRow } from "@/lib/empleados-api";
import {
  calcularTotalesLiquidacion,
  formatFechaIso,
  hoyIso,
  pagosAlCerrar,
  parseMonto,
} from "@/lib/sueldos-calculos";

export type AdelantoRow = Database["public"]["Tables"]["adelantos_empleado"]["Row"];
export type LiquidacionRow = Database["public"]["Tables"]["liquidaciones"]["Row"];
export type LiquidacionConceptoRow = Database["public"]["Tables"]["liquidacion_conceptos"]["Row"];

type EmpleadoMini = Pick<EmpleadoRow, "id" | "nombre" | "apellido" | "puesto" | "activo" | "sueldo_base">;

export type AdelantoConEmpleado = AdelantoRow & {
  empleados: Pick<EmpleadoRow, "nombre" | "apellido" | "puesto" | "activo"> | null;
};

export type LiquidacionConDetalle = LiquidacionRow & {
  empleados: Pick<EmpleadoRow, "nombre" | "apellido" | "puesto" | "activo"> | null;
  liquidacion_conceptos: LiquidacionConceptoRow[];
};

export type AdelantoInput = {
  empleado_id: string;
  monto: number;
  fecha: string;
  metodo: AdelantoRow["metodo"];
  notas?: string;
  created_by?: string | null;
};

export type ConceptoInput = {
  tipo: LiquidacionConceptoTipo;
  descripcion: string;
  monto: number;
  referencia_id?: string | null;
};

export type LiquidacionInput = {
  empleado_id: string;
  periodo_mes: number;
  periodo_anio: number;
  conceptos: ConceptoInput[];
  pago_efectivo_15: number;
  pago_banco_30: number;
  pago_efectivo_30: number;
  notas?: string;
  created_by?: string | null;
};

function blankToNull(v: string | undefined): string | null {
  const t = v?.trim() ?? "";
  return t ? t : null;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function coerceAdelanto(row: AdelantoRow): AdelantoRow {
  return { ...row, monto: num(row.monto) };
}

function coerceConcepto(row: LiquidacionConceptoRow): LiquidacionConceptoRow {
  return { ...row, monto: num(row.monto) };
}

function coerceLiquidacion(row: LiquidacionRow): LiquidacionRow {
  return {
    ...row,
    total_bruto: num(row.total_bruto),
    total_descuentos: num(row.total_descuentos),
    total_neto: num(row.total_neto),
    pago_efectivo_15: num(row.pago_efectivo_15),
    pago_banco_30: num(row.pago_banco_30),
    pago_efectivo_30: num(row.pago_efectivo_30),
  };
}

function coerceLiquidacionDetalle(row: LiquidacionConDetalle): LiquidacionConDetalle {
  return {
    ...coerceLiquidacion(row),
    empleados: row.empleados,
    liquidacion_conceptos: (row.liquidacion_conceptos ?? []).map(coerceConcepto),
  };
}

async function resolveUsuariosCreatedBy(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const { data, error } = await supabase.from("usuarios").select("id").eq("id", userId).maybeSingle();
  if (error || !data?.id) return null;
  return data.id;
}

function uniqueViolation(err: { code?: string; message?: string } | null): boolean {
  return err?.code === "23505" || (err?.message ?? "").toLowerCase().includes("duplicate");
}

export async function listAdelantos(opts?: {
  empleadoId?: string;
  pendientes?: boolean;
}): Promise<{ data: AdelantoConEmpleado[]; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }

  let q = supabase
    .from("adelantos_empleado")
    .select("*, empleados(nombre, apellido, puesto, activo)")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (opts?.empleadoId) q = q.eq("empleado_id", opts.empleadoId);
  if (opts?.pendientes) q = q.is("liquidacion_id", null);

  const { data, error } = await q;
  if (error) return { data: [], error: new Error(error.message) };

  const rows = ((data ?? []) as AdelantoConEmpleado[]).map((r) => ({
    ...coerceAdelanto(r),
    empleados: r.empleados,
  }));
  return { data: rows, error: null };
}

export async function createAdelanto(
  input: AdelantoInput,
): Promise<{ data: AdelantoConEmpleado | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }
  if (!input.empleado_id) return { data: null, error: new Error("Elegí un empleado") };
  const monto = Number(input.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return { data: null, error: new Error("El monto tiene que ser mayor a 0") };
  }
  if (!input.fecha) return { data: null, error: new Error("La fecha es obligatoria") };
  if (input.metodo !== "efectivo" && input.metodo !== "transferencia") {
    return { data: null, error: new Error("El método no es válido") };
  }

  const createdBy = await resolveUsuariosCreatedBy(input.created_by);
  const { data, error } = await supabase
    .from("adelantos_empleado")
    .insert({
      empleado_id: input.empleado_id,
      monto,
      fecha: input.fecha,
      metodo: input.metodo,
      notas: blankToNull(input.notas),
      created_by: createdBy,
    })
    .select("*, empleados(nombre, apellido, puesto, activo)")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  const row = data as AdelantoConEmpleado;
  return { data: { ...coerceAdelanto(row), empleados: row.empleados }, error: null };
}

export async function updateAdelanto(
  id: string,
  input: AdelantoInput,
): Promise<{ data: AdelantoConEmpleado | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }

  const { data: actual, error: loadErr } = await supabase
    .from("adelantos_empleado")
    .select("id, liquidacion_id")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) return { data: null, error: new Error(loadErr.message) };
  if (!actual) return { data: null, error: new Error("Adelanto no encontrado") };
  if (actual.liquidacion_id) {
    return { data: null, error: new Error("Este adelanto ya está en una liquidación; no se puede editar") };
  }

  const monto = Number(input.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return { data: null, error: new Error("El monto tiene que ser mayor a 0") };
  }
  if (!input.empleado_id) return { data: null, error: new Error("Elegí un empleado") };
  if (!input.fecha) return { data: null, error: new Error("La fecha es obligatoria") };

  const { data, error } = await supabase
    .from("adelantos_empleado")
    .update({
      empleado_id: input.empleado_id,
      monto,
      fecha: input.fecha,
      metodo: input.metodo,
      notas: blankToNull(input.notas),
    })
    .eq("id", id)
    .select("*, empleados(nombre, apellido, puesto, activo)")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  const row = data as AdelantoConEmpleado;
  return { data: { ...coerceAdelanto(row), empleados: row.empleados }, error: null };
}

export async function deleteAdelanto(id: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error("Supabase no está configurado") };
  }
  const { data: actual, error: loadErr } = await supabase
    .from("adelantos_empleado")
    .select("id, liquidacion_id")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) return { error: new Error(loadErr.message) };
  if (!actual) return { error: new Error("Adelanto no encontrado") };
  if (actual.liquidacion_id) {
    return { error: new Error("Este adelanto ya está en una liquidación; no se puede borrar") };
  }
  const { error } = await supabase.from("adelantos_empleado").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function listLiquidaciones(opts: {
  mes: number;
  anio: number;
}): Promise<{ data: LiquidacionConDetalle[]; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }
  const { data, error } = await supabase
    .from("liquidaciones")
    .select("*, empleados(nombre, apellido, puesto, activo), liquidacion_conceptos(*)")
    .eq("periodo_mes", opts.mes)
    .eq("periodo_anio", opts.anio)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: new Error(error.message) };
  return {
    data: ((data ?? []) as LiquidacionConDetalle[]).map(coerceLiquidacionDetalle),
    error: null,
  };
}

export async function getLiquidacion(
  id: string,
): Promise<{ data: LiquidacionConDetalle | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }
  const { data, error } = await supabase
    .from("liquidaciones")
    .select("*, empleados(nombre, apellido, puesto, activo), liquidacion_conceptos(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };
  return { data: coerceLiquidacionDetalle(data as LiquidacionConDetalle), error: null };
}

function validarConceptos(conceptos: ConceptoInput[]): { ok: ConceptoInput[] } | { error: string } {
  const ok: ConceptoInput[] = [];
  for (const c of conceptos) {
    const descripcion = c.descripcion.trim();
    const monto = parseMonto(c.monto);
    if (!descripcion) return { error: "Cada concepto necesita una descripción" };
    if (!Number.isFinite(monto) || monto <= 0) {
      return { error: "Cada concepto necesita un monto mayor a 0" };
    }
    ok.push({
      tipo: c.tipo,
      descripcion,
      monto,
      referencia_id: c.referencia_id ?? null,
    });
  }
  if (ok.length === 0) return { error: "Agregá al menos un concepto" };
  return { ok };
}

async function syncConceptos(liquidacionId: string, conceptos: ConceptoInput[]): Promise<Error | null> {
  const { error: delErr } = await supabase
    .from("liquidacion_conceptos")
    .delete()
    .eq("liquidacion_id", liquidacionId);
  if (delErr) return new Error(delErr.message);

  if (conceptos.length === 0) return null;
  const { error } = await supabase.from("liquidacion_conceptos").insert(
    conceptos.map((c) => ({
      liquidacion_id: liquidacionId,
      tipo: c.tipo,
      descripcion: c.descripcion,
      monto: c.monto,
      referencia_id: c.referencia_id ?? null,
    })),
  );
  return error ? new Error(error.message) : null;
}

async function syncAdelantosVinculados(
  liquidacionId: string,
  conceptos: ConceptoInput[],
): Promise<Error | null> {
  const ids = [
    ...new Set(
      conceptos
        .filter((c) => c.tipo === "adelanto" && c.referencia_id)
        .map((c) => c.referencia_id as string),
    ),
  ];

  const { error: clearErr } = await supabase
    .from("adelantos_empleado")
    .update({ liquidacion_id: null })
    .eq("liquidacion_id", liquidacionId);
  if (clearErr) return new Error(clearErr.message);

  if (ids.length === 0) return null;
  const { error } = await supabase
    .from("adelantos_empleado")
    .update({ liquidacion_id: liquidacionId })
    .in("id", ids)
    .is("liquidacion_id", null);
  if (error) return new Error(error.message);
  return null;
}

async function fetchDetalle(id: string): Promise<{ data: LiquidacionConDetalle | null; error: Error | null }> {
  return getLiquidacion(id);
}

export async function saveLiquidacion(
  input: LiquidacionInput,
  opts?: { id?: string },
): Promise<{ data: LiquidacionConDetalle | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }
  if (!input.empleado_id) return { data: null, error: new Error("Elegí un empleado") };
  if (input.periodo_mes < 1 || input.periodo_mes > 12) {
    return { data: null, error: new Error("El mes no es válido") };
  }
  if (input.periodo_anio < 2000 || input.periodo_anio > 2100) {
    return { data: null, error: new Error("El año no es válido") };
  }
  const parsed = validarConceptos(input.conceptos);
  if ("error" in parsed) return { data: null, error: new Error(parsed.error) };

  const totales = calcularTotalesLiquidacion(parsed.ok);
  const pagos = {
    pago_efectivo_15: Number(input.pago_efectivo_15) || 0,
    pago_banco_30: Number(input.pago_banco_30) || 0,
    pago_efectivo_30: Number(input.pago_efectivo_30) || 0,
  };

  if (opts?.id) {
    const { data: actual, error: loadErr } = await supabase
      .from("liquidaciones")
      .select("id, estado")
      .eq("id", opts.id)
      .maybeSingle();
    if (loadErr) return { data: null, error: new Error(loadErr.message) };
    if (!actual) return { data: null, error: new Error("Liquidación no encontrada") };
    if ((actual.estado as LiquidacionEstado) === "cerrada") {
      return { data: null, error: new Error("La liquidación está cerrada; reapriala para editar") };
    }

    const { error: updErr } = await supabase
      .from("liquidaciones")
      .update({
        empleado_id: input.empleado_id,
        periodo_mes: input.periodo_mes,
        periodo_anio: input.periodo_anio,
        ...totales,
        ...pagos,
        notas: blankToNull(input.notas),
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.id);
    if (updErr) {
      if (uniqueViolation(updErr)) {
        return { data: null, error: new Error("Ya hay una liquidación de ese empleado para ese mes") };
      }
      return { data: null, error: new Error(updErr.message) };
    }

    const cErr = await syncConceptos(opts.id, parsed.ok);
    if (cErr) return { data: null, error: cErr };
    const aErr = await syncAdelantosVinculados(opts.id, parsed.ok);
    if (aErr) return { data: null, error: aErr };
    return fetchDetalle(opts.id);
  }

  const createdBy = await resolveUsuariosCreatedBy(input.created_by);
  const { data: inserted, error: insErr } = await supabase
    .from("liquidaciones")
    .insert({
      empleado_id: input.empleado_id,
      periodo_mes: input.periodo_mes,
      periodo_anio: input.periodo_anio,
      estado: "borrador",
      ...totales,
      ...pagos,
      notas: blankToNull(input.notas),
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    if (uniqueViolation(insErr)) {
      return { data: null, error: new Error("Ya hay una liquidación de ese empleado para ese mes") };
    }
    return { data: null, error: new Error(insErr?.message ?? "No se pudo crear la liquidación") };
  }

  const cErr = await syncConceptos(inserted.id, parsed.ok);
  if (cErr) {
    await supabase.from("liquidacion_conceptos").delete().eq("liquidacion_id", inserted.id);
    await supabase.from("liquidaciones").delete().eq("id", inserted.id);
    return { data: null, error: cErr };
  }
  const aErr = await syncAdelantosVinculados(inserted.id, parsed.ok);
  if (aErr) return { data: null, error: aErr };
  return fetchDetalle(inserted.id);
}

export async function cerrarLiquidacion(
  id: string,
): Promise<{ data: LiquidacionConDetalle | null; error: Error | null }> {
  const actual = await getLiquidacion(id);
  if (actual.error) return actual;
  if (!actual.data) return { data: null, error: new Error("Liquidación no encontrada") };
  if (actual.data.estado === "cerrada") return actual;

  const totales = calcularTotalesLiquidacion(actual.data.liquidacion_conceptos);
  const pagos = pagosAlCerrar(
    {
      pago_efectivo_15: actual.data.pago_efectivo_15,
      pago_banco_30: actual.data.pago_banco_30,
      pago_efectivo_30: actual.data.pago_efectivo_30,
    },
    totales.total_neto,
  );

  const { error } = await supabase
    .from("liquidaciones")
    .update({
      estado: "cerrada",
      fecha_cierre: hoyIso(),
      ...totales,
      ...pagos,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { data: null, error: new Error(error.message) };
  return fetchDetalle(id);
}

export async function reabrirLiquidacion(
  id: string,
): Promise<{ data: LiquidacionConDetalle | null; error: Error | null }> {
  const { error } = await supabase
    .from("liquidaciones")
    .update({
      estado: "borrador",
      fecha_cierre: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { data: null, error: new Error(error.message) };
  return fetchDetalle(id);
}

export async function deleteLiquidacion(id: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error("Supabase no está configurado") };
  }
  const { data: actual, error: loadErr } = await supabase
    .from("liquidaciones")
    .select("id, estado")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) return { error: new Error(loadErr.message) };
  if (!actual) return { error: new Error("Liquidación no encontrada") };
  if ((actual.estado as LiquidacionEstado) === "cerrada") {
    return { error: new Error("Reabrí la liquidación antes de borrarla") };
  }

  const { error: unlinkErr } = await supabase
    .from("adelantos_empleado")
    .update({ liquidacion_id: null })
    .eq("liquidacion_id", id);
  if (unlinkErr) return { error: new Error(unlinkErr.message) };

  const { error: concErr } = await supabase
    .from("liquidacion_conceptos")
    .delete()
    .eq("liquidacion_id", id);
  if (concErr) return { error: new Error(concErr.message) };

  const { error } = await supabase.from("liquidaciones").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export function conceptosDesdeEmpleadoYAdelantos(
  empleado: Pick<EmpleadoMini, "sueldo_base">,
  adelantos: AdelantoRow[],
): ConceptoInput[] {
  const conceptos: ConceptoInput[] = [];
  const base = num(empleado.sueldo_base);
  if (base > 0) {
    conceptos.push({
      tipo: "sueldo_base",
      descripcion: "Sueldo base",
      monto: base,
    });
  }
  for (const a of adelantos) {
    conceptos.push({
      tipo: "adelanto",
      descripcion: `Adelanto ${formatFechaIso(a.fecha)}`,
      monto: num(a.monto),
      referencia_id: a.id,
    });
  }
  return conceptos;
}

export async function armarLiquidacionesDelMes(opts: {
  mes: number;
  anio: number;
  created_by?: string | null;
}): Promise<{ creadas: number; omitidas: number; error: Error | null }> {
  const empleadosRes = await listEmpleados();
  if (empleadosRes.error) return { creadas: 0, omitidas: 0, error: empleadosRes.error };
  const activos = empleadosRes.data.filter((e) => e.activo);

  const existentes = await listLiquidaciones({ mes: opts.mes, anio: opts.anio });
  if (existentes.error) return { creadas: 0, omitidas: 0, error: existentes.error };
  const ya = new Set(existentes.data.map((l) => l.empleado_id));

  const adelantosRes = await listAdelantos({ pendientes: true });
  if (adelantosRes.error) return { creadas: 0, omitidas: 0, error: adelantosRes.error };

  let creadas = 0;
  let omitidas = 0;
  for (const emp of activos) {
    if (ya.has(emp.id)) {
      omitidas += 1;
      continue;
    }
    const adelantos = adelantosRes.data.filter((a) => a.empleado_id === emp.id);
    const conceptos = conceptosDesdeEmpleadoYAdelantos(emp, adelantos).filter((c) => c.monto > 0);
    if (conceptos.length === 0) {
      omitidas += 1;
      continue;
    }
    const saved = await saveLiquidacion({
      empleado_id: emp.id,
      periodo_mes: opts.mes,
      periodo_anio: opts.anio,
      conceptos,
      pago_efectivo_15: 0,
      pago_banco_30: 0,
      pago_efectivo_30: 0,
      created_by: opts.created_by,
    });
    if (saved.error) return { creadas, omitidas, error: saved.error };
    creadas += 1;
  }
  return { creadas, omitidas, error: null };
}
