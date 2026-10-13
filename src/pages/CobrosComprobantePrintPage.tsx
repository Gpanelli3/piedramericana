"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CobrosComprobanteDocumento,
  type CobrosComprobantePago,
} from "@/components/venta/CobrosComprobanteDocumento";
import { getPresupuestoById } from "@/lib/presupuestos-api";
import { getVentaPorPresupuesto, listPagosVenta } from "@/lib/ventas-api";
import { etiquetaEtapaOt } from "@/lib/etiquetas-ot";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database, JobStatus } from "@/types/database";
import {
  hydratePresupuestoPayloadV1,
  isPresupuestoPayloadV1,
} from "@/types/presupuesto-payload";

type PresupuestoRow = Database["public"]["Tables"]["presupuestos"]["Row"];
type VentasPagoRow = Database["public"]["Tables"]["ventas_pagos"]["Row"];

function montoPagoNum(p: VentasPagoRow): number {
  const val = typeof p.monto === "string" ? parseFloat(p.monto) : Number(p.monto ?? 0);
  return Number.isFinite(val) ? val : 0;
}

export function CobrosComprobantePrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoDescargar = searchParams.get("descargar") === "1";
  const autoPrintDone = useRef(false);

  const [cargando, setCargando] = useState(true);
  const [fila, setFila] = useState<PresupuestoRow | null>(null);
  const [pagos, setPagos] = useState<VentasPagoRow[]>([]);
  const [otEtapa, setOtEtapa] = useState<string | null>(null);
  const [otEstado, setOtEstado] = useState<JobStatus | null>(null);
  const [ventaEntregada, setVentaEntregada] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCargando(true);
      if (!id) {
        setFila(null);
        setPagos([]);
        setCargando(false);
        return;
      }

      const res = await getPresupuestoById(id);
      if (cancelled) return;
      if (res.error || !res.data) {
        toast.error(res.error?.message ?? "No encontramos ese presupuesto.");
        setFila(null);
        setPagos([]);
        setCargando(false);
        return;
      }

      const row = res.data as PresupuestoRow;
      setFila(row);

      const vt = await getVentaPorPresupuesto(id);
      if (cancelled) return;
      if (vt.error || !vt.data) {
        setPagos([]);
        setVentaEntregada(false);
        setOtEtapa(null);
        setOtEstado(null);
        setCargando(false);
        return;
      }

      setVentaEntregada(vt.data.estado === "entregado");
      const lp = await listPagosVenta(vt.data.id);
      if (cancelled) return;
      setPagos(lp.error ? [] : lp.data ?? []);

      if (isSupabaseConfigured) {
        const otRes = await supabase
          .from("ordenes_trabajo")
          .select("etapa,estado")
          .eq("venta_id", vt.data.id)
          .limit(1)
          .maybeSingle();
        if (!cancelled && !otRes.error && otRes.data) {
          setOtEtapa(typeof otRes.data.etapa === "string" ? otRes.data.etapa : null);
          setOtEstado((otRes.data.estado as JobStatus) ?? null);
        } else if (!cancelled) {
          setOtEtapa(null);
          setOtEstado(null);
        }
      }

      setCargando(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!autoDescargar || cargando || !fila || autoPrintDone.current) return;
    autoPrintDone.current = true;
    const t = window.setTimeout(() => {
      window.print();
    }, 350);
    return () => window.clearTimeout(t);
  }, [autoDescargar, cargando, fila]);

  const payload =
    fila?.payload && isPresupuestoPayloadV1(fila.payload)
      ? hydratePresupuestoPayloadV1(fila.payload)
      : null;

  const moneda: "ars" | "usd" = fila?.moneda === "ars" ? "ars" : "usd";
  const total = typeof fila?.total === "number" ? fila.total : 0;

  const cobrado = useMemo(() => {
    let sum = 0;
    for (const p of pagos) {
      if (p.moneda !== moneda) continue;
      sum += montoPagoNum(p);
    }
    return sum;
  }, [pagos, moneda]);

  const saldo = Math.max(0, total - cobrado);

  const pagosDoc: CobrosComprobantePago[] = useMemo(
    () =>
      pagos.map((p) => {
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
      }),
    [pagos],
  );

  const etapaLabel = ventaEntregada
    ? "Entregada"
    : etiquetaEtapaOt(otEtapa, otEstado);

  const volver = useCallback(() => {
    navigate("/?ws=administracion");
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-neutral-100 text-foreground print:bg-white">
      <div className="print:hidden flex flex-wrap items-center gap-2 border-b bg-background px-6 py-3">
        <Button type="button" size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Download className="h-4 w-4" aria-hidden />
          Descargar PDF
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" aria-hidden />
          Imprimir
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={volver}>
          Volver a ventas
        </Button>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 print:px-0 print:py-0">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Generando comprobante…</p>
        ) : !fila ? (
          <p className="text-sm text-muted-foreground">
            Presupuesto no disponible para imprimir el comprobante.
          </p>
        ) : (
          <CobrosComprobanteDocumento
            className="border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 print:border-0 print:p-0 print:shadow-none"
            numeroPresupuesto={fila.numero}
            clienteNombre={payload?.clienteNombre?.trim() || fila.cliente}
            contacto={payload?.contacto ?? ""}
            tel={payload?.tel ?? ""}
            email={payload?.email ?? ""}
            etapaLabel={etapaLabel}
            moneda={moneda}
            total={total}
            cobrado={cobrado}
            saldo={saldo}
            pagos={pagosDoc}
            fechaEmision={new Date().toLocaleDateString("es-AR")}
          />
        )}
      </div>
    </div>
  );
}
