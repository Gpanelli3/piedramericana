import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  hydratePresupuestoPayloadV1,
  isPresupuestoPayloadV1,
  type PresupuestoPayloadV1,
} from "@/types/presupuesto-payload";
import type { Json, JobStatus, PresupuestoEstado, VentaEstado } from "@/types/database";

export type ReportesPeriodo = "mes" | "30d" | "90d" | "anio";

export type ReportesKpiResumen = {
  cobradoMesUsd: number;
  cobradoMesArs: number;
  porCobrarUsd: number;
  porCobrarArs: number;
  clientesConSaldo: number;
  vencen7d: number;
  desperdicioPct: number;
  desperdicioM2Consumidos: number;
};

export type ReportesConversion = {
  pct: number;
  aprobados: number;
  total: number;
};

export type ReportesVelocidadEtapa = {
  key: "venta_retenida" | "tecnica" | "produccion" | "logistica";
  label: string;
  diasPromedio: number;
  cantidad: number;
};

export type ReportesPresupuestosDia = {
  dow: number;
  label: string;
  count: number;
};

export type ReportesTopMaterial = {
  nombre: string;
  m2: number;
};

export type ReportesSearchHit = {
  id: string;
  tipo: "presupuesto" | "ot";
  label: string;
  sublabel: string;
  presupuestoId?: string;
  otId?: string;
};

export type ReportesDashboard = {
  resumen: ReportesKpiResumen;
  conversion: ReportesConversion;
  velocidadEtapas: ReportesVelocidadEtapa[];
  presupuestosPorDia: ReportesPresupuestosDia[];
  ticketPromedioUsd: number;
  m2Entregados: number;
  topMateriales: ReportesTopMaterial[];
  busquedaIndex: ReportesSearchHit[];
  fetchedAt: string;
};

const DOW_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
const TERRACOTA = "#C47A3A";

export const REPORTES_CHART_COLOR = TERRACOTA;

type PresupuestoLite = {
  id: string;
  numero: string;
  cliente: string;
  total: number;
  moneda: "ars" | "usd";
  status: PresupuestoEstado;
  created_at: string;
  payload: Json;
};

type VentaLite = {
  id: string;
  presupuesto_id: string;
  estado: VentaEstado;
  updated_at: string;
  created_at: string;
};

type PagoLite = {
  venta_id: string;
  monto: string | number;
  moneda: "ars" | "usd";
  fecha: string;
};

type OtLite = {
  id: string;
  titulo: string;
  etapa: string;
  estado: JobStatus;
  pausada: boolean;
  fecha_programada: string | null;
  actualizado_en: string;
  creado_en: string;
  venta_id: string | null;
  tipo?: string | null;
};

type ChapaLite = {
  id: string;
  material_label: string;
  largo_cm: number;
  ancho_cm: number;
  estado: string;
  updated_at: string;
  chapa_origen_id: string | null;
};

function parsePayload(raw: Json): PresupuestoPayloadV1 | null {
  if (!isPresupuestoPayloadV1(raw)) return null;
  return hydratePresupuestoPayloadV1(raw);
}

function toUsd(amount: number, moneda: "ars" | "usd", dolarHoy: number): number {
  if (!Number.isFinite(amount)) return 0;
  if (moneda === "usd") return amount;
  const d = dolarHoy > 0 ? dolarHoy : 1;
  return amount / d;
}

