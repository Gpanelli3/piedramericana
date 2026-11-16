import type { CobrosComprobantePago } from "@/components/venta/CobrosComprobanteDocumento";
import { etiquetaEtapaOt } from "@/lib/etiquetas-ot";
import { getPresupuestoById } from "@/lib/presupuestos-api";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getVentaPorPresupuesto, listPagosVenta } from "@/lib/ventas-api";
import type { Database, JobStatus } from "@/types/database";
import {
  hydratePresupuestoPayloadV1,
  isPresupuestoPayloadV1,
} from "@/types/presupuesto-payload";

type VentasPagoRow = Database["public"]["Tables"]["ventas_pagos"]["Row"];

export type CobrosComprobanteDatos = {
  numeroPresupuesto: string;
  clienteNombre: string;
  contacto: string;
  tel: string;
  email: string;
  etapaLabel: string;
  moneda: "ars" | "usd";
  total: number;
  cobrado: number;
  saldo: number;
  pagos: CobrosComprobantePago[];
};

function montoPagoNum(p: VentasPagoRow): number {
  const val = typeof p.monto === "string" ? parseFloat(p.monto) : Number(p.monto ?? 0);
  return Number.isFinite(val) ? val : 0;
}

function pagosADocumento(pagos: VentasPagoRow[]): CobrosComprobantePago[] {
  return pagos.map((p) => {
    const retRaw =
      typeof p.retencion_monto === "string"
        ? parseFloat(p.retencion_monto)
        : Number(p.retencion_monto ?? 0);
    const ret = Number.isFinite(retRaw) ? retRaw : 0;
    const pctRaw =
      typeof p.retencion_porcentaje === "string"
        ? parseFloat(p.retencion_porcentaje)
        : Number(p.retencion_porcentaje ?? NaN);
    return {
      id: p.id,
      fecha: p.fecha,
      monto: montoPagoNum(p),
      moneda: p.moneda === "usd" ? "usd" : "ars",
      metodo: p.metodo,
      nota: p.nota,
      retencionMonto: ret,
      retencionPorcentaje: Number.isFinite(pctRaw) ? pctRaw : null,
    };
  });
}

export async function loadCobrosComprobante(
  presupuestoId: string,
): Promise<{ data: CobrosComprobanteDatos | null; error: Error | null }> {
  const res = await getPresupuestoById(presupuestoId);
  if (res.error) return { data: null, error: new Error(res.error.message) };
  if (!res.data) {
    return { data: null, error: new Error("No encontramos ese presupuesto.") };
  }

  const fila = res.data as Database["public"]["Tables"]["presupuestos"]["Row"];
  const payload =
    fila.payload && isPresupuestoPayloadV1(fila.payload)
      ? hydratePresupuestoPayloadV1(fila.payload)
      : null;

  const moneda: "ars" | "usd" = fila.moneda === "ars" ? "ars" : "usd";
  const total = typeof fila.total === "number" ? fila.total : 0;

  let pagos: VentasPagoRow[] = [];
  let etapaLabel = "Sin OT";

  const vt = await getVentaPorPresupuesto(presupuestoId);
  if (vt.error) return { data: null, error: vt.error };

  if (vt.data) {
    const lp = await listPagosVenta(vt.data.id);
    if (lp.error) return { data: null, error: lp.error };
    pagos = lp.data ?? [];

    if (vt.data.estado === "entregado") {
      etapaLabel = "Entregada";
    } else if (isSupabaseConfigured) {
      const otRes = await supabase
        .from("ordenes_trabajo")
        .select("etapa,estado")
        .eq("venta_id", vt.data.id)
        .limit(1)
        .maybeSingle();
      if (!otRes.error && otRes.data) {
        etapaLabel = etiquetaEtapaOt(
          typeof otRes.data.etapa === "string" ? otRes.data.etapa : null,
          (otRes.data.estado as JobStatus) ?? null,
        );
      }
    }
  }

  let cobrado = 0;
  for (const p of pagos) {
    if (p.moneda !== moneda) continue;
    cobrado += montoPagoNum(p);
  }

  return {
    data: {
      numeroPresupuesto: fila.numero,
      clienteNombre: payload?.clienteNombre?.trim() || fila.cliente,
      contacto: payload?.contacto ?? "",
      tel: payload?.tel ?? "",
      email: payload?.email ?? "",
      etapaLabel,
      moneda,
      total,
      cobrado,
      saldo: Math.max(0, total - cobrado),
      pagos: pagosADocumento(pagos),
    },
    error: null,
  };
}
