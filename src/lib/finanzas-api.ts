import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import {
  getFinanzasComprobanteSignedUrl,
  removeFinanzasComprobante,
  uploadFinanzasComprobante,
} from "@/lib/finanzas-documentos-storage";
import { roundMoney } from "@/lib/retencion-reglas";

export type CuentaFinancieraRow = Database["public"]["Tables"]["cuentas_financieras"]["Row"];
export type MovimientoCajaRow = Database["public"]["Tables"]["movimientos_caja"]["Row"];
export type CierreCajaRow = Database["public"]["Tables"]["cierres_caja"]["Row"];
export type SaldoCuentaRow = Database["public"]["Views"]["v_saldos_cuentas"]["Row"];

export type TipoMovimiento = MovimientoCajaRow["tipo"];
export type ConceptoMovimiento = MovimientoCajaRow["concepto"];
export type MetodoPago = MovimientoCajaRow["metodo"];
export type AcreditacionMovimiento = MovimientoCajaRow["acreditacion"];

function sumaEnSaldoDisponible(m: Pick<MovimientoCajaRow, "tipo" | "acreditacion">): number {
  if (m.acreditacion === "pendiente" || m.acreditacion === "acreditado") return 0;
  if (m.tipo === "ingreso" || m.tipo === "transferencia_entrada") return 1;
  if (m.tipo === "egreso" || m.tipo === "transferencia_salida") return -1;
  return 0;
}

/** Monto acreditado > 0 y no mayor al cobrado con tarjeta. */
export function validarMontoAcreditado(
  montoCobrado: number,
  montoAcreditado: number,
): { ok: true } | { ok: false; error: string } {
  const cobrado = roundMoney(Number(montoCobrado));
  const acreditado = roundMoney(Number(montoAcreditado));
  if (!Number.isFinite(cobrado) || cobrado <= 0) {
    return { ok: false, error: "El cobro original no es válido." };
  }
  if (!Number.isFinite(acreditado) || acreditado <= 0) {
    return { ok: false, error: "Indicá cuánto ingresó de verdad." };
  }
  if (acreditado > cobrado) {
    return { ok: false, error: "Lo acreditado no puede superar lo cobrado." };
  }
  return { ok: true };
}

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
  { value: "alquiler", label: "Alquiler", para: "egreso" },
  { value: "luz", label: "Luz", para: "egreso" },
  { value: "gas", label: "Gas", para: "egreso" },
  { value: "impuestos", label: "Impuestos", para: "egreso" },
  { value: "prestadores", label: "No empleados", para: "egreso" },
  { value: "gastos", label: "Otros gastos", para: "egreso" },
  { value: "sueldos", label: "Sueldos / adelantos", para: "egreso" },
  { value: "otro", label: "Otro", para: "ambos" },
];