function toNumber(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function chapaM2(c: Pick<ChapaLite, "largo_cm" | "ancho_cm">): number {
  const l = Number(c.largo_cm);
  const a = Number(c.ancho_cm);
  if (!Number.isFinite(l) || !Number.isFinite(a) || l <= 0 || a <= 0) return 0;
  return (l * a) / 10_000;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function periodoRange(periodo: ReportesPeriodo, now = new Date()): { from: Date; to: Date } {
  const to = now;
  if (periodo === "mes") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
  }
  if (periodo === "30d") {
    return { from: addDays(startOfLocalDay(now), -29), to };
  }
  if (periodo === "90d") {
    return { from: addDays(startOfLocalDay(now), -89), to };
  }
  return { from: new Date(now.getFullYear(), 0, 1), to };
}

function mesActualRange(now = new Date()): { from: Date; to: Date } {
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
}

function inRange(iso: string | null | undefined, from: Date, to: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= from.getTime() && t <= to.getTime();
}

function inDateRangeYmd(ymd: string | null | undefined, fromYmd: string, toYmd: string): boolean {
  if (!ymd || ymd.length < 10) return false;
  const d = ymd.slice(0, 10);
  return d >= fromYmd && d <= toYmd;
}

function diasEntre(fromIso: string, to = new Date()): number {
  const a = new Date(fromIso).getTime();
  if (!Number.isFinite(a)) return 0;
  const ms = Math.max(0, to.getTime() - a);
  return Math.round((ms / 86_400_000) * 10) / 10;
}

function fechaEntregaOt(
  ot: OtLite,
  payload: PresupuestoPayloadV1 | null,
): string | null {
  if (ot.fecha_programada && ot.fecha_programada.length >= 10) {
    return ot.fecha_programada.slice(0, 10);
  }
  const log = payload?.logistica?.fechaEntrega?.trim();
  if (log && log.length >= 10) return log.slice(0, 10);
  const fromOrdenes = payload?.ordenes
    ?.map((o) => o.fechaEntrega?.trim())
    .find((f) => f && f.length >= 10);
  return fromOrdenes ? fromOrdenes.slice(0, 10) : null;
}

function emptyDashboard(): ReportesDashboard {
  return {
    resumen: {
      cobradoMesUsd: 0,
      cobradoMesArs: 0,
      porCobrarUsd: 0,
      porCobrarArs: 0,
      clientesConSaldo: 0,
      vencen7d: 0,
      desperdicioPct: 0,
      desperdicioM2Consumidos: 0,
    },
    conversion: { pct: 0, aprobados: 0, total: 0 },
    velocidadEtapas: [
      { key: "venta_retenida", label: "Vta. Retenida", diasPromedio: 0, cantidad: 0 },
      { key: "tecnica", label: "Técnica", diasPromedio: 0, cantidad: 0 },
      { key: "produccion", label: "Producción", diasPromedio: 0, cantidad: 0 },
      { key: "logistica", label: "Logística", diasPromedio: 0, cantidad: 0 },
    ],
    presupuestosPorDia: DOW_LABELS.map((label, dow) => ({ dow, label, count: 0 })),
    ticketPromedioUsd: 0,
    m2Entregados: 0,
    topMateriales: [],
    busquedaIndex: [],
    fetchedAt: new Date().toISOString(),
  };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export async function fetchReportesDashboard(
  periodo: ReportesPeriodo,
): Promise<{ data: ReportesDashboard | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: emptyDashboard(), error: null };
  }

  const now = new Date();
  const { from: periodoFrom, to: periodoTo } = periodoRange(periodo, now);
  const { from: mesFrom, to: mesTo } = mesActualRange(now);
  const hoyYmd = isoDate(startOfLocalDay(now));
  const limite7Ymd = isoDate(addDays(startOfLocalDay(now), 7));
  const weekdayFrom = addDays(startOfLocalDay(now), -89);

  const [presRes, ventasRes, pagosRes, otsRes, chapasRes, matsRes] = await Promise.all([
    supabase
      .from("presupuestos")
      .select("id, numero, cliente, total, moneda, status, created_at, payload")
      .order("created_at", { ascending: false }),
    supabase.from("ventas").select("id, presupuesto_id, estado, updated_at, created_at"),
    supabase.from("ventas_pagos").select("venta_id, monto, moneda, fecha"),
    supabase
      .from("ordenes_trabajo")
      .select(
        "id, titulo, etapa, estado, pausada, fecha_programada, actualizado_en, creado_en, venta_id, tipo",
      ),
    supabase
      .from("chapas_inventario")
      .select("id, material_label, largo_cm, ancho_cm, estado, updated_at, chapa_origen_id"),
    supabase.from("materials").select("id, name"),
  ]);

  if (presRes.error) return { data: null, error: new Error(presRes.error.message) };
  if (ventasRes.error) return { data: null, error: new Error(ventasRes.error.message) };
  if (pagosRes.error) return { data: null, error: new Error(pagosRes.error.message) };
  if (otsRes.error) return { data: null, error: new Error(otsRes.error.message) };
  if (chapasRes.error) return { data: null, error: new Error(chapasRes.error.message) };

  const presupuestos = (presRes.data ?? []) as PresupuestoLite[];
  const ventas = (ventasRes.data ?? []) as VentaLite[];
  const pagos = (pagosRes.data ?? []) as PagoLite[];
  const ots = (otsRes.data ?? []) as OtLite[];
  const chapas = (chapasRes.data ?? []) as ChapaLite[];
  const materialNombre = new Map<string, string>();
  for (const m of matsRes.data ?? []) {
    if (m.id && m.name) materialNombre.set(m.id, m.name);
  }

  const ventaByPres = new Map<string, VentaLite>();
  const ventaById = new Map<string, VentaLite>();
  for (const v of ventas) {
    ventaByPres.set(v.presupuesto_id, v);
    ventaById.set(v.id, v);
  }

  const pagosByVenta = new Map<string, PagoLite[]>();
  for (const p of pagos) {
    const list = pagosByVenta.get(p.venta_id) ?? [];
    list.push(p);
    pagosByVenta.set(p.venta_id, list);
  }

  const payloadByPres = new Map<string, PresupuestoPayloadV1 | null>();
  for (const p of presupuestos) {
    payloadByPres.set(p.id, parsePayload(p.payload));
  }

  const otByVenta = new Map<string, OtLite>();
  for (const ot of ots) {
    if (ot.tipo === "reposicion") continue;
    if (ot.venta_id && !otByVenta.has(ot.venta_id)) otByVenta.set(ot.venta_id, ot);
  }

  // —— Cobrado este mes ——
  let cobradoMesUsd = 0;
  let cobradoMesArs = 0;
  for (const p of pagos) {
    if (!inDateRangeYmd(p.fecha, isoDate(mesFrom), isoDate(mesTo))) continue;
    const monto = toNumber(p.monto);
    if (p.moneda === "usd") cobradoMesUsd += monto;
    else cobradoMesArs += monto;
  }

  // —— Por cobrar ——
  let porCobrarUsd = 0;
  let porCobrarArs = 0;
  const clientesConDeuda = new Set<string>();
  for (const p of presupuestos) {
    if (p.status !== "aprobado") continue;
    const venta = ventaByPres.get(p.id);
    if (!venta) {
      if (p.moneda === "usd") porCobrarUsd += p.total;
      else porCobrarArs += p.total;
      clientesConDeuda.add(p.cliente.trim().toLowerCase() || p.id);
      continue;
    }
    let pagado = 0;
    for (const pago of pagosByVenta.get(venta.id) ?? []) {
      if (pago.moneda !== p.moneda) continue;
      pagado += toNumber(pago.monto);
    }
    const saldo = Math.max(0, p.total - pagado);
    if (saldo <= 0.009) continue;
    if (p.moneda === "usd") porCobrarUsd += saldo;
    else porCobrarArs += saldo;
    clientesConDeuda.add(p.cliente.trim().toLowerCase() || p.id);
  }

  // —— Vencen en 7 días ——
  let vencen7d = 0;
  for (const ot of ots) {
    if (ot.tipo === "reposicion") continue;
    if (ot.estado === "done" || ot.estado === "cancelled") continue;
    const venta = ot.venta_id ? ventaById.get(ot.venta_id) : undefined;
    const payload = venta ? payloadByPres.get(venta.presupuesto_id) ?? null : null;
    const fecha = fechaEntregaOt(ot, payload);
    if (!fecha) continue;
    if (fecha >= hoyYmd && fecha <= limite7Ymd) vencen7d += 1;
  }

  // —— Desperdicio del mes ——
  const chapasUsadasMes = chapas.filter(
    (c) => c.estado === "Usada" && inRange(c.updated_at, mesFrom, mesTo),
  );
  const m2Usados = chapasUsadasMes.reduce((s, c) => s + chapaM2(c), 0);
  const origenIds = new Set(chapasUsadasMes.map((c) => c.id));
  const m2Retazos = chapas
    .filter(
      (c) =>
        c.chapa_origen_id &&
        origenIds.has(c.chapa_origen_id) &&
        inRange(c.updated_at, mesFrom, mesTo),
    )
    .reduce((s, c) => s + chapaM2(c), 0);

  let m2Planificados = 0;
  const otsConConsumoMes = new Set<string>();
  // Approximate planned m² from approved budgets updated/created this month with active OTs
  for (const p of presupuestos) {
    if (p.status !== "aprobado") continue;
    const payload = payloadByPres.get(p.id);
    if (!payload) continue;
    const venta = ventaByPres.get(p.id);
    if (!venta) continue;
    const ot = otByVenta.get(venta.id);
    if (!ot) continue;
    if (!inRange(ot.actualizado_en, mesFrom, mesTo) && !inRange(venta.updated_at, mesFrom, mesTo)) {
      continue;
    }
    const m2 = Number(payload.materialM2Presupuesto) || 0;
    if (m2 > 0) {
      m2Planificados += m2;
      otsConConsumoMes.add(ot.id);
    }
  }
  // If we have used slabs but no planned link, still show consumed m²
  const desperdicioM2Consumidos = Math.round(m2Usados * 1000) / 1000;
  let desperdicioPct = 0;
  if (m2Usados > 0) {
    const waste = Math.max(0, m2Usados - m2Retazos - m2Planificados);
    desperdicioPct = Math.round((waste / m2Usados) * 1000) / 10;
  } else if (otsConConsumoMes.size === 0) {
    desperdicioPct = 0;
  }

  // —— Conversión ——
  const enPeriodo = presupuestos.filter((p) => inRange(p.created_at, periodoFrom, periodoTo));
  const aprobadosPeriodo = enPeriodo.filter((p) => p.status === "aprobado");
  const conversionTotal = enPeriodo.length;
  const conversionAprob = aprobadosPeriodo.length;
  const conversionPct =
    conversionTotal > 0
      ? Math.round((conversionAprob / conversionTotal) * 1000) / 10
      : 0;

  // —— Velocidad por etapa (dwell actual) ——
  const buckets: Record<
    ReportesVelocidadEtapa["key"],
    number[]
  > = {
    venta_retenida: [],
    tecnica: [],
    produccion: [],
    logistica: [],
  };
  for (const ot of ots) {
    if (ot.estado === "done" || ot.estado === "cancelled") continue;
    const dwell = diasEntre(ot.actualizado_en || ot.creado_en, now);
    if (ot.pausada) {
      buckets.venta_retenida.push(dwell);
      continue;
    }
    if (ot.etapa === "medicion") buckets.tecnica.push(dwell);
    else if (ot.etapa === "corte" || ot.etapa === "produccion") buckets.produccion.push(dwell);
    else if (ot.etapa === "despacho") buckets.logistica.push(dwell);
  }
  const velocidadEtapas: ReportesVelocidadEtapa[] = [
    {
      key: "venta_retenida",
      label: "Vta. Retenida",
      diasPromedio: avg(buckets.venta_retenida),
      cantidad: buckets.venta_retenida.length,
    },
    {
      key: "tecnica",
      label: "Técnica",
      diasPromedio: avg(buckets.tecnica),
      cantidad: buckets.tecnica.length,
    },
    {
      key: "produccion",
      label: "Producción",
      diasPromedio: avg(buckets.produccion),
      cantidad: buckets.produccion.length,
    },
    {
      key: "logistica",
      label: "Logística",
      diasPromedio: avg(buckets.logistica),
      cantidad: buckets.logistica.length,
    },
  ];

  // —— Presupuestos por día (mín. 90d) ——
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const p of presupuestos) {
    if (!inRange(p.created_at, weekdayFrom, now)) continue;
    const dow = new Date(p.created_at).getDay();
    weekdayCounts[dow] += 1;
  }
  const presupuestosPorDia: ReportesPresupuestosDia[] = DOW_LABELS.map((label, dow) => ({
    dow,
    label,
    count: weekdayCounts[dow],
  }));

  // —— Ticket promedio ——
  const ticketsUsd = aprobadosPeriodo.map((p) => {
    const payload = payloadByPres.get(p.id);
    const dolar = payload?.dolarHoy && payload.dolarHoy > 0 ? payload.dolarHoy : 1250;
    return toUsd(p.total, p.moneda, dolar);
  });
  const ticketPromedioUsd =
    ticketsUsd.length > 0
      ? Math.round((ticketsUsd.reduce((a, b) => a + b, 0) / ticketsUsd.length) * 100) / 100
      : 0;

  // —— m² entregados ——
  let m2Entregados = 0;
  for (const v of ventas) {
    if (v.estado !== "entregado" && v.estado !== "finalizado") continue;
    if (!inRange(v.updated_at, periodoFrom, periodoTo)) continue;
    const payload = payloadByPres.get(v.presupuesto_id);
    const m2 = Number(payload?.materialM2Presupuesto) || 0;
    m2Entregados += m2;
  }
  m2Entregados = Math.round(m2Entregados * 1000) / 1000;

  // —— Top materiales ——
  const m2PorMaterial = new Map<string, number>();
  const usadasPeriodo = chapas.filter(
    (c) => c.estado === "Usada" && inRange(c.updated_at, periodoFrom, periodoTo),
  );
  for (const c of usadasPeriodo) {
    const nombre = (c.material_label || "Sin nombre").trim();
    m2PorMaterial.set(nombre, (m2PorMaterial.get(nombre) ?? 0) + chapaM2(c));
  }
  if (m2PorMaterial.size === 0) {
    for (const p of aprobadosPeriodo) {
      const payload = payloadByPres.get(p.id);
      if (!payload?.ordenes?.length) continue;
      const m2Total = Number(payload.materialM2Presupuesto) || 0;
      if (m2Total <= 0) continue;
      const porOrden = m2Total / payload.ordenes.length;
      for (const o of payload.ordenes) {
        const nombre =
          (o.materialId && materialNombre.get(o.materialId)) ||
          o.chapaSugeridaLabel?.trim() ||
          "Material";
        m2PorMaterial.set(nombre, (m2PorMaterial.get(nombre) ?? 0) + porOrden);
      }
    }
  }
  const topMateriales: ReportesTopMaterial[] = [...m2PorMaterial.entries()]
    .map(([nombre, m2]) => ({ nombre, m2: Math.round(m2 * 10) / 10 }))
    .sort((a, b) => b.m2 - a.m2)
    .slice(0, 5);

  // —— Índice de búsqueda ——
  const busquedaIndex: ReportesSearchHit[] = [];
  for (const p of presupuestos) {
    busquedaIndex.push({
      id: `p-${p.id}`,
      tipo: "presupuesto",
      label: p.numero,
      sublabel: p.cliente,
      presupuestoId: p.id,
    });
  }
  for (const ot of ots) {
    const venta = ot.venta_id ? ventaById.get(ot.venta_id) : undefined;
    const pres = venta ? presupuestos.find((x) => x.id === venta.presupuesto_id) : undefined;
    busquedaIndex.push({
      id: `ot-${ot.id}`,
      tipo: "ot",
      label: ot.titulo?.trim() || pres?.numero || "OT",
      sublabel: pres?.cliente ?? "",
      presupuestoId: pres?.id,
      otId: ot.id,
    });
  }

  return {
    data: {
      resumen: {
        cobradoMesUsd: Math.round(cobradoMesUsd * 100) / 100,
        cobradoMesArs: Math.round(cobradoMesArs),
        porCobrarUsd: Math.round(porCobrarUsd * 100) / 100,
        porCobrarArs: Math.round(porCobrarArs),
        clientesConSaldo: clientesConDeuda.size,
        vencen7d,
        desperdicioPct,
        desperdicioM2Consumidos,
      },
      conversion: {
        pct: conversionPct,
        aprobados: conversionAprob,
        total: conversionTotal,
      },
      velocidadEtapas,
      presupuestosPorDia,
      ticketPromedioUsd,
      m2Entregados,
      topMateriales,
      busquedaIndex,
      fetchedAt: new Date().toISOString(),
    },
    error: null,
  };
}

export const REPORTES_PERIODO_LABELS: Record<ReportesPeriodo, string> = {
  mes: "Este mes",
  "30d": "30 días",
  "90d": "90 días",
  anio: "Este año",
};
