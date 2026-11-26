import { supabase } from "@/lib/supabase";
import {
  adjuntarComprobanteMovimiento,
  listCuentasActivas,
  normalizarMetodoLibro,
  registrarMovimientoPorCobro,
  sugerirCuentaPorMetodo,
  type ConceptoMovimiento,
} from "@/lib/finanzas-api";
import { calcularRetencion } from "@/lib/retencion-reglas";
import { registrarEventoPrecio } from "@/lib/presupuesto-eventos-api";
import { aplicarPlanEnSenia } from "@/lib/plan-corte-stock";
import { validarPlanParaSenia } from "@/lib/plan-corte";
import { getOrCreateMedicion, solicitarMedicion } from "@/lib/medicion-api";
import type {
  BachaOrigen,
  Database,
  EtapaOtKanban,
  JobStatus,
  Json,
  VentaEstado,
} from "@/types/database";
import type { PresupuestoPayloadV1 } from "@/types/presupuesto-payload";
import { hydratePresupuestoPayloadV1, isPresupuestoPayloadV1 } from "@/types/presupuesto-payload";
import { tipoEntregaDesdePayload } from "@/lib/planificacion-reglas";
import {
  camposRequisitoBacha,
  esBloqueoPorBacha,
  ordenBachaParaOt,
} from "@/lib/bacha-reglas";

export type ChapaReservaPendiente = {
  otId: string;
  ordenKey: string;
  chapaIdFallida: string;
  bulto: string;
  materialLabel: string;
};

export type ResultadoSenia = {
  error: Error | null;
  /** Chapas señaladas que ya no estaban Disponibles; hay que elegir reemplazo. */
  chapasPendientes?: ChapaReservaPendiente[];
  otId?: string | null;
};

type OrdenTrabajoRow = Database["public"]["Tables"]["ordenes_trabajo"]["Row"];
type VentaRow = Database["public"]["Tables"]["ventas"]["Row"];
type PresupuestoRow = Database["public"]["Tables"]["presupuestos"]["Row"];

export async function ensureVentaForPresupuestoAprobado(
  presupuestoId: string,
): Promise<{ error: Error | null }> {
  // La venta ya no nace al aprobar el presupuesto: se crea recién con la primera seña.
  const dup = await supabase.from("ventas").select("id").eq("presupuesto_id", presupuestoId).maybeSingle();
  if (dup.error) return { error: new Error(dup.error.message) };
  return { error: null };
}

export async function getVentaPorPresupuesto(
  presupuestoId: string,
): Promise<{ data: VentaRow | null; error: Error | null }> {
  const r = await supabase.from("ventas").select("*").eq("presupuesto_id", presupuestoId).maybeSingle();
  return {
    data: (r.data as VentaRow | undefined) ?? null,
    error: r.error ? new Error(r.error.message) : null,
  };
}

/**
 * Aprueba el presupuesto (actualiza total), crea venta base y, si hay seña &gt; 0, registra el primer pago
 * (misma lógica que primer cobro en Ventas).
 */
export async function aprobarPresupuestoConVentaInicial(opts: {
  presupuestoId: string;
  totalAprobado: number;
  montoSenia: number;
  fecha: string;
  metodo: string;
  nota?: string;
  created_by?: string | null;
  retencionPorcentaje?: number | null;
  retencionMonto?: number | null;
  comprobante?: File | null;
}): Promise<ResultadoSenia> {
  const presRes = await supabase.from("presupuestos").select("*").eq("id", opts.presupuestoId).maybeSingle();
  if (presRes.error) return { error: new Error(presRes.error.message) };
  const pres = presRes.data as PresupuestoRow | null;
  if (!pres) return { error: new Error("Presupuesto no encontrado.") };
  if (pres.status !== "pendiente") {
    return { error: new Error("Solo se pueden aprobar presupuestos en estado pendiente.") };
  }

  if (!Number.isFinite(opts.totalAprobado) || opts.totalAprobado < 0) {
    return { error: new Error("Total inválido.") };
  }
  if (!Number.isFinite(opts.montoSenia) || opts.montoSenia < 0) {
    return { error: new Error("Monto de seña inválido.") };
  }
  if (opts.montoSenia > opts.totalAprobado) {
    return { error: new Error("La seña no puede superar el total aprobado.") };
  }

  // Se validan antes de aprobar las causas de rechazo conocidas de la seña. Si no, el presupuesto
  // quedaba aprobado sin venta ni OT, y como un presupuesto aprobado ya no se puede editar,
  // tampoco se podía confirmar la plancha para señar.
  if (opts.montoSenia > 0) {
    if (!opts.metodo?.trim()) {
      return { error: new Error("Indicá cómo se paga: efectivo, transferencia, cheque o tarjeta.") };
    }
    const payloadSenia = parsePayload(pres.payload as Json);
    const planErr = payloadSenia ? validarPlanParaSenia(payloadSenia.ordenes) : null;
    if (planErr) {
      return { error: new Error(`${planErr} Editá el presupuesto, confirmá la plancha y volvé a aprobarlo.`) };
    }
  }

  const totalAnterior = Number(pres.total) || 0;
  const nowIso = new Date().toISOString();
  const { error: uErr } = await supabase
    .from("presupuestos")
    .update({ status: "aprobado", total: opts.totalAprobado, updated_at: nowIso })
    .eq("id", opts.presupuestoId);
  if (uErr) return { error: new Error(uErr.message) };

  // Si al aprobar se cambió el total, queda registrado: precio anterior, nuevo y quién lo hizo.
  const registrarAjuste = async () => {
    if (Math.abs(totalAnterior - opts.totalAprobado) <= 0.009) return;
    await registrarEventoPrecio({
      presupuestoId: opts.presupuestoId,
      tipo: "ajuste",
      monto: opts.totalAprobado,
      moneda: pres.moneda,
      createdBy: opts.created_by ?? null,
      meta: { motivo: "aprobacion", total_anterior: totalAnterior },
    });
  };

  const ev = await ensureVentaForPresupuestoAprobado(opts.presupuestoId);
  if (ev.error) {
    await revertirAprobacionSinPagos(opts.presupuestoId, totalAnterior);
    return { error: ev.error };
  }

  if (opts.montoSenia <= 0) {
    await registrarAjuste();
    return { error: null };
  }

  const res = await registrarPagoSena({
    presupuestoId: opts.presupuestoId,
    monto: opts.montoSenia,
    moneda: pres.moneda,
    fecha: opts.fecha,
    metodo: opts.metodo,
    nota: opts.nota,
    created_by: opts.created_by ?? null,
    retencionPorcentaje: opts.retencionPorcentaje,
    retencionMonto: opts.retencionMonto,
    comprobante: opts.comprobante,
  });

  if (res.error) {
    // Si todavía no hay plata registrada, se deshace la aprobación para poder corregir y reintentar.
    const revertido = await revertirAprobacionSinPagos(opts.presupuestoId, totalAnterior);
    if (revertido) {
      return {
        ...res,
        error: new Error(`${res.error.message} El presupuesto sigue pendiente: corregilo y volvé a intentar.`),
      };
    }
  }
  await registrarAjuste();
  return res;
}

