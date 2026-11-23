import type { Database, LiquidacionConceptoTipo } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { listEmpleados, type EmpleadoRow } from "@/lib/empleados-api";
import {
  calcularTotalesLiquidacion,
  formatFechaIso,
  hoyIso,
  parseMonto,
} from "@/lib/sueldos-calculos";

export type AdelantoRow = Database["public"]["Tables"]["adelantos_empleado"]["Row"];
export type LiquidacionRow = Database["public"]["Tables"]["liquidaciones"]["Row"];
export type LiquidacionConceptoRow = Database["public"]["Tables"]["liquidacion_conceptos"]["Row"];
export type LiquidacionPagoRow = Database["public"]["Tables"]["liquidacion_pagos"]["Row"];

type EmpleadoMini = Pick<EmpleadoRow, "id" | "nombre" | "apellido" | "puesto" | "activo" | "sueldo_base">;

export type AdelantoConEmpleado = AdelantoRow & {
  empleados: Pick<EmpleadoRow, "nombre" | "apellido" | "puesto" | "activo"> | null;
};

export type LiquidacionConDetalle = LiquidacionRow & {
  empleados: Pick<EmpleadoRow, "nombre" | "apellido" | "puesto" | "activo"> | null;
  liquidacion_conceptos: LiquidacionConceptoRow[];
  liquidacion_pagos: LiquidacionPagoRow[];
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

export type PagoInput = {
  fecha: string;
  monto: number;
};

export type LiquidacionInput = {
  empleado_id: string;
  periodo_mes: number;
  periodo_anio: number;
  conceptos: ConceptoInput[];
  pagos: PagoInput[];
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

function coercePago(row: LiquidacionPagoRow): LiquidacionPagoRow {
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
    liquidacion_pagos: (row.liquidacion_pagos ?? [])
      .map(coercePago)
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
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
    .select("*, empleados(nombre, apellido, puesto, activo), liquidacion_conceptos(*), liquidacion_pagos(*)")
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
    .select("*, empleados(nombre, apellido, puesto, activo), liquidacion_conceptos(*), liquidacion_pagos(*)")
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

async function syncPagos(liquidacionId: string, pagos: PagoInput[]): Promise<Error | null> {
  const { error: delErr } = await supabase
    .from("liquidacion_pagos")
    .delete()
    .eq("liquidacion_id", liquidacionId);
  if (delErr) return new Error(delErr.message);
  if (pagos.length === 0) return null;
  const { error } = await supabase.from("liquidacion_pagos").insert(
    pagos.map((p) => ({ liquidacion_id: liquidacionId, fecha: p.fecha, monto: p.monto })),
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
  const pagosOk: PagoInput[] = [];
  for (const p of input.pagos) {
    const monto = parseMonto(p.monto);
    if (!p.fecha) return { data: null, error: new Error("Cada pago necesita una fecha") };
    if (!Number.isFinite(monto) || monto <= 0) {
      return { data: null, error: new Error("Cada pago necesita un monto mayor a 0") };
    }
    pagosOk.push({ fecha: p.fecha, monto });
  }

  if (opts?.id) {
    const { error: updErr } = await supabase
      .from("liquidaciones")
      .update({
        empleado_id: input.empleado_id,
        periodo_mes: input.periodo_mes,
        periodo_anio: input.periodo_anio,
        ...totales,
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
    const pErr = await syncPagos(opts.id, pagosOk);
    if (pErr) return { data: null, error: pErr };
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
  const pErr = await syncPagos(inserted.id, pagosOk);
  if (pErr) return { data: null, error: pErr };
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
  const { error } = await supabase
    .from("liquidaciones")
    .update({
      estado: "cerrada",
      fecha_cierre: hoyIso(),
      ...totales,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { data: null, error: new Error(error.message) };
  return fetchDetalle(id);
}

/** Registra un pago (se guarda en el acto, no depende de "Guardar"). */
export async function registrarPagoLiquidacion(
  liquidacionId: string,
  pago: PagoInput,
): Promise<{ data: LiquidacionConDetalle | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }
  const monto = parseMonto(pago.monto);
  if (!pago.fecha) return { data: null, error: new Error("Indicá la fecha del pago") };
  if (!Number.isFinite(monto) || monto <= 0) {
    return { data: null, error: new Error("El monto del pago tiene que ser mayor a 0") };
  }
  const { error } = await supabase
    .from("liquidacion_pagos")
    .insert({ liquidacion_id: liquidacionId, fecha: pago.fecha, monto });
  if (error) return { data: null, error: new Error(error.message) };
  return fetchDetalle(liquidacionId);
}

export async function quitarPagoLiquidacion(
  liquidacionId: string,
  pagoId: string,
): Promise<{ data: LiquidacionConDetalle | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }
  const { error } = await supabase
    .from("liquidacion_pagos")
    .delete()
    .eq("id", pagoId)
    .eq("liquidacion_id", liquidacionId);
  if (error) return { data: null, error: new Error(error.message) };
  return fetchDetalle(liquidacionId);
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
  const { error: unlinkErr } = await supabase
    .from("adelantos_empleado")
    .update({ liquidacion_id: null })
    .eq("liquidacion_id", id);
  if (unlinkErr) return { error: new Error(unlinkErr.message) };

  const { error: pagosErr } = await supabase
    .from("liquidacion_pagos")
    .delete()
    .eq("liquidacion_id", id);
  if (pagosErr) return { error: new Error(pagosErr.message) };

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

/**
 * Deja al día los sueldos de un mes, sin intervención del usuario:
 * - crea el sueldo de cada empleado activo que todavía no tiene (sueldo base + adelantos pendientes);
 * - suma a los sueldos ya creados los adelantos que quedaron pendientes después.
 */
type ResultadoSync = { creadas: number; actualizadas: number; error: Error | null };
const syncEnCurso = new Map<string, Promise<ResultadoSync>>();

export function sincronizarSueldosDelMes(opts: {
  mes: number;
  anio: number;
  created_by?: string | null;
}): Promise<ResultadoSync> {
  // Evita corridas simultáneas del mismo mes (duplicarían conceptos).
  const key = `${opts.anio}-${opts.mes}`;
  const previa = syncEnCurso.get(key);
  if (previa) return previa;
  const p = sincronizar(opts).finally(() => syncEnCurso.delete(key));
  syncEnCurso.set(key, p);
  return p;
}

async function sincronizar(opts: {
  mes: number;
  anio: number;
  created_by?: string | null;
}): Promise<ResultadoSync> {
  const fail = (error: Error) => ({ creadas: 0, actualizadas: 0, error });
  const empleadosRes = await listEmpleados();
  if (empleadosRes.error) return fail(empleadosRes.error);
  const activos = empleadosRes.data.filter((e) => e.activo);

  const existentes = await listLiquidaciones({ mes: opts.mes, anio: opts.anio });
  if (existentes.error) return fail(existentes.error);
  const porEmpleado = new Map(existentes.data.map((l) => [l.empleado_id, l]));

  const adelantosRes = await listAdelantos({ pendientes: true });
  if (adelantosRes.error) return fail(adelantosRes.error);

  let creadas = 0;
  let actualizadas = 0;

  // Adelantos nuevos para sueldos ya creados
  for (const liq of existentes.data) {
    const nuevos = adelantosRes.data.filter((a) => a.empleado_id === liq.empleado_id);
    if (nuevos.length === 0) continue;
    const conceptos: ConceptoInput[] = [
      ...liq.liquidacion_conceptos.map((c) => ({
        tipo: c.tipo,
        descripcion: c.descripcion,
        monto: num(c.monto),
        referencia_id: c.referencia_id,
      })),
      ...nuevos.map((a) => ({
        tipo: "adelanto" as const,
        descripcion: `Adelanto ${formatFechaIso(a.fecha)}`,
        monto: num(a.monto),
        referencia_id: a.id,
      })),
    ];
    const saved = await saveLiquidacion(
      {
        empleado_id: liq.empleado_id,
        periodo_mes: liq.periodo_mes,
        periodo_anio: liq.periodo_anio,
        conceptos,
        pagos: liq.liquidacion_pagos.map((p) => ({ fecha: p.fecha, monto: num(p.monto) })),
        notas: liq.notas ?? undefined,
      },
      { id: liq.id },
    );
    if (saved.error) return fail(saved.error);
    actualizadas += 1;
  }

  // Sueldos que faltan
  for (const emp of activos) {
    if (porEmpleado.has(emp.id)) continue;
    const adelantos = adelantosRes.data.filter((a) => a.empleado_id === emp.id);
    const conceptos = conceptosDesdeEmpleadoYAdelantos(emp, adelantos).filter((c) => c.monto > 0);
    if (conceptos.length === 0) continue;
    const saved = await saveLiquidacion({
      empleado_id: emp.id,
      periodo_mes: opts.mes,
      periodo_anio: opts.anio,
      conceptos,
      pagos: [],
      created_by: opts.created_by,
    });
    // Si otra carga simultánea ya lo creó, no es un error.
    if (saved.error && !saved.error.message.includes("Ya hay una liquidación")) {
      return { creadas, actualizadas, error: saved.error };
    }
    if (!saved.error) creadas += 1;
  }
  return { creadas, actualizadas, error: null };
}

export type LiquidacionConPagos = LiquidacionRow & { liquidacion_pagos: LiquidacionPagoRow[] };

export async function listLiquidacionesEmpleado(
  empleadoId: string,
): Promise<{ data: LiquidacionConPagos[]; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }
  const { data, error } = await supabase
    .from("liquidaciones")
    .select("*, liquidacion_pagos(*)")
    .eq("empleado_id", empleadoId)
    .order("periodo_anio", { ascending: false })
    .order("periodo_mes", { ascending: false });
  if (error) return { data: [], error: new Error(error.message) };
  return {
    data: ((data ?? []) as LiquidacionConPagos[]).map((r) => ({
      ...coerceLiquidacion(r),
      liquidacion_pagos: (r.liquidacion_pagos ?? []).map(coercePago),
    })),
    error: null,
  };
}
