import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type CuentaFinancieraRow = Database["public"]["Tables"]["cuentas_financieras"]["Row"];
export type MovimientoCajaRow = Database["public"]["Tables"]["movimientos_caja"]["Row"];
export type CierreCajaRow = Database["public"]["Tables"]["cierres_caja"]["Row"];
export type SaldoCuentaRow = Database["public"]["Views"]["v_saldos_cuentas"]["Row"];

export type TipoMovimiento = MovimientoCajaRow["tipo"];
export type ConceptoMovimiento = MovimientoCajaRow["concepto"];
export type MetodoPago = MovimientoCajaRow["metodo"];

/** Métodos oficiales del libro interno. */
export const METODOS_PAGO: { value: MetodoPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "cheque", label: "Cheque" },
  { value: "tarjeta", label: "Tarjeta" },
];

/** Métodos en UI de cobro (Mercado Pago imputa a Transferencia). */
export const METODOS_COBRO_UI: { value: string; label: string; metodoLibro: MetodoPago }[] = [
  { value: "efectivo", label: "Efectivo", metodoLibro: "efectivo" },
  { value: "transferencia", label: "Transferencia", metodoLibro: "transferencia" },
  { value: "cheque", label: "Cheque", metodoLibro: "cheque" },
  { value: "tarjeta", label: "Tarjeta", metodoLibro: "tarjeta" },
  { value: "mercadopago", label: "Mercado Pago", metodoLibro: "transferencia" },
];

export const CONCEPTOS_MOVIMIENTO: {
  value: ConceptoMovimiento;
  label: string;
  para: "ingreso" | "egreso" | "ambos";
}[] = [
  { value: "trabajo", label: "Trabajo / cobro", para: "ingreso" },
  { value: "insumos", label: "Insumos", para: "egreso" },
  { value: "gastos", label: "Gastos", para: "egreso" },
  { value: "sueldos", label: "Sueldos / adelantos", para: "egreso" },
  { value: "otro", label: "Otro", para: "ambos" },
];

export function etiquetaConcepto(c: ConceptoMovimiento | null | undefined): string {
  switch (c) {
    case "trabajo":
      return "Trabajo";
    case "insumos":
      return "Insumos";
    case "gastos":
      return "Gastos";
    case "sueldos":
      return "Sueldos";
    case "transferencia":
      return "Transferencia";
    default:
      return "Otro";
  }
}

export function etiquetaMetodo(m: string | null | undefined): string {
  switch ((m ?? "").toLowerCase()) {
    case "efectivo":
      return "Efectivo";
    case "transferencia":
      return "Transferencia";
    case "cheque":
      return "Cheque";
    case "tarjeta":
      return "Tarjeta";
    case "mercadopago":
      return "Mercado Pago";
    default:
      return m?.trim() || "—";
  }
}

/** Normaliza método de UI/cobro al método del libro (4 valores). */
export function normalizarMetodoLibro(metodo: string): MetodoPago {
  const m = metodo.toLowerCase().trim();
  if (m === "efectivo") return "efectivo";
  if (m === "cheque") return "cheque";
  if (m === "tarjeta" || m.includes("pos")) return "tarjeta";
  if (m === "mercadopago" || m.includes("transfer") || m.includes("banco")) return "transferencia";
  return "transferencia";
}

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
  tipo: "ingreso" | "egreso";
  monto: number;
  moneda: "ars" | "usd";
  fecha: string;
  metodo: MetodoPago;
  concepto?: Exclude<ConceptoMovimiento, "transferencia">;
  descripcion?: string;
  supplier_id?: string | null;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  if (!Number.isFinite(opts.monto) || opts.monto <= 0) {
    return { error: new Error("Monto inválido.") };
  }
  const metodo = normalizarMetodoLibro(opts.metodo);
  const cuentas = await listCuentasActivas();
  if (cuentas.error) return { error: cuentas.error };
  const cuentaId = sugerirCuentaPorMetodo(metodo, opts.moneda, cuentas.data);
  if (!cuentaId) {
    return { error: new Error(`No hay destino para ${metodo} ${opts.moneda.toUpperCase()}.`) };
  }
  const concepto = opts.concepto ?? (opts.tipo === "ingreso" ? "trabajo" : "gastos");
  const { error } = await supabase.from("movimientos_caja").insert({
    cuenta_id: cuentaId,
    tipo: opts.tipo,
    monto: opts.monto,
    moneda: opts.moneda,
    fecha: opts.fecha,
    metodo,
    concepto,
    descripcion: opts.descripcion?.trim() || null,
    referencia_tipo: "manual",
    supplier_id: opts.supplier_id ?? null,
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
    metodo: "transferencia",
    concepto: "transferencia",
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
    metodo: "transferencia",
    concepto: "transferencia",
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
  metodo: string;
  descripcion: string;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  const metodo = normalizarMetodoLibro(opts.metodo);
  const { error } = await supabase.from("movimientos_caja").insert({
    cuenta_id: opts.cuentaId,
    tipo: "ingreso",
    monto: opts.monto,
    moneda: opts.moneda,
    fecha: opts.fecha,
    metodo,
    concepto: "trabajo",
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

/** Resuelve destino interno según método de pago + moneda (1:1). */
export function sugerirCuentaPorMetodo(
  metodo: string,
  moneda: "ars" | "usd",
  cuentas: CuentaFinancieraRow[],
): string | null {
  const libro = normalizarMetodoLibro(metodo);
  const tipoDestino: CuentaFinancieraRow["tipo"] =
    libro === "efectivo"
      ? "caja"
      : libro === "cheque"
        ? "cheque"
        : libro === "tarjeta"
          ? "tarjeta"
          : "banco";

  const exacta = cuentas.find((c) => c.tipo === tipoDestino && c.moneda === moneda && c.activa);
  if (exacta) return exacta.id;

  // Tarjeta USD: fallback a transferencia USD si no hay cajón tarjeta USD
  if (libro === "tarjeta" && moneda === "usd") {
    const transf = cuentas.find((c) => c.tipo === "banco" && c.moneda === "usd" && c.activa);
    if (transf) return transf.id;
  }

  return cuentas.find((c) => c.moneda === moneda && c.activa)?.id ?? null;
}