/**
 * Vuelve un presupuesto recién aprobado a «pendiente» si todavía no tiene pagos ni OTs.
 * Devuelve false (y no toca nada) si ya hay plata registrada.
 */
async function revertirAprobacionSinPagos(presupuestoId: string, totalAnterior: number): Promise<boolean> {
  const venta = await supabase.from("ventas").select("id").eq("presupuesto_id", presupuestoId).maybeSingle();
  if (venta.error) return false;
  if (venta.data?.id) {
    const pagos = await supabase
      .from("ventas_pagos")
      .select("id", { count: "exact", head: true })
      .eq("venta_id", venta.data.id);
    if (pagos.error || (pagos.count ?? 0) > 0) return false;
    const del = await supabase.from("ventas").delete().eq("id", venta.data.id);
    if (del.error) return false;
  }
  const up = await supabase
    .from("presupuestos")
    .update({ status: "pendiente", total: totalAnterior, updated_at: new Date().toISOString() })
    .eq("id", presupuestoId);
  return !up.error;
}

export type VentaResumenMerged = {
  venta_id: string | null;
  venta_estado: VentaEstado | null;
  total_pagado_misma_moneda: number | null;
  saldo_misma_moneda: number | null;
  pct_sena_sobre_presupuesto: number | null;
  orden_trabajo_id: string | null;
  ot_etapa: string | null;
  ot_estado: JobStatus | null;
};

type OtResumenPorVenta = {
  id: string;
  etapa: string | null;
  estado: JobStatus | null;
};

const VENTA_RESUMEN_SIN_VENTA: VentaResumenMerged = {
  venta_id: null,
  venta_estado: null,
  total_pagado_misma_moneda: null,
  saldo_misma_moneda: null,
  pct_sena_sobre_presupuesto: null,
  orden_trabajo_id: null,
  ot_etapa: null,
  ot_estado: null,
};

export async function mergeVentasResumenIntoPresupuestos<
  T extends {
    id: string;
    total: number;
    moneda: "ars" | "usd";
    status?: string;
  },
