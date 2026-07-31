import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type CuentaFinancieraRow = Database["public"]["Tables"]["cuentas_financieras"]["Row"];
export type MovimientoCajaRow = Database["public"]["Tables"]["movimientos_caja"]["Row"];
export type CierreCajaRow = Database["public"]["Tables"]["cierres_caja"]["Row"];
export type SaldoCuentaRow = Database["public"]["Views"]["v_saldos_cuentas"]["Row"];

export type TipoMovimiento = MovimientoCajaRow["tipo"];

export async function listCuentasActivas(): Promise<{
  data: CuentaFinancieraRow[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("cuentas_financieras")
    .select("*")
    .eq("activa", true)
    .order("nombre");
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as CuentaFinancieraRow[], error: null };
}

export async function listSaldosCuentas(): Promise<{
  data: SaldoCuentaRow[];
  error: Error | null;
}> {
  const { data, error } = await supabase.from("v_saldos_cuentas").select("*").order("nombre");
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as SaldoCuentaRow[], error: null };
}

export async function listMovimientos(opts?: {
  cuentaId?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
}): Promise<{ data: MovimientoCajaRow[]; error: Error | null }> {
  let q = supabase
    .from("movimientos_caja")
    .select("*")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (opts?.cuentaId) q = q.eq("cuenta_id", opts.cuentaId);
  if (opts?.desde) q = q.gte("fecha", opts.desde);
  if (opts?.hasta) q = q.lte("fecha", opts.hasta);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as MovimientoCajaRow[], error: null };
}