export function etiquetaConcepto(c: ConceptoMovimiento | null | undefined): string {
  switch (c) {
    case "trabajo":
      return "Trabajo";
    case "insumos":
      return "Insumos";
    case "alquiler":
      return "Alquiler";
    case "luz":
      return "Luz";
    case "gas":
      return "Gas";
    case "impuestos":
      return "Impuestos";
    case "prestadores":
      return "No empleados";
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
  comprobante?: File | null;
}): Promise<{ id: string | null; error: Error | null }> {
  if (!Number.isFinite(opts.monto) || opts.monto <= 0) {
    return { id: null, error: new Error("Monto inválido.") };
  }
  const metodo = normalizarMetodoLibro(opts.metodo);
  const cuentas = await listCuentasActivas();
  if (cuentas.error) return { id: null, error: cuentas.error };
  const cuentaId = sugerirCuentaPorMetodo(metodo, opts.moneda, cuentas.data);
  if (!cuentaId) {
    return { id: null, error: new Error(`No hay destino para ${metodo} ${opts.moneda.toUpperCase()}.`) };
  }
  const concepto = opts.concepto ?? (opts.tipo === "ingreso" ? "trabajo" : "gastos");
  const { data, error } = await supabase
    .from("movimientos_caja")
    .insert({
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
    })
    .select("id")
    .single();
  if (error) return { id: null, error: new Error(error.message) };
  const id = data?.id ?? null;
  if (id && opts.comprobante) {
    const up = await adjuntarComprobanteMovimiento(id, opts.comprobante);
    if (up.error) return { id, error: up.error };
  }
  return { id, error: null };
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

/** Crea movimiento de ingreso vinculado a una exportación cobrada. */
export async function registrarMovimientoPorExportacion(opts: {
  cuentaId: string;
  exportacionId: string;
  monto: number;
  moneda: "ars" | "usd";
  fecha: string;
  descripcion: string;
  created_by?: string | null;
}): Promise<{ id: string | null; error: Error | null }> {
  if (!Number.isFinite(opts.monto) || opts.monto <= 0) {
    return { id: null, error: new Error("Monto inválido.") };
  }
  const { data, error } = await supabase
    .from("movimientos_caja")
    .insert({
      cuenta_id: opts.cuentaId,
      tipo: "ingreso",
      monto: opts.monto,
      moneda: opts.moneda,
      fecha: opts.fecha,
      metodo: "transferencia",
      concepto: "otro",
      descripcion: opts.descripcion,
      referencia_tipo: "exportacion",
      referencia_id: opts.exportacionId,
      created_by: opts.created_by ?? null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const existing = await supabase
        .from("movimientos_caja")
        .select("id")
        .eq("referencia_tipo", "exportacion")
        .eq("referencia_id", opts.exportacionId)
        .maybeSingle();
      if (existing.data?.id) return { id: existing.data.id, error: null };
    }
    return { id: null, error: new Error(error.message) };
  }
  return { id: data?.id ?? null, error: null };
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
  acreditacion?: AcreditacionMovimiento;
  concepto?: Exclude<ConceptoMovimiento, "transferencia">;
}): Promise<{ id: string | null; error: Error | null }> {
  if (!Number.isFinite(opts.monto) || opts.monto <= 0) {
    return { id: null, error: new Error("Monto inválido.") };
  }
  const metodo = normalizarMetodoLibro(opts.metodo);
  const acreditacion: AcreditacionMovimiento =
    opts.acreditacion ?? (metodo === "tarjeta" ? "pendiente" : "no_aplica");
  const { data, error } = await supabase
    .from("movimientos_caja")
    .insert({
      cuenta_id: opts.cuentaId,
      tipo: "ingreso",
      monto: opts.monto,
      moneda: opts.moneda,
      fecha: opts.fecha,
      metodo,
      concepto: opts.concepto ?? "trabajo",
      descripcion: opts.descripcion,
      referencia_tipo: "venta_pago",
      referencia_id: opts.pagoId,
      acreditacion,
      created_by: opts.created_by ?? null,
    })
    .select("id")
    .single();
  if (error) return { id: null, error: new Error(error.message) };
  return { id: data?.id ?? null, error: null };
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
    .select("tipo, monto, acreditacion")
    .eq("cuenta_id", cuentaId)
    .lte("fecha", fecha);
  if (movRes.error) return { saldo: 0, error: new Error(movRes.error.message) };

  let neto = Number(cuentaRes.data.saldo_inicial ?? 0);
  for (const m of movRes.data ?? []) {
    const signo = sumaEnSaldoDisponible({
      tipo: m.tipo,
      acreditacion: m.acreditacion ?? "no_aplica",
    });
    if (signo !== 0) neto += signo * Number(m.monto);
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
    const signo = sumaEnSaldoDisponible(m);
    const val = Number(m.monto);
    if (signo > 0) ingresos += val;
    else if (signo < 0) egresos += val;
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

export async function listTarjetaPendiente(): Promise<{
  data: MovimientoCajaRow[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("movimientos_caja")
    .select("*")
    .eq("acreditacion", "pendiente")
    .order("fecha", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as MovimientoCajaRow[], error: null };
}

export async function adjuntarComprobanteMovimiento(
  movimientoId: string,
  file: File,
): Promise<{ path: string | null; error: Error | null }> {
  const actual = await supabase
    .from("movimientos_caja")
    .select("id, comprobante_path")
    .eq("id", movimientoId)
    .maybeSingle();
  if (actual.error) return { path: null, error: new Error(actual.error.message) };
  if (!actual.data) return { path: null, error: new Error("Movimiento no encontrado.") };

  const up = await uploadFinanzasComprobante({ movimientoId, file });
  if (up.error || !up.path) return { path: null, error: up.error };

  const { error } = await supabase
    .from("movimientos_caja")
    .update({ comprobante_path: up.path })
    .eq("id", movimientoId);
  if (error) {
    await removeFinanzasComprobante(up.path);
    return { path: null, error: new Error(error.message) };
  }
  if (actual.data.comprobante_path && actual.data.comprobante_path !== up.path) {
    await removeFinanzasComprobante(actual.data.comprobante_path);
  }
  return { path: up.path, error: null };
}

export async function abrirComprobanteMovimiento(
  storagePath: string,
): Promise<{ error: Error | null }> {
  const res = await getFinanzasComprobanteSignedUrl(storagePath);
  if (res.error || !res.url) return { error: res.error ?? new Error("No se pudo abrir el comprobante.") };
  window.open(res.url, "_blank", "noopener,noreferrer");
  return { error: null };
}

export async function acreditarMovimientoTarjeta(opts: {
  movimientoId: string;
  montoAcreditado: number;
  fecha: string;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  const fecha = opts.fecha.trim();
  if (!fecha) return { error: new Error("Indicá la fecha de acreditación.") };

  const movRes = await supabase
    .from("movimientos_caja")
    .select("*")
    .eq("id", opts.movimientoId)
    .maybeSingle();
  if (movRes.error) return { error: new Error(movRes.error.message) };
  const mov = movRes.data as MovimientoCajaRow | null;
  if (!mov) return { error: new Error("Movimiento no encontrado.") };
  if (mov.acreditacion !== "pendiente") {
    return { error: new Error("Ese cobro ya no está pendiente de acreditar.") };
  }

  const check = validarMontoAcreditado(Number(mov.monto), opts.montoAcreditado);
  if (!check.ok) return { error: new Error(check.error) };
  const neto = roundMoney(opts.montoAcreditado);

  const cuentas = await listCuentasActivas();
  if (cuentas.error) return { error: cuentas.error };
  const cuentaDestinoId = sugerirCuentaPorMetodo("transferencia", mov.moneda, cuentas.data);
  if (!cuentaDestinoId) {
    return { error: new Error(`No hay cajón de transferencia ${mov.moneda.toUpperCase()}.`) };
  }

  const desc =
    mov.descripcion?.trim()
      ? `Acreditación tarjeta · ${mov.descripcion}`
      : "Acreditación tarjeta";

  const entrada = await supabase
    .from("movimientos_caja")
    .insert({
      cuenta_id: cuentaDestinoId,
      tipo: "ingreso",
      monto: neto,
      moneda: mov.moneda,
      fecha,
      metodo: "transferencia",
      concepto: "trabajo",
      descripcion: desc,
      referencia_tipo: mov.referencia_tipo,
      referencia_id: mov.referencia_id,
      movimiento_origen_id: mov.id,
      created_by: opts.created_by ?? null,
    })
    .select("id")
    .single();
  if (entrada.error) {
    if (entrada.error.code === "23505") {
      return { error: new Error("Ese cobro ya tiene una acreditación.") };
    }
    return { error: new Error(entrada.error.message) };
  }

  const upd = await supabase
    .from("movimientos_caja")
    .update({
      acreditacion: "acreditado",
      monto_acreditado: neto,
      fecha_acreditacion: fecha,
    })
    .eq("id", mov.id)
    .eq("acreditacion", "pendiente");
  if (upd.error) {
    if (entrada.data?.id) {
      await supabase.from("movimientos_caja").delete().eq("id", entrada.data.id);
    }
    return { error: new Error(upd.error.message) };
  }
  return { error: null };
}

export type ResumenProveedorFinanzas = {
  supplier_id: string;
  nombre: string;
  pagado_ars: number;
  pagado_usd: number;
  movimientos: number;
  ultimo_pago: string | null;
};

export async function resumenPorProveedor(): Promise<{
  data: ResumenProveedorFinanzas[];
  error: Error | null;
}> {
  const { data: movs, error } = await supabase
    .from("movimientos_caja")
    .select("supplier_id, tipo, monto, moneda, fecha")
    .not("supplier_id", "is", null);
  if (error) return { data: [], error: new Error(error.message) };

  const { data: suppliers, error: sErr } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("activo", true)
    .order("name");
  if (sErr) return { data: [], error: new Error(sErr.message) };

  const byId = new Map<string, ResumenProveedorFinanzas>();
  for (const s of suppliers ?? []) {
    byId.set(s.id, {
      supplier_id: s.id,
      nombre: s.name,
      pagado_ars: 0,
      pagado_usd: 0,
      movimientos: 0,
      ultimo_pago: null,
    });
  }

  for (const m of movs ?? []) {
    if (!m.supplier_id) continue;
    let row = byId.get(m.supplier_id);
    if (!row) {
      row = {
        supplier_id: m.supplier_id,
        nombre: "Proveedor",
        pagado_ars: 0,
        pagado_usd: 0,
        movimientos: 0,
        ultimo_pago: null,
      };
      byId.set(m.supplier_id, row);
    }
    row.movimientos += 1;
    if (m.tipo === "egreso") {
      const monto = Number(m.monto) || 0;
      if (m.moneda === "usd") row.pagado_usd += monto;
      else row.pagado_ars += monto;
      if (!row.ultimo_pago || m.fecha > row.ultimo_pago) row.ultimo_pago = m.fecha;
    }
  }

  const data = [...byId.values()].sort((a, b) => {
    const totA = a.pagado_ars + a.pagado_usd;
    const totB = b.pagado_ars + b.pagado_usd;
    if (totB !== totA) return totB - totA;
    return a.nombre.localeCompare(b.nombre, "es");
  });
  return { data, error: null };
}

export async function listMovimientosPorProveedor(
  supplierId: string,
): Promise<{ data: MovimientoCajaRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("movimientos_caja")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as MovimientoCajaRow[], error: null };
}

export type ResumenPorCobrar = {
  usd: number;
  ars: number;
  ventasConSaldo: number;
};

export async function resumenPorCobrar(): Promise<{
  data: ResumenPorCobrar;
  error: Error | null;
}> {
  const empty: ResumenPorCobrar = { usd: 0, ars: 0, ventasConSaldo: 0 };
  const [presRes, ventasRes, pagosRes] = await Promise.all([
    supabase.from("presupuestos").select("id, total, moneda, status").eq("status", "aprobado"),
    supabase.from("ventas").select("id, presupuesto_id"),
    supabase.from("ventas_pagos").select("venta_id, monto, moneda"),
  ]);
  if (presRes.error) return { data: empty, error: new Error(presRes.error.message) };
  if (ventasRes.error) return { data: empty, error: new Error(ventasRes.error.message) };
  if (pagosRes.error) return { data: empty, error: new Error(pagosRes.error.message) };

  const ventaByPres = new Map<string, string>();
  for (const v of ventasRes.data ?? []) ventaByPres.set(v.presupuesto_id, v.id);

  const pagosPorVentaMoneda = new Map<string, number>();
  for (const p of pagosRes.data ?? []) {
    const monto = typeof p.monto === "string" ? parseFloat(p.monto) : Number(p.monto ?? 0);
    if (!Number.isFinite(monto) || monto <= 0) continue;
    const key = `${p.venta_id}:${p.moneda}`;
    pagosPorVentaMoneda.set(key, (pagosPorVentaMoneda.get(key) ?? 0) + monto);
  }

  let usd = 0;
  let ars = 0;
  let ventasConSaldo = 0;
  for (const p of presRes.data ?? []) {
    const total = Number(p.total) || 0;
    const ventaId = ventaByPres.get(p.id);
    const pagado = ventaId ? (pagosPorVentaMoneda.get(`${ventaId}:${p.moneda}`) ?? 0) : 0;
    const saldo = Math.max(0, total - pagado);
    if (saldo <= 0.009) continue;
    if (p.moneda === "usd") usd += saldo;
    else ars += saldo;
    ventasConSaldo += 1;
  }
  return { data: { usd, ars, ventasConSaldo }, error: null };
}

export type ResumenPorPagar = {
  ars: number;
  usd: number;
  cantidad: number;
};

export async function resumenPorPagarMes(fecha = new Date().toISOString().slice(0, 10)): Promise<{
  data: ResumenPorPagar;
  error: Error | null;
}> {
  const empty: ResumenPorPagar = { ars: 0, usd: 0, cantidad: 0 };
  const [y, m] = fecha.split("-");
  const desde = `${y}-${m}-01`;
  const last = new Date(Number(y), Number(m), 0).getDate();
  const hasta = `${y}-${m}-${String(last).padStart(2, "0")}`;

  const [gastosRes, movsRes] = await Promise.all([
    supabase.from("gastos_fijos").select("id, monto, moneda, activo").eq("activo", true),
    supabase
      .from("movimientos_caja")
      .select("referencia_id")
      .eq("referencia_tipo", "gasto_fijo")
      .gte("fecha", desde)
      .lte("fecha", hasta),
  ]);
  if (gastosRes.error) return { data: empty, error: new Error(gastosRes.error.message) };
  if (movsRes.error) return { data: empty, error: new Error(movsRes.error.message) };

  const yaCargados = new Set((movsRes.data ?? []).map((r) => r.referencia_id).filter(Boolean));
  let ars = 0;
  let usd = 0;
  let cantidad = 0;
  for (const g of gastosRes.data ?? []) {
    if (yaCargados.has(g.id)) continue;
    const monto = Number(g.monto) || 0;
    if (g.moneda === "usd") usd += monto;
    else ars += monto;
    cantidad += 1;
  }
  return { data: { ars, usd, cantidad }, error: null };
}

export type SaldoMesPorMetodo = {
  metodo: string;
  moneda: "ars" | "usd";
  ingresos: number;
  egresos: number;
  neto: number;
};

export async function resumenMesPorMetodo(fecha = new Date().toISOString().slice(0, 10)): Promise<{
  data: SaldoMesPorMetodo[];
  error: Error | null;
}> {
  const [y, m] = fecha.split("-");
  const desde = `${y}-${m}-01`;
  const last = new Date(Number(y), Number(m), 0).getDate();
  const hasta = `${y}-${m}-${String(last).padStart(2, "0")}`;
  const { data: movs, error } = await listMovimientos({ desde, hasta, limit: 2000 });
  if (error) return { data: [], error };

  const map = new Map<string, SaldoMesPorMetodo>();
  for (const mov of movs) {
    const key = `${mov.metodo}:${mov.moneda}`;
    let row = map.get(key);
    if (!row) {
      row = { metodo: mov.metodo, moneda: mov.moneda, ingresos: 0, egresos: 0, neto: 0 };
      map.set(key, row);
    }
    const signo = sumaEnSaldoDisponible(mov);
    const val = Number(mov.monto) || 0;
    if (signo > 0) row.ingresos += val;
    else if (signo < 0) row.egresos += val;
    row.neto = row.ingresos - row.egresos;
  }
  return { data: [...map.values()].sort((a, b) => a.metodo.localeCompare(b.metodo, "es")), error: null };
}

export type OrigenMovimiento = {
  contraparte: string;
  presupuestoId: string | null;
  presupuestoNumero: string | null;
  ventaId: string | null;
  otTitulo: string | null;
  cliente: string | null;
  totalObra: number | null;
  cobradoObra: number | null;
  saldoObra: number | null;
  monedaObra: "ars" | "usd" | null;
  registradoPor: string | null;
};

export async function getOrigenMovimiento(mov: MovimientoCajaRow): Promise<{
  data: OrigenMovimiento;
  error: Error | null;
}> {
  const empty: OrigenMovimiento = {
    contraparte: mov.descripcion?.trim() || etiquetaConcepto(mov.concepto),
    presupuestoId: null,
    presupuestoNumero: null,
    ventaId: null,
    otTitulo: null,
    cliente: null,
    totalObra: null,
    cobradoObra: null,
    saldoObra: null,
    monedaObra: null,
    registradoPor: null,
  };

  let registradoPor: string | null = null;
  if (mov.created_by) {
    const u = await supabase.from("usuarios").select("full_name").eq("id", mov.created_by).maybeSingle();
    if (!u.error) registradoPor = u.data?.full_name?.trim() || null;
  }

  if (mov.supplier_id) {
    const s = await supabase.from("suppliers").select("name").eq("id", mov.supplier_id).maybeSingle();
    return {
      data: {
        ...empty,
        contraparte: s.data?.name?.trim() || empty.contraparte,
        registradoPor,
      },
      error: s.error ? new Error(s.error.message) : null,
    };
  }

  if (mov.referencia_tipo !== "venta_pago" || !mov.referencia_id) {
    return { data: { ...empty, registradoPor }, error: null };
  }

  const pagoRes = await supabase
    .from("ventas_pagos")
    .select("venta_id")
    .eq("id", mov.referencia_id)
    .maybeSingle();
  if (pagoRes.error) return { data: { ...empty, registradoPor }, error: new Error(pagoRes.error.message) };
  const ventaId = pagoRes.data?.venta_id ?? null;
  if (!ventaId) return { data: { ...empty, registradoPor }, error: null };

  const ventaRes = await supabase
    .from("ventas")
    .select("presupuesto_id")
    .eq("id", ventaId)
    .maybeSingle();
  if (ventaRes.error) return { data: { ...empty, registradoPor }, error: new Error(ventaRes.error.message) };
  const presupuestoId = ventaRes.data?.presupuesto_id ?? null;
  if (!presupuestoId) return { data: { ...empty, registradoPor, ventaId }, error: null };

  const presRes = await supabase
    .from("presupuestos")
    .select("id, numero, cliente, total, moneda")
    .eq("id", presupuestoId)
    .maybeSingle();
  if (presRes.error) {
    return { data: { ...empty, registradoPor, ventaId, presupuestoId }, error: new Error(presRes.error.message) };
  }

  const pagosRes = await supabase
    .from("ventas_pagos")
    .select("monto, moneda")
    .eq("venta_id", ventaId);
  if (pagosRes.error) {
    return { data: { ...empty, registradoPor, ventaId, presupuestoId }, error: new Error(pagosRes.error.message) };
  }

  const moneda = (presRes.data?.moneda ?? "ars") as "ars" | "usd";
  const total = Number(presRes.data?.total ?? 0);
  let cobrado = 0;
  for (const p of pagosRes.data ?? []) {
    if (p.moneda !== moneda) continue;
    const n = typeof p.monto === "string" ? parseFloat(p.monto) : Number(p.monto ?? 0);
    if (Number.isFinite(n) && n > 0) cobrado += n;
  }

  const otRes = await supabase
    .from("ordenes_trabajo")
    .select("titulo")
    .eq("venta_id", ventaId)
    .neq("estado", "cancelled")
    .order("creado_en", { ascending: true })
    .limit(1)
    .maybeSingle();

  const cliente = presRes.data?.cliente?.trim() || null;
  return {
    data: {
      contraparte: cliente || empty.contraparte,
      presupuestoId,
      presupuestoNumero: presRes.data?.numero ?? null,
      ventaId,
      otTitulo: otRes.data?.titulo?.trim() || null,
      cliente,
      totalObra: total,
      cobradoObra: cobrado,
      saldoObra: total - cobrado,
      monedaObra: moneda,
      registradoPor,
    },
    error: null,
  };
}

export async function hayCierreEnFecha(fecha: string): Promise<{ cerrado: boolean; error: Error | null }> {
  const { data, error } = await supabase
    .from("cierres_caja")
    .select("id")
    .eq("fecha", fecha)
    .limit(1);
  if (error) return { cerrado: false, error: new Error(error.message) };
  return { cerrado: (data ?? []).length > 0, error: null };
}

export async function crearCuentaFinanciera(opts: {
  nombre: string;
  tipo: CuentaFinancieraRow["tipo"];
  moneda: "ars" | "usd";
  saldo_inicial?: number;
}): Promise<{ id: string | null; error: Error | null }> {
  const nombre = opts.nombre.trim();
  if (!nombre) return { id: null, error: new Error("Indicá el nombre de la cuenta.") };
  const { data, error } = await supabase
    .from("cuentas_financieras")
    .insert({
      nombre,
      tipo: opts.tipo,
      moneda: opts.moneda,
      saldo_inicial: opts.saldo_inicial ?? 0,
      activa: true,
    })
    .select("id")
    .single();
  if (error) return { id: null, error: new Error(error.message) };
  return { id: data?.id ?? null, error: null };
}