>(rows: T[]): Promise<Array<T & VentaResumenMerged>> {
  if (rows.length === 0) return [];

  const presIds = [...new Set(rows.map((r) => r.id))];
  // Las OTs no dependen de las ventas: se piden en paralelo para ahorrar un viaje.
  const [{ data: ventas, error }, otRes] = await Promise.all([
    supabase.from("ventas").select("id,presupuesto_id,estado").in("presupuesto_id", presIds),
    supabase
      .from("ordenes_trabajo")
      .select("id,venta_id,etapa,estado")
      .not("venta_id", "is", null),
  ]);
  if (error) throw new Error(error.message);

  const byPres = new Map<string, VentaRow>();
  (ventas ?? []).forEach((v) => {
    byPres.set(v.presupuesto_id, v as VentaRow);
  });

  const ventaIds = (ventas ?? []).map((v) => v.id);
  if (ventaIds.length === 0) {
    return rows.map((r) => ({
      ...r,
      ...VENTA_RESUMEN_SIN_VENTA,
    }));
  }

  const pagosRes = await supabase
    .from("ventas_pagos")
    .select("venta_id,monto,moneda")
    .in("venta_id", ventaIds);
  if (pagosRes.error) throw new Error(pagosRes.error.message);
  const pagos = pagosRes.data ?? [];

  /** Si la tabla OT aún no existe en el proyecto, el listado no debe fallar. */
  const filasOt = !otRes.error && otRes.data ? otRes.data : [];

  const otPorVenta = new Map<string, OtResumenPorVenta>();
  filasOt.forEach((j) => {
    if (j.venta_id && j.id && !otPorVenta.has(j.venta_id)) {
      otPorVenta.set(j.venta_id, {
        id: j.id,
        etapa: typeof j.etapa === "string" ? j.etapa : null,
        estado: (j.estado as JobStatus) ?? null,
      });
    }
  });

  return rows.map((r) => {
    const venta = byPres.get(r.id);
    if (!venta) {
      return {
        ...r,
        ...VENTA_RESUMEN_SIN_VENTA,
      };
    }
    let totalMis = 0;
    for (const p of pagos ?? []) {
      if (p.venta_id !== venta.id) continue;
      if (p.moneda !== r.moneda) continue;
      const m = typeof p.monto === "string" ? parseFloat(p.monto) : Number(p.monto ?? 0);
      if (Number.isFinite(m) && m > 0) totalMis += m;
    }
    const saldoNum = Number.isFinite(r.total) ? r.total - totalMis : null;
    const pct = r.total > 0 ? Math.min(100, (totalMis / r.total) * 100) : null;
    const ot = otPorVenta.get(venta.id);
    return {
      ...r,
      venta_id: venta.id,
      venta_estado: venta.estado as VentaEstado,
      total_pagado_misma_moneda: totalMis,
      saldo_misma_moneda: saldoNum !== null ? saldoNum : null,
      pct_sena_sobre_presupuesto: pct,
      orden_trabajo_id: ot?.id ?? null,
      ot_etapa: ot?.etapa ?? null,
      ot_estado: ot?.estado ?? null,
    };
  });
}

function parsePayload(p: Json): PresupuestoPayloadV1 | null {
  const asUnknown: unknown = p;
  return isPresupuestoPayloadV1(asUnknown) ? hydratePresupuestoPayloadV1(asUnknown) : null;
}

/** Postgres `uuid` solo acepta formato estándar; el wizard puede guardar slugs en `clienteId`. */
function esUuidValido(s: string): boolean {
  const t = s.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
}

async function resolveClientId(payload: Json, clienteNombre: string): Promise<string | null> {
  const parsed = parsePayload(payload);
  const raw = typeof parsed?.clienteId === "string" ? parsed.clienteId.trim() : "";
  if (raw && esUuidValido(raw)) {
    const byId = await supabase.from("clients").select("id").eq("id", raw).maybeSingle();
    if (!byId.error && byId.data?.id) return byId.data.id;
  }

  const name = (clienteNombre ?? "").trim() || "Cliente";
  const found = await supabase.from("clients").select("id").eq("name", name).maybeSingle();
  if (found.error) return null;
  if (found.data?.id) return found.data.id;
  const inserted = await supabase.from("clients").insert({ name }).select("id").maybeSingle();
  if (inserted.error || !inserted.data?.id) return null;
  return inserted.data.id;
}

function camposBachaDesdeOrden(orden: PresupuestoPayloadV1["ordenes"][number]) {
  const llevaBacha = orden.llevaBacha === true;
  return camposRequisitoBacha({
    llevaBacha,
    origen: orden.bachaOrigen === "cliente" ? "cliente" : "propia",
    tipoEtiqueta: null,
    colocacion: llevaBacha ? (orden.tipoColocacion ?? null) : null,
  });
}

type OtBachaSync = {
  id: string;
  orden_key: string | null;
  etapa: string | null;
  bloqueada: boolean | null;
  motivo_bloqueo: string | null;
  bacha_id: string | null;
  bacha_requerida: boolean | null;
  bacha_origen: BachaOrigen | null;
  bacha_tipo: string | null;
  bacha_colocacion: string | null;
  nafe: string | null;
};

function parcheBloqueoBacha(
  ot: Pick<OtBachaSync, "bloqueada" | "motivo_bloqueo">,
): { bloqueada: boolean; motivo_bloqueo: string | null } | null {
  if (Boolean(ot.bloqueada) && esBloqueoPorBacha(ot.motivo_bloqueo)) {
    return { bloqueada: false, motivo_bloqueo: null };
  }
  return null;
}