export async function registrarMovimientoManual(opts: {
  cuentaId: string;
  tipo: "ingreso" | "egreso";
  monto: number;
  moneda: "ars" | "usd";
  fecha: string;
  descripcion?: string;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  if (!Number.isFinite(opts.monto) || opts.monto <= 0) {
    return { error: new Error("Monto inválido.") };
  }
  const { error } = await supabase.from("movimientos_caja").insert({
    cuenta_id: opts.cuentaId,
    tipo: opts.tipo,
    monto: opts.monto,
    moneda: opts.moneda,
    fecha: opts.fecha,
    descripcion: opts.descripcion?.trim() || null,
    referencia_tipo: "manual",
    created_by: opts.created_by ?? null,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function transferirEntreCuentas(opts: {
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  monto: number;
  moneda: "ars" | "usd";
  fecha: string;
  descripcion?: string;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  if (opts.cuentaOrigenId === opts.cuentaDestinoId) {
    return { error: new Error("Elegí cuentas distintas.") };
  }
  if (!Number.isFinite(opts.monto) || opts.monto <= 0) {
    return { error: new Error("Monto inválido.") };
  }

  const grupoId = crypto.randomUUID();
  const desc = opts.descripcion?.trim() || "Transferencia entre cuentas";

  const salida = await supabase.from("movimientos_caja").insert({
    cuenta_id: opts.cuentaOrigenId,
    tipo: "transferencia_salida",
    monto: opts.monto,
    moneda: opts.moneda,
    fecha: opts.fecha,
    descripcion: desc,
    referencia_tipo: "transferencia",
    cuenta_contraparte_id: opts.cuentaDestinoId,
    transferencia_grupo_id: grupoId,
    created_by: opts.created_by ?? null,
  });
  if (salida.error) return { error: new Error(salida.error.message) };

  const entrada = await supabase.from("movimientos_caja").insert({
    cuenta_id: opts.cuentaDestinoId,
    tipo: "transferencia_entrada",
    monto: opts.monto,
    moneda: opts.moneda,
    fecha: opts.fecha,
    descripcion: desc,
    referencia_tipo: "transferencia",
    cuenta_contraparte_id: opts.cuentaOrigenId,
    transferencia_grupo_id: grupoId,
    created_by: opts.created_by ?? null,
  });
  if (entrada.error) return { error: new Error(entrada.error.message) };

  return { error: null };
}

/** Crea movimiento de ingreso vinculado a un cobro de venta. */
export async function registrarMovimientoPorCobro(opts: {
  cuentaId: string;
  pagoId: string;
  monto: number;
  moneda: "ars" | "usd";
  fecha: string;
  descripcion: string;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("movimientos_caja").insert({
    cuenta_id: opts.cuentaId,
    tipo: "ingreso",
    monto: opts.monto,
    moneda: opts.moneda,
    fecha: opts.fecha,
    descripcion: opts.descripcion,
    referencia_tipo: "venta_pago",
    referencia_id: opts.pagoId,
    created_by: opts.created_by ?? null,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function calcularSaldoCuentaEnFecha(
  cuentaId: string,
  fecha: string,
): Promise<{ saldo: number; error: Error | null }> {
  const cuentaRes = await supabase
    .from("cuentas_financieras")
    .select("saldo_inicial")
    .eq("id", cuentaId)
    .maybeSingle();
  if (cuentaRes.error) return { saldo: 0, error: new Error(cuentaRes.error.message) };
  if (!cuentaRes.data) return { saldo: 0, error: new Error("Cuenta no encontrada.") };

  const movRes = await supabase
    .from("movimientos_caja")
    .select("tipo, monto")
    .eq("cuenta_id", cuentaId)
    .lte("fecha", fecha);
  if (movRes.error) return { saldo: 0, error: new Error(movRes.error.message) };

  let neto = Number(cuentaRes.data.saldo_inicial ?? 0);
  for (const m of movRes.data ?? []) {
    const val = Number(m.monto);
    if (m.tipo === "ingreso" || m.tipo === "transferencia_entrada") neto += val;
    else if (m.tipo === "egreso" || m.tipo === "transferencia_salida") neto -= val;
  }
  return { saldo: neto, error: null };
}

export async function listCierresCaja(opts?: {
  cuentaId?: string;
  limit?: number;
}): Promise<{ data: CierreCajaRow[]; error: Error | null }> {
  let q = supabase.from("cierres_caja").select("*").order("fecha", { ascending: false });
  if (opts?.cuentaId) q = q.eq("cuenta_id", opts.cuentaId);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as CierreCajaRow[], error: null };
}

export async function registrarCierreCaja(opts: {
  cuentaId: string;
  fecha: string;
  saldoArqueo?: number | null;
  notas?: string;
  cerrado_por?: string | null;
}): Promise<{ error: Error | null }> {
  const { saldo, error: sErr } = await calcularSaldoCuentaEnFecha(opts.cuentaId, opts.fecha);
  if (sErr) return { error: sErr };

  const { error } = await supabase.from("cierres_caja").upsert(
    {
      cuenta_id: opts.cuentaId,
      fecha: opts.fecha,
      saldo_calculado: saldo,
      saldo_arqueo: opts.saldoArqueo ?? null,
      notas: opts.notas?.trim() || null,
      cerrado_por: opts.cerrado_por ?? null,
    },
    { onConflict: "fecha,cuenta_id" },
  );
  return { error: error ? new Error(error.message) : null };
}

export async function resumenCajaDelDia(fecha: string): Promise<{
  data: {
    ingresos: number;
    egresos: number;
    neto: number;
    porMetodo: Record<string, number>;
  } | null;
  error: Error | null;
}> {
  const { data: movs, error } = await listMovimientos({ desde: fecha, hasta: fecha, limit: 500 });
  if (error) return { data: null, error };

  let ingresos = 0;
  let egresos = 0;
  for (const m of movs) {
    const val = Number(m.monto);
    if (m.tipo === "ingreso" || m.tipo === "transferencia_entrada") ingresos += val;
    else if (m.tipo === "egreso" || m.tipo === "transferencia_salida") egresos += val;
  }

  const { data: pagos, error: pErr } = await supabase
    .from("ventas_pagos")
    .select("monto, metodo")
    .eq("fecha", fecha);
  if (pErr) return { data: null, error: new Error(pErr.message) };

  const porMetodo: Record<string, number> = {};
  for (const p of pagos ?? []) {
    const val = typeof p.monto === "string" ? parseFloat(p.monto) : Number(p.monto ?? 0);
    const key = p.metodo || "otro";
    porMetodo[key] = (porMetodo[key] ?? 0) + val;
  }

  return {
    data: { ingresos, egresos, neto: ingresos - egresos, porMetodo },
    error: null,
  };
}

/** Sugiere cuenta destino según método de cobro. */
export function sugerirCuentaPorMetodo(
  metodo: string,
  moneda: "ars" | "usd",
  cuentas: CuentaFinancieraRow[],
): string | null {
  const m = metodo.toLowerCase();
  if (m.includes("tarjeta") || m.includes("pos")) {
    const t = cuentas.find((c) => c.tipo === "tarjeta" && c.moneda === moneda);
    if (t) return t.id;
  }
  if (m.includes("transfer") || m.includes("banco")) {
    const b = cuentas.find((c) => c.tipo === "banco" && c.moneda === moneda);
    if (b) return b.id;
  }
  const caja = cuentas.find((c) => c.tipo === "caja" && c.moneda === moneda);
  return caja?.id ?? cuentas.find((c) => c.moneda === moneda)?.id ?? null;
}