/** El presupuesto manda el requisito. No pisa la pieza asignada ni un origen ya definido en la OT. */
async function sincronizarBachaEnOtsExistentes(
  existentes: OtBachaSync[],
  payload: Json,
): Promise<Error | null> {
  const ordenes = parsePayload(payload)?.ordenes ?? [];
  if (ordenes.length === 0) return null;
  const now = new Date().toISOString();
  for (const ot of existentes) {
    const orden = ordenBachaParaOt(ot, existentes, ordenes);
    if (!orden) continue;
    const campos = camposBachaDesdeOrden(orden);
    const origenYaDefinido = ot.bacha_origen === "cliente" || ot.bacha_origen === "propia";
    const camposSync = origenYaDefinido
      ? { ...campos, bacha_origen: ot.bacha_origen }
      : campos;
    const nafe = orden.nafe.trim() || null;
    const igual =
      Boolean(ot.bacha_requerida) === camposSync.bacha_requerida &&
      (ot.bacha_origen ?? null) === camposSync.bacha_origen &&
      (ot.bacha_tipo ?? null) === camposSync.bacha_tipo &&
      (ot.bacha_colocacion ?? null) === camposSync.bacha_colocacion &&
      (ot.nafe ?? null) === nafe;
    const bloqueo = parcheBloqueoBacha(ot);
    if (igual && !bloqueo) continue;
    const patch: Database["public"]["Tables"]["ordenes_trabajo"]["Update"] = {
      ...camposSync,
      nafe,
      actualizado_en: now,
      ...(bloqueo ?? {}),
    };
    const up = await supabase.from("ordenes_trabajo").update(patch).eq("id", ot.id);
    if (up.error) return new Error(up.error.message);
  }
  return null;
}

async function crearJobOtSiAusente(opts: {
  ventaId: string;
  presupuestoNumero: string;
  clienteNombre: string;
  payload: Json;
  presupuestoId?: string | null;
}): Promise<{
  otId: string | null;
  otIds: string[];
  otByOrdenKey: Record<string, string>;
  error: Error | null;
}> {
  const empty = { otId: null as string | null, otIds: [] as string[], otByOrdenKey: {} as Record<string, string> };
  const exist = await supabase
    .from("ordenes_trabajo")
    .select(
      "id,orden_key,tipo,etapa,bloqueada,motivo_bloqueo,bacha_id,bacha_requerida,bacha_origen,bacha_tipo,bacha_colocacion,nafe",
    )
    .eq("venta_id", opts.ventaId)
    .neq("estado", "cancelled");
  if (exist.error) return { ...empty, error: new Error(exist.error.message) };

  const existentes = (exist.data ?? []).filter((r) => r.tipo !== "reposicion");
  if (existentes.length > 0) {
    const syncErr = await sincronizarBachaEnOtsExistentes(existentes, opts.payload);
    if (syncErr) return { ...empty, error: syncErr };
    const otByOrdenKey: Record<string, string> = {};
    for (const r of existentes) {
      if (r.orden_key) otByOrdenKey[r.orden_key] = r.id;
    }
    return {
      otId: existentes[0]?.id ?? null,
      otIds: existentes.map((r) => r.id),
      otByOrdenKey,
      error: null,
    };
  }

  const id_cliente = await resolveClientId(opts.payload, opts.clienteNombre);
  const parsed = parsePayload(opts.payload);
  const tipo_entrega = tipoEntregaDesdePayload(parsed);
  const ordenes = parsed?.ordenes ?? [];
  const now = new Date().toISOString();
  let medidasConfirmadas = false;
  if (opts.presupuestoId) {
    const med = await getOrCreateMedicion(opts.presupuestoId);
    medidasConfirmadas = med.data?.estado === "medido";
  }
  const fechaFallbackRaw =
    parsed?.logistica?.fechaEntrega?.trim() ||
    ordenes.map((o) => o.fechaEntrega?.trim()).find((f) => f && f.length >= 10) ||
    "";
  const fechaFallback =
    fechaFallbackRaw.length >= 10 ? `${fechaFallbackRaw.slice(0, 10)}T12:00:00.000Z` : null;

  const filas =
    ordenes.length > 0
      ? ordenes.map((orden) => {
          const tituloOt = (orden.titulo ?? "").trim();
          const fechaRaw = orden.fechaEntrega?.trim() || "";
          const fecha_programada =
            fechaRaw.length >= 10 ? `${fechaRaw.slice(0, 10)}T12:00:00.000Z` : fechaFallback;
          const piedraCliente = orden.piedraDelCliente === true;
          const piedraNota = (orden.materialLibre ?? "").trim();
          return {
            titulo: tituloOt || `OT · ${opts.presupuestoNumero}`,
            id_cotizacion: null as string | null,
            venta_id: opts.ventaId,
            id_cliente,
            estado: "pending" as const,
            fecha_programada,
            notas: piedraCliente
              ? `OT desde venta (${opts.presupuestoNumero}). Piedra del cliente${piedraNota ? `: ${piedraNota}` : ""}.`
              : `OT desde venta (${opts.presupuestoNumero}).`,
            actualizado_en: now,
            etapa: "medicion" as const,
            pausada: false,
            bloqueada: false,
            requiere_reserva_stock: !piedraCliente,
            medidas_confirmadas: medidasConfirmadas,
            fecha_medidas_confirmadas: medidasConfirmadas ? now : null,
            orden_key: orden.key,
            tipo: "normal" as const,
            tipo_entrega,
            ...camposBachaDesdeOrden(orden),
            bacha_id: null as string | null,
            nafe: orden.nafe.trim() || null,
          };
        })
      : [
          {
            titulo: `OT · ${opts.presupuestoNumero}`,
            id_cotizacion: null as string | null,
            venta_id: opts.ventaId,
            id_cliente,
            estado: "pending" as const,
            fecha_programada: fechaFallback,
            notas: `OT desde venta (${opts.presupuestoNumero}).`,
            actualizado_en: now,
            etapa: "medicion" as const,
            pausada: false,
            bloqueada: false,
            requiere_reserva_stock: true,
            medidas_confirmadas: medidasConfirmadas,
            fecha_medidas_confirmadas: medidasConfirmadas ? now : null,
            orden_key: null as string | null,
            tipo: "normal" as const,
            tipo_entrega,
          },
        ];

  const ins = await supabase.from("ordenes_trabajo").insert(filas).select("id,orden_key");
  if (ins.error) return { ...empty, error: new Error(ins.error.message) };
  const created = ins.data ?? [];
  const otByOrdenKey: Record<string, string> = {};
  for (const r of created) {
    if (r.orden_key) otByOrdenKey[r.orden_key] = r.id;
  }
  const otIds = created.map((r) => r.id);
  return { otId: otIds[0] ?? null, otIds, otByOrdenKey, error: null };
}

/** Crea las OT de la venta si todavía no existen (p. ej. seña ya cargada). */
export async function ensureOtsParaPresupuesto(presupuestoId: string): Promise<{
  otIds: string[];
  error: Error | null;
}> {
  const pres = await supabase
    .from("presupuestos")
    .select("id,numero,cliente,payload")
    .eq("id", presupuestoId)
    .maybeSingle();
  if (pres.error) return { otIds: [], error: new Error(pres.error.message) };
  if (!pres.data) return { otIds: [], error: new Error("Presupuesto no encontrado.") };

  const venta = await supabase
    .from("ventas")
    .select("id")
    .eq("presupuesto_id", presupuestoId)
    .maybeSingle();
  if (venta.error) return { otIds: [], error: new Error(venta.error.message) };
  if (!venta.data?.id) return { otIds: [], error: new Error("No hay venta (falta la seña).") };

  const r = await crearJobOtSiAusente({
    ventaId: venta.data.id,
    presupuestoNumero: pres.data.numero,
    clienteNombre: pres.data.cliente,
    payload: pres.data.payload as Json,
    presupuestoId,
  });
  return { otIds: r.otIds, error: r.error };
}

/**
 * Intenta reservar las chapas señaladas en el payload.
 * Las que ya no están Disponibles vuelven en `pendientes` para que la UI pida reemplazo.
 */
export async function intentarReservarChapasSenaladas(opts: {
  otId?: string | null;
  otByOrdenKey?: Record<string, string>;
  payload: Json;
  created_by?: string | null;
}): Promise<{ error: Error | null; pendientes: ChapaReservaPendiente[]; reservadas: number }> {
  const parsed = parsePayload(opts.payload);
  const ordenes = parsed?.ordenes ?? [];
  const pendientes: ChapaReservaPendiente[] = [];
  let reservadas = 0;
  const fallbackOtId = opts.otId ?? Object.values(opts.otByOrdenKey ?? {})[0] ?? null;

  for (const ot of ordenes) {
    if (ot.piedraDelCliente) continue;
    const targetOtId = opts.otByOrdenKey?.[ot.key] ?? fallbackOtId;
    if (!targetOtId) continue;
    const plan = ot.planCorte ?? null;
    const chapaId = typeof ot.chapaSugeridaId === "string" ? ot.chapaSugeridaId : null;
    if (!plan && !chapaId) continue;

    const applied = await aplicarPlanEnSenia({
      otId: targetOtId,
      plan,
      chapaFallbackId: chapaId,
      created_by: opts.created_by ?? null,
    });
    if (applied.error || applied.pendientes) {
      const firstId = plan?.planchas[0]?.chapaId ?? chapaId ?? "";
      pendientes.push({
        otId: targetOtId,
        ordenKey: ot.key,
        chapaIdFallida: firstId,
        bulto: plan?.planchas[0]?.bulto || ot.chapaSugeridaBulto || "—",
        materialLabel: plan?.materialLabel || ot.chapaSugeridaLabel || "Material",
      });
      continue;
    }
    reservadas += plan?.planchas.length || (chapaId ? 1 : 0);
  }

  return { error: null, pendientes, reservadas };
}

async function getOrCreateVentaParaPago(
  presupuestoId: string,
): Promise<{ data: VentaRow | null; error: Error | null }> {
  const venta = await supabase
    .from("ventas")
    .select("*")
    .eq("presupuesto_id", presupuestoId)
    .maybeSingle();
  if (venta.error) {
    return { data: null, error: new Error(venta.error.message) };
  }
  if (venta.data) {
    return { data: venta.data as VentaRow, error: null };
  }

  const now = new Date().toISOString();
  const created = await supabase
    .from("ventas")
    .insert({
      presupuesto_id: presupuestoId,
      estado: "senado",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .maybeSingle();
  if (created.error) {
    return { data: null, error: new Error(created.error.message) };
  }

  return { data: (created.data as VentaRow | null) ?? null, error: null };
}

/**
 * Repara casos donde ya hay pagos en `ventas_pagos` pero nunca se creó la fila en `ordenes_trabajo`
 * (p. ej. falló el insert cuando aún no existía la tabla).
 */
export type DeudaClienteVenta = {
  presupuestoId: string;
  numero: string;
  cliente: string;
  moneda: "ars" | "usd";
  total: number;
  saldo: number;
  titulo: string | null;
};

export async function listDeudasCliente(opts: {
  clientId: string | null;
  clienteNombre: string;
}): Promise<{ data: DeudaClienteVenta[]; error: Error | null }> {
  const selectPres = "id, numero, cliente, client_id, total, moneda, status, created_at";
  const nombre = opts.clienteNombre.trim();
  const results: Array<{ data: unknown[] | null; error: { message: string } | null }> = [];

  if (opts.clientId) {
    const r = await supabase
      .from("presupuestos")
      .select(selectPres)
      .eq("status", "aprobado")
      .eq("client_id", opts.clientId);
    if (r.error) return { data: [], error: new Error(r.error.message) };
    results.push(r);
  }
  if (nombre) {
    const r = await supabase
      .from("presupuestos")
      .select(selectPres)
      .eq("status", "aprobado")
      .eq("cliente", nombre);
    if (r.error) return { data: [], error: new Error(r.error.message) };
    results.push(r);
  }
  if (results.length === 0) return { data: [], error: null };

  const byId = new Map<
    string,
    {
      id: string;
      numero: string;
      cliente: string;
      total: number;
      moneda: "ars" | "usd";
      status: string;
      created_at: string;
    }
  >();
  for (const r of results) {
    for (const row of r.data ?? []) {
      const p = row as {
        id: string;
        numero: string;
        cliente: string;
        total: number;
        moneda: "ars" | "usd";
        status: string;
        created_at: string;
      };
      if (p.id) byId.set(p.id, p);
    }
  }
  const base = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  try {
    const merged = await mergeVentasResumenIntoPresupuestos(base);
    const otIds = [
      ...new Set(
        merged
          .map((r) => r.orden_trabajo_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const tituloPorOt = new Map<string, string>();
    if (otIds.length > 0) {
      const otRes = await supabase.from("ordenes_trabajo").select("id, titulo").in("id", otIds);
      if (!otRes.error) {
        for (const ot of otRes.data ?? []) {
          const t = typeof ot.titulo === "string" ? ot.titulo.trim() : "";
          if (ot.id && t) tituloPorOt.set(ot.id, t);
        }
      }
    }
    const deudas: DeudaClienteVenta[] = [];
    for (const r of merged) {
      const saldoRaw =
        typeof r.saldo_misma_moneda === "number" ? r.saldo_misma_moneda : r.total;
      const saldo = Math.max(0, saldoRaw);
      if (saldo <= 0.005) continue;
      deudas.push({
        presupuestoId: r.id,
        numero: r.numero,
        cliente: r.cliente,
        moneda: r.moneda,
        total: r.total,
        saldo,
        titulo: r.orden_trabajo_id ? tituloPorOt.get(r.orden_trabajo_id) ?? null : null,
      });
    }
    return { data: deudas, error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e : new Error("No se pudieron cargar las deudas del cliente."),
    };
  }
}

export async function registrarPagoSena(opts: {
  presupuestoId: string;
  monto: number;
  moneda: "ars" | "usd";
  fecha: string;
  metodo: string;
  nota?: string;
  cuenta_id?: string | null;
  created_by?: string | null;
  retencionPorcentaje?: number | null;
  retencionMonto?: number | null;
  comprobante?: File | null;
  concepto?: Exclude<ConceptoMovimiento, "transferencia">;
}): Promise<ResultadoSenia> {
  const { data: pres, error: pErr } = await supabase
    .from("presupuestos")
    .select("*")
    .eq("id", opts.presupuestoId)
    .maybeSingle();
  if (pErr) return { error: new Error(pErr.message) };
  const presCast = pres as PresupuestoRow | null;
  if (!presCast) return { error: new Error("Presupuesto no encontrado.") };
  if (presCast.status !== "aprobado") return { error: new Error("Solo presupuestos aprobados reciben seña.") };

  const payloadSenia = parsePayload(presCast.payload as Json);
  const planErr = payloadSenia ? validarPlanParaSenia(payloadSenia.ordenes) : null;
  if (planErr) return { error: new Error(planErr) };

  const ventaRes = await getOrCreateVentaParaPago(opts.presupuestoId);
  if (ventaRes.error) return { error: ventaRes.error };
  const venta = ventaRes.data;
  if (!venta) return { error: new Error("No se pudo obtener la venta.") };

  if (!opts.metodo?.trim()) {
    return { error: new Error("Indicá cómo se paga: efectivo, transferencia, cheque o tarjeta.") };
  }

  let esAgente = false;
  let porcentajeCliente: number | null = null;
  if (presCast.client_id) {
    const cli = await supabase
      .from("clients")
      .select("es_agente_retencion, retencion_porcentaje")
      .eq("id", presCast.client_id)
      .maybeSingle();
    if (cli.error) return { error: new Error(cli.error.message) };
    esAgente = Boolean(cli.data?.es_agente_retencion);
    const pct = Number(cli.data?.retencion_porcentaje);
    porcentajeCliente = Number.isFinite(pct) ? pct : null;
  }

  const ret = calcularRetencion({
    bruto: opts.monto,
    esAgente,
    metodo: opts.metodo,
    porcentajeCliente,
    porcentajeOverride: opts.retencionPorcentaje,
    retencionMontoOverride: opts.retencionMonto,
  });
  if (ret.error) return { error: new Error(ret.error) };

  let cuentaId = opts.cuenta_id ?? null;
  if (!cuentaId) {
    const cuentas = await listCuentasActivas();
    if (cuentas.error) return { error: cuentas.error };
    cuentaId = sugerirCuentaPorMetodo(opts.metodo, opts.moneda, cuentas.data);
  }

  const pIns = await supabase.from("ventas_pagos").insert({
    venta_id: venta.id,
    monto: opts.monto,
    moneda: opts.moneda,
    fecha: opts.fecha,
    metodo: opts.metodo,
    nota: opts.nota ?? null,
    cuenta_id: cuentaId,
    retencion_porcentaje: ret.aplica ? ret.porcentaje : null,
    retencion_monto: ret.aplica ? ret.retencionMonto : 0,
    created_by: opts.created_by ?? null,
  }).select("id").single();
  if (pIns.error) return { error: new Error(pIns.error.message) };

  if (cuentaId && pIns.data?.id && ret.neto > 0) {
    const metodoLibro = normalizarMetodoLibro(opts.metodo);
    const mov = await registrarMovimientoPorCobro({
      cuentaId,
      pagoId: pIns.data.id,
      monto: ret.neto,
      moneda: opts.moneda,
      fecha: opts.fecha,
      metodo: opts.metodo,
      descripcion: `Cobro ${presCast.numero} · ${opts.metodo}`,
      created_by: opts.created_by ?? null,
      acreditacion: metodoLibro === "tarjeta" ? "pendiente" : "no_aplica",
      concepto: opts.concepto ?? "trabajo",
    });
    if (mov.error) return { error: mov.error };
    if (opts.comprobante && mov.id) {
      const up = await adjuntarComprobanteMovimiento(mov.id, opts.comprobante);
      if (up.error) return { error: up.error };
    }
  }

  /** Con seña nace la venta comercial; producción espera medición + envío explícito. */
  const estadoActual = (venta.estado as VentaEstado | null) ?? null;
  const nextEstado: VentaEstado =
    estadoActual === "finalizado" || estadoActual === "entregado" || estadoActual === "en_produccion"
      ? estadoActual
      : "en_medicion";

  const now = new Date().toISOString();
  if (nextEstado !== venta.estado) {
    const updV = await supabase
      .from("ventas")
      .update({ estado: nextEstado, updated_at: now })
      .eq("id", venta.id);
    if (updV.error) return { error: new Error(updV.error.message) };
  }

  const otRes = await crearJobOtSiAusente({
    ventaId: venta.id,
    presupuestoNumero: presCast.numero,
    clienteNombre: presCast.cliente,
    payload: presCast.payload as Json,
    presupuestoId: opts.presupuestoId,
  });
  if (otRes.error) return { error: otRes.error, otId: otRes.otId };

  const med = await getOrCreateMedicion(opts.presupuestoId);
  if (med.error) return { error: med.error, otId: otRes.otId };
  if (med.data?.estado === "sin_solicitar") {
    const sol = await solicitarMedicion({
      presupuestoId: opts.presupuestoId,
      usuarioId: opts.created_by ?? null,
    });
    if (sol.error) return { error: sol.error, otId: otRes.otId };
  }

  if (!otRes.otId) return { error: null, otId: null };

  const reserva = await intentarReservarChapasSenaladas({
    otId: otRes.otId,
    otByOrdenKey: otRes.otByOrdenKey,
    payload: presCast.payload as Json,
    created_by: opts.created_by ?? null,
  });
  if (reserva.error) return { error: reserva.error, otId: otRes.otId };

  return {
    error: null,
    otId: otRes.otId,
    chapasPendientes: reserva.pendientes.length > 0 ? reserva.pendientes : undefined,
  };
}

function etapaOtValida(raw: unknown): EtapaOtKanban {
  const ok = raw === "medicion" || raw === "corte" || raw === "produccion" || raw === "despacho";
  return ok ? raw : "medicion";
}

export async function persistJobOtProduccion(opts: {
  ordenTrabajoId: string;
  patch: {
    etapa?: EtapaOtKanban;
    pausada?: boolean;
    status?: JobStatus;
  };
}): Promise<{ error: Error | null }> {
  const prev = await supabase
    .from("ordenes_trabajo")
    .select("*")
    .eq("id", opts.ordenTrabajoId)
    .maybeSingle();
  if (prev.error) return { error: new Error(prev.error.message) };
  const ot = prev.data as OrdenTrabajoRow | undefined;
  if (!ot) return { error: new Error("Orden de trabajo no encontrada.") };

  const etapaActual = etapaOtValida(ot.etapa);
  const nextEtapa = opts.patch.etapa ?? etapaActual;
  const nextPausada =
    typeof opts.patch.pausada === "boolean" ? opts.patch.pausada : Boolean(ot.pausada);
  const nextStatus: JobStatus = opts.patch.status ?? (ot.estado as JobStatus);

  const now = new Date().toISOString();
  const up = await supabase
    .from("ordenes_trabajo")
    .update({
      etapa: nextEtapa,
      pausada: nextPausada,
      estado: nextStatus,
      actualizado_en: now,
    })
    .eq("id", opts.ordenTrabajoId);
  if (up.error) return { error: new Error(up.error.message) };

  if (!ot.venta_id) return { error: null };

  const { data: ventaRow, error: vErr } = await supabase
    .from("ventas")
    .select("estado")
    .eq("id", ot.venta_id)
    .maybeSingle();
  if (vErr || !ventaRow) return { error: null };

  const vEst = ventaRow.estado as VentaEstado;

  let ventaPatch: VentaEstado | null = null;
  if (nextStatus === "done") {
    const sibs = await supabase
      .from("ordenes_trabajo")
      .select("id,estado")
      .eq("venta_id", ot.venta_id)
      .neq("estado", "cancelled");
    const todasDone = (sibs.data ?? []).every(
      (s) => s.id === opts.ordenTrabajoId || s.estado === "done",
    );
    if (!sibs.error && todasDone && vEst !== "entregado") {
      ventaPatch = "entregado";
    }
  } else if (
    (vEst === "senado" || vEst === "en_medicion") &&
    nextStatus !== "cancelled" &&
    etapaActual === "medicion" &&
    (nextEtapa === "corte" || nextEtapa === "produccion" || nextEtapa === "despacho")
  ) {
    ventaPatch = "en_produccion";
  }

  if (!ventaPatch || ventaPatch === vEst) return { error: null };

  const vUp = await supabase.from("ventas").update({ estado: ventaPatch, updated_at: now }).eq("id", ot.venta_id);
  if (vUp.error) return { error: new Error(vUp.error.message) };

  return { error: null };
}

export async function marcarVentaEntregado(ventaId: string): Promise<{ error: Error | null }> {
  const { data } = await supabase.from("ventas").select("estado").eq("id", ventaId).maybeSingle();
  if (!data) return { error: new Error("Venta no encontrada.") };
  if (data.estado !== "finalizado") {
    return { error: new Error('Solo se puede pasar a "entregado" desde estado finalizado.') };
  }
  const now = new Date().toISOString();
  const r = await supabase.from("ventas").update({ estado: "entregado", updated_at: now }).eq("id", ventaId);
  if (r.error) return { error: new Error(r.error.message) };
  return { error: null };
}

export type OtKanbanFuentePayload = Pick<PresupuestoRow, "id" | "numero" | "cliente" | "payload">;

export function textoDesdeOtPayloadClienteMaterial(
  pres: OtKanbanFuentePayload | null | undefined,
): { materialLabel: string; m2Display: string; vendedorLabel: string } {
  const p = parsePayload((pres?.payload ?? null) as Json);
  if (!p || !pres) {
    return { materialLabel: "—", m2Display: "—", vendedorLabel: "—" };
  }
  const fromLinea = p.lineasResumen?.find((l) => (l.label ?? "").trim().length > 0)?.label;
  const materialLabel =
    (fromLinea ?? p.ordenes?.[0]?.titulo ?? "Obra principal").trim() || "Obra principal";
  const m2 =
    typeof p.materialM2Presupuesto === "number"
      ? `${p.materialM2Presupuesto.toFixed(2)} m²`
      : "—";
  const vendedorLabel =
    (typeof p.vendedorNombre === "string" ? p.vendedorNombre.trim() : "") ||
    (p.ordenes?.[0]?.tecnicoId ?? "").trim() ||
    "—";
  return {
    materialLabel,
    m2Display: m2,
    vendedorLabel,
  };
}

export type OtPanelResumen = {
  id: string;
  titulo: string;
  estado: JobStatus;
  etapa: string;
  pausada: boolean;
  bloqueada: boolean;
  motivo_bloqueo: string | null;
  medidas_confirmadas: boolean;
  fecha_programada: string | null;
  tipo: "normal" | "reposicion";
};

export async function listOtsPorVenta(
  ventaId: string,
): Promise<{ data: OtPanelResumen[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("ordenes_trabajo")
    .select(
      "id, titulo, estado, etapa, pausada, bloqueada, motivo_bloqueo, medidas_confirmadas, fecha_programada, tipo",
    )
    .eq("venta_id", ventaId)
    .order("creado_en", { ascending: true });
  if (error) return { data: [], error: new Error(error.message) };
  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      titulo: row.titulo?.trim() || "Sin título",
      estado: (row.estado as JobStatus) ?? "pending",
      etapa: typeof row.etapa === "string" ? row.etapa : "",
      pausada: Boolean(row.pausada),
      bloqueada: Boolean(row.bloqueada),
      motivo_bloqueo: row.motivo_bloqueo ?? null,
      medidas_confirmadas: Boolean(row.medidas_confirmadas),
      fecha_programada: row.fecha_programada,
      tipo: row.tipo === "reposicion" ? "reposicion" : "normal",
    })),
    error: null,
  };
}

export async function listPagosVenta(
  ventaId: string,
): Promise<{ data: Database["public"]["Tables"]["ventas_pagos"]["Row"][]; error: Error | null }> {
  const { data, error } = await supabase
    .from("ventas_pagos")
    .select("*")
    .eq("venta_id", ventaId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  return {
    data: (data ?? []) as Database["public"]["Tables"]["ventas_pagos"]["Row"][],
    error: error ? new Error(error.message) : null,
  };
}
