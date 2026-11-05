"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Download, Paperclip, Plus, Printer, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FechaInput } from "@/components/ui/fecha-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Database, JobStatus, VentaEstado } from "@/types/database";
import {
  getVentaPorPresupuesto,
  listDeudasCliente,
  listPagosVenta,
  registrarPagoSena,
  type ChapaReservaPendiente,
  type DeudaClienteVenta,
} from "@/lib/ventas-api";
import {
  CONCEPTOS_MOVIMIENTO,
  METODOS_COBRO_UI,
  etiquetaMetodo,
  listCuentasActivas,
  sugerirCuentaPorMetodo,
  type ConceptoMovimiento,
  type CuentaFinancieraRow,
} from "@/lib/finanzas-api";
import {
  montoCancelarTodo,
  totalPorMoneda,
  validarYPartirPago,
} from "@/lib/pago-reparto";
import { validateFinanzasComprobanteFile } from "@/lib/finanzas-documentos-storage";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { ElegirChapaReemplazoDialog } from "@/components/presupuesto/ElegirChapaReemplazoDialog";
import { etiquetaEtapaOt } from "@/lib/etiquetas-ot";
import { enviarAProduccionSiCorresponde } from "@/lib/produccion-api";

type VentasPagoRow = Database["public"]["Tables"]["ventas_pagos"]["Row"];

function formatMonto(n: number, moneda: "ars" | "usd") {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: moneda === "usd" ? 2 : 0,
  };
  if (moneda === "usd") {
    return `USD ${n.toLocaleString("es-AR", opts)}`;
  }
  return `$ ${n.toLocaleString("es-AR", opts)}`;
}

function formatTotalesEntra(t: { ars: number; usd: number }, fallback: "ars" | "usd") {
  const parts: string[] = [];
  if (t.usd > 0) parts.push(formatMonto(t.usd, "usd"));
  if (t.ars > 0) parts.push(formatMonto(t.ars, "ars"));
  if (parts.length === 0) return formatMonto(0, fallback);
  return parts.join(" · ");
}

function formatoFechaCortaDb(s: string): string {
  try {
    const d =
      /\d{4}-\d{2}-\d{2}/.exec(s)?.[0]
        ? new Date(s.includes("T") ? s : `${s}T12:00:00`)
        : new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

function montoPagoNum(p: VentasPagoRow): number {
  const val = typeof p.monto === "string" ? parseFloat(p.monto) : Number(p.monto ?? 0);
  return Number.isFinite(val) ? val : 0;
}

function retencionPagoNum(p: VentasPagoRow): number {
  const val =
    typeof p.retencion_monto === "string" ? parseFloat(p.retencion_monto) : Number(p.retencion_monto ?? 0);
  return Number.isFinite(val) ? val : 0;
}

function parseMontoCampo(raw: string): number | null {
  const t = String(raw).replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const CONCEPTOS_INGRESO = CONCEPTOS_MOVIMIENTO.filter(
  (c) => c.para === "ingreso" || c.para === "ambos",
);

type ConceptoIngreso = Exclude<ConceptoMovimiento, "transferencia">;

type FormaPagoUi = {
  key: string;
  metodo: string;
  moneda: "ars" | "usd";
  monto: string;
  cuentaId: string;
};

function nuevaFormaPago(moneda: "ars" | "usd", cuentas: CuentaFinancieraRow[]): FormaPagoUi {
  const metodo = "transferencia";
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    metodo,
    moneda,
    monto: "",
    cuentaId: sugerirCuentaPorMetodo(metodo, moneda, cuentas) ?? "",
  };
}

/** Cabecera opcional; si falta, el diálogo la carga desde el presupuesto. */
export type VentaCobrosResumen = {
  cliente?: string | null;
  numero?: string | null;
  total?: number | null;
  moneda?: "ars" | "usd" | null;
  orden_trabajo_id?: string | null;
  ot_etapa?: string | null;
  ot_estado?: JobStatus | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presupuestoId: string | null;
  rowResumen: VentaCobrosResumen | null;
  onDatosCambiaron: () => Promise<void>;
};

export function VentaCobrosDialog({
  open,
  onOpenChange,
  presupuestoId,
  rowResumen,
  onDatosCambiaron,
}: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [ventaCabecera, setVentaCabecera] = useState<{ id: string; estado: VentaEstado } | null>(null);
  const [pagosVentas, setPagosVentas] = useState<VentasPagoRow[]>([]);
  const [pagoBusy, setPagoBusy] = useState(false);
  const [pagoFecha, setPagoFecha] = useState("");
  const [pagoNota, setPagoNota] = useState("");
  const [conceptoPago, setConceptoPago] = useState<ConceptoIngreso>("trabajo");
  const [formasPago, setFormasPago] = useState<FormaPagoUi[]>([]);
  const [cuentasPago, setCuentasPago] = useState<CuentaFinancieraRow[]>([]);
  const [deudasCliente, setDeudasCliente] = useState<DeudaClienteVenta[]>([]);
  const [asignadoPorId, setAsignadoPorId] = useState<Record<string, string>>({});
  const [comprobante, setComprobante] = useState<File | null>(null);
  const comprobanteInputRef = useRef<HTMLInputElement>(null);
  const [notaOpen, setNotaOpen] = useState(false);
  const [formPagoOpen, setFormPagoOpen] = useState(false);
  const [otsCount, setOtsCount] = useState(0);
  const [otEtapa, setOtEtapa] = useState<string | null>(null);
  const [otEstado, setOtEstado] = useState<JobStatus | null>(null);
  const [chapasPendientes, setChapasPendientes] = useState<ChapaReservaPendiente[]>([]);
  const [reemplazoOpen, setReemplazoOpen] = useState(false);
  const [presCabecera, setPresCabecera] = useState<{
    numero: string;
    cliente: string;
    clientId: string | null;
    total: number;
    moneda: "ars" | "usd";
  } | null>(null);

  const cargar = useCallback(async (pid: string) => {
    setBusy(true);
    setPresCabecera(null);
    setOtsCount(0);

    if (isSupabaseConfigured) {
      const presRes = await supabase
        .from("presupuestos")
        .select("numero, cliente, total, moneda, client_id")
        .eq("id", pid)
        .maybeSingle();
      if (!presRes.error && presRes.data) {
        const monedaPres = presRes.data.moneda === "usd" ? "usd" : "ars";
        setPresCabecera({
          numero: presRes.data.numero ?? "—",
          cliente: (presRes.data.cliente ?? "").trim(),
          clientId: typeof presRes.data.client_id === "string" ? presRes.data.client_id : null,
          total: Number(presRes.data.total ?? 0),
          moneda: monedaPres,
        });
      } else {
        setPresCabecera(null);
      }
    }

    const vt = await getVentaPorPresupuesto(pid);
    if (vt.error || !vt.data) {
      setVentaCabecera(null);
      setPagosVentas([]);
      setOtsCount(0);
      setOtEtapa(rowResumen?.ot_etapa ?? null);
      setOtEstado(rowResumen?.ot_estado ?? null);
      setBusy(false);
      return;
    }
    const lp = await listPagosVenta(vt.data.id);
    setVentaCabecera({ id: vt.data.id, estado: vt.data.estado as VentaEstado });
    setPagosVentas(lp.error ? [] : lp.data ?? []);

    if (isSupabaseConfigured) {
      const otFind = await supabase
        .from("ordenes_trabajo")
        .select("id, etapa, estado")
        .eq("venta_id", vt.data.id)
        .neq("estado", "cancelled");
      const otRows = otFind.error ? [] : otFind.data ?? [];
      setOtsCount(otRows.length);
      const otRow = otRows[0];
      if (otRow) {
        setOtEtapa(typeof otRow.etapa === "string" ? otRow.etapa : null);
        setOtEstado((otRow.estado as JobStatus) ?? null);
      } else {
        setOtEtapa(rowResumen?.ot_etapa ?? null);
        setOtEstado(rowResumen?.ot_estado ?? null);
      }
    } else {
      setOtsCount(rowResumen?.orden_trabajo_id ? 1 : 0);
      setOtEtapa(rowResumen?.ot_etapa ?? null);
      setOtEstado(rowResumen?.ot_estado ?? null);
    }
    setBusy(false);
  }, [rowResumen?.orden_trabajo_id, rowResumen?.ot_etapa, rowResumen?.ot_estado]);

  useEffect(() => {
    if (!open || !presupuestoId) return;
    const hoy = new Date().toISOString().slice(0, 10);
    setPagoFecha(hoy);
    setPagoNota("");
    setComprobante(null);
    setOtEtapa(rowResumen?.ot_etapa ?? null);
    setOtEstado(rowResumen?.ot_estado ?? null);
    void cargar(presupuestoId);
  }, [open, presupuestoId, rowResumen?.ot_etapa, rowResumen?.ot_estado, cargar]);

  useEffect(() => {
    if (!formPagoOpen) return;
    const previous = document.body.style.pointerEvents;
    document.body.style.pointerEvents = "auto";
    return () => {
      document.body.style.pointerEvents = previous;
    };
  }, [formPagoOpen]);

  const moneda: "ars" | "usd" = presCabecera?.moneda ?? rowResumen?.moneda ?? "ars";
  const total = presCabecera?.total ?? rowResumen?.total ?? 0;

  const cobrado = useMemo(() => {
    let sum = 0;
    for (const p of pagosVentas) {
      if (p.moneda !== moneda) continue;
      sum += montoPagoNum(p);
    }
    return sum;
  }, [pagosVentas, moneda]);

  const saldo = Math.max(0, total - cobrado);
  const pagado = saldo <= 0.009;

  const etapaLabel = etiquetaEtapaOt(
    otEtapa,
    ventaCabecera?.estado === "entregado" ? "done" : otEstado,
  );

  const cliente =
    presCabecera?.cliente?.trim() || rowResumen?.cliente?.trim() || "Sin cliente";
  const numero = presCabecera?.numero ?? rowResumen?.numero ?? "—";
  const clientId = presCabecera?.clientId ?? null;

  const deudasOrdenadas = useMemo(() => {
    return [...deudasCliente].sort((a, b) => {
      if (a.presupuestoId === presupuestoId) return -1;
      if (b.presupuestoId === presupuestoId) return 1;
      return a.numero.localeCompare(b.numero, "es");
    });
  }, [deudasCliente, presupuestoId]);
  const mostrarDeudas = deudasOrdenadas.length > 1;

  const totalFormas = useMemo(
    () =>
      totalPorMoneda(
        formasPago.map((f) => ({ moneda: f.moneda, monto: parseMontoCampo(f.monto) ?? 0 })),
      ),
    [formasPago],
  );
  const totalAsignado = useMemo(
    () =>
      totalPorMoneda(
        deudasOrdenadas.map((d) => ({
          moneda: d.moneda,
          monto: parseMontoCampo(asignadoPorId[d.presupuestoId] ?? "") ?? 0,
        })),
      ),
    [deudasOrdenadas, asignadoPorId],
  );
  const hayEntrada = totalFormas.usd > 0 || totalFormas.ars > 0;
  const deudasRepartidas =
    !mostrarDeudas ||
    (hayEntrada &&
      totalFormas.usd === totalAsignado.usd &&
      totalFormas.ars === totalAsignado.ars);

  useEffect(() => {
    if (!formPagoOpen) return;
    let cancelado = false;
    void (async () => {
      const [cuentasRes, deudasRes] = await Promise.all([
        listCuentasActivas(),
        listDeudasCliente({ clientId, clienteNombre: cliente }),
      ]);
      if (cancelado) return;
      if (cuentasRes.error) toast.error(cuentasRes.error.message);
      if (deudasRes.error) toast.error(deudasRes.error.message);
      const cuentas = cuentasRes.data ?? [];
      setCuentasPago(cuentas);
      const list = [...(deudasRes.data ?? [])];
      if (
        presupuestoId &&
        !list.some((d) => d.presupuestoId === presupuestoId) &&
        saldo > 0.009
      ) {
        list.unshift({
          presupuestoId,
          numero,
          cliente,
          moneda,
          total,
          saldo,
          titulo: null,
        });
      }
      setDeudasCliente(list);
      setAsignadoPorId({});
      setConceptoPago("trabajo");
      setFormasPago([nuevaFormaPago(moneda, cuentas)]);
    })();
    return () => {
      cancelado = true;
    };
  }, [formPagoOpen, clientId, cliente, moneda, presupuestoId, numero, saldo, total]);

  function patchForma(key: string, patch: Partial<FormaPagoUi>) {
    setFormasPago((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f;
        const next = { ...f, ...patch };
        if (patch.metodo != null || patch.moneda != null) {
          next.cuentaId = sugerirCuentaPorMetodo(next.metodo, next.moneda, cuentasPago) ?? next.cuentaId;
        }
        return next;
      }),
    );
  }

  const onRegistrarPago = useCallback(async () => {
    if (!presupuestoId || pagoBusy || pagado) return;
    try {
      if (comprobante) {
        const fileErr = validateFinanzasComprobanteFile(comprobante);
        if (fileErr) {
          toast.error(fileErr);
          return;
        }
      }

      const formas = formasPago.map((f) => ({
        metodo: f.metodo,
        moneda: f.moneda,
        monto: parseMontoCampo(f.monto) ?? 0,
        cuentaId: f.cuentaId || null,
      }));
      const deudas = deudasOrdenadas.map((d) => ({
        presupuestoId: d.presupuestoId,
        moneda: d.moneda,
        saldo: d.saldo,
        asignado: parseMontoCampo(asignadoPorId[d.presupuestoId] ?? "") ?? 0,
      }));
      const partido = validarYPartirPago({
        formas,
        deudas,
        destinoUnicoId: mostrarDeudas ? undefined : presupuestoId,
      });
      if (!partido.ok) {
        toast.error(partido.error);
        return;
      }

      setPagoBusy(true);
      const pendientes: ChapaReservaPendiente[] = [];
      const presupuestosTocados = new Set<string>();
      for (let i = 0; i < partido.tramos.length; i += 1) {
        const t = partido.tramos[i];
        const res = await registrarPagoSena({
          presupuestoId: t.presupuestoId,
          monto: t.monto,
          moneda: t.moneda,
          fecha: pagoFecha,
          metodo: t.metodo,
          nota: pagoNota.trim() ? pagoNota.trim() : undefined,
          cuenta_id: t.cuentaId,
          created_by: null,
          concepto: conceptoPago,
          comprobante: i === 0 ? comprobante : null,
        });
        if (res.error) {
          toast.error(res.error.message);
          return;
        }
        presupuestosTocados.add(t.presupuestoId);
        if (res.chapasPendientes?.length) pendientes.push(...res.chapasPendientes);
      }

      if (pendientes.length > 0) {
        toast.warning("Algunas chapas señaladas ya no están disponibles. Elegí reemplazo.");
        setChapasPendientes(pendientes);
        setReemplazoOpen(true);
      } else {
        toast.success(partido.tramos.length > 1 ? "Pagos registrados." : "Pago registrado.");
      }
      for (const pid of presupuestosTocados) {
        const envio = await enviarAProduccionSiCorresponde(pid);
        if (envio.error) toast.error(envio.error.message);
        else if (envio.enviado) toast.success("Ya tenía medidas: pasó a producción.");
      }
      setPagoNota("");
      setComprobante(null);
      if (comprobanteInputRef.current) comprobanteInputRef.current.value = "";
      setFormPagoOpen(false);
      await cargar(presupuestoId);
      await onDatosCambiaron();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el pago.");
    } finally {
      setPagoBusy(false);
    }
  }, [
    presupuestoId,
    pagoBusy,
    pagado,
    comprobante,
    formasPago,
    deudasOrdenadas,
    asignadoPorId,
    mostrarDeudas,
    pagoFecha,
    pagoNota,
    conceptoPago,
    cargar,
    onDatosCambiaron,
  ]);

  const abrirComprobante = useCallback(
    (descargar: boolean) => {
      if (!presupuestoId) {
        toast.error("No hay presupuesto para generar el comprobante.");
        return;
      }
      const qs = descargar ? "?descargar=1" : "";
      navigate(`/presupuestos/${presupuestoId}/cobros/imprimir${qs}`);
    },
    [navigate, presupuestoId],
  );

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => {
          if (!o) setFormPagoOpen(false);
          onOpenChange(o);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden bg-stone-50 p-0 sm:max-w-xl lg:max-w-2xl"
          onInteractOutside={(e) => {
            if (formPagoOpen) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (formPagoOpen) e.preventDefault();
          }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Cobros de la venta</SheetTitle>
            <SheetDescription>Saldo, pagos y comprobantes de la venta.</SheetDescription>
          </SheetHeader>
          <div className="shrink-0 space-y-3 border-b border-border px-6 py-4 pr-12 text-left">
            <div className="inline-flex items-center rounded-full border border-border bg-background p-0.5 text-xs font-medium">
              <span className="rounded-full px-3 py-1 text-muted-foreground">
                Presupuesto{" "}
                <span className="font-semibold text-foreground">{numero}</span>
              </span>
              <span className="rounded-full bg-foreground px-3 py-1 text-background">
                OTs {otsCount}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-lg font-semibold tracking-tight text-foreground">
                  {cliente}
                </p>
                <p className="text-sm text-muted-foreground">{etapaLabel}</p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  disabled={!presupuestoId || busy}
                  onClick={() => abrirComprobante(false)}
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden />
                  Imprimir
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  disabled={!presupuestoId || busy}
                  onClick={() => abrirComprobante(true)}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  PDF
                </Button>
              </div>
            </div>
          </div>

          {busy ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Saldo — compacto, siempre visible */}
              <div className="shrink-0 px-6 pt-4">
                <div className="grid grid-cols-3 overflow-hidden rounded-xl bg-foreground text-background">
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-background/60">
                      Total
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
                      {formatMonto(total, moneda)}
                    </p>
                  </div>
                  <div className="border-l border-background/15 px-4 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-background/60">
                      Cobrado
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
                      {formatMonto(cobrado, moneda)}
                    </p>
                  </div>
                  <div className="border-l border-background/15 px-4 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-background/60">
                      {saldo <= 0.009 ? "Saldo" : "Pendiente"}
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
                      {saldo <= 0.009 ? "Pagado" : formatMonto(saldo, moneda)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Historial de pagos — scrollea si hay muchos */}
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pagos ({pagosVentas.length})
                </h3>
                {pagosVentas.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                    Sin pagos registrados.
                  </p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {pagosVentas.map((p) => {
                      const val = montoPagoNum(p);
                      const ret = retencionPagoNum(p);
                      const monedaPago = p.moneda === "usd" ? "usd" : "ars";
                      return (
                        <li key={p.id} className="flex items-center gap-3 px-3.5 py-2.5">
                          <p className="w-28 shrink-0 text-sm font-semibold tabular-nums text-foreground">
                            {formatMonto(val, monedaPago)}
                          </p>
                          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {formatoFechaCortaDb(p.fecha)}
                            {p.nota ? ` · ${p.nota}` : ""}
                            {ret > 0
                              ? ` · retención ${formatMonto(ret, monedaPago)} · neto ${formatMonto(val - ret, monedaPago)}`
                              : ""}
                          </p>
                          <p className="shrink-0 text-xs font-medium text-muted-foreground">
                            {etiquetaMetodo(p.metodo)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="shrink-0 border-t border-border bg-card px-6 py-4">
                <Button
                  type="button"
                  className="w-full"
                  disabled={pagado}
                  onClick={() => setFormPagoOpen(true)}
                >
                  <Plus className="mr-1 h-4 w-4" aria-hidden />
                  Registrar pago
                </Button>
                {pagado ? (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Total cubierto
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={formPagoOpen}
        onOpenChange={(o) => {
          setFormPagoOpen(o);
          if (!o) {
            setPagoNota("");
            setComprobante(null);
            if (comprobanteInputRef.current) comprobanteInputRef.current.value = "";
            setFormasPago([]);
            setDeudasCliente([]);
            setAsignadoPorId({});
            setNotaOpen(false);
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12 text-left">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                  Ingreso · entra plata
                </p>
                <DialogTitle className="mt-0.5">Registrar pago</DialogTitle>
                <DialogDescription>
                  {numero}
                  {saldo > 0.009 ? ` · pendiente ${formatMonto(saldo, moneda)}` : ""}
                </DialogDescription>
              </div>
              <div className="w-[9.5rem] shrink-0">
                <Label htmlFor="vc-fecha" className="sr-only">
                  Fecha
                </Label>
                <FechaInput
                  id="vc-fecha"
                  value={pagoFecha}
                  onChange={setPagoFecha}
                  disabled={pagado}
                />
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="space-y-1.5">
                <Label htmlFor="vc-cliente">Cliente</Label>
                <Input id="vc-cliente" value={cliente} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Concepto</Label>
                <Select
                  value={conceptoPago}
                  onValueChange={(v) => setConceptoPago(v as ConceptoIngreso)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Concepto…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONCEPTOS_INGRESO.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <section className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  1 · Cómo pagó
                </p>
                <p className="text-xs text-muted-foreground">
                  una fila por forma de pago — el total se suma solo
                </p>
              </div>
              <div className="space-y-2">
                {formasPago.map((f) => {
                  const cuentasFiltradas = cuentasPago.filter((c) => c.moneda === f.moneda);
                  return (
                    <div
                      key={f.key}
                      className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-muted/15 px-3 py-3"
                    >
                      <div className="min-w-[9rem] flex-1 space-y-1">
                        <Label className="text-[11px]">Forma</Label>
                        <Select
                          value={f.metodo}
                          onValueChange={(v) => patchForma(f.key, { metodo: v })}
                          disabled={pagado}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {METODOS_COBRO_UI.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Moneda</Label>
                        <div className="inline-flex h-9 items-center rounded-full bg-muted p-0.5">
                          {(["ars", "usd"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              className={cn(
                                "h-8 min-w-12 rounded-full px-2.5 text-xs font-semibold uppercase tracking-wide",
                                f.moneda === m
                                  ? "bg-accent text-accent-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                              disabled={pagado}
                              onClick={() => patchForma(f.key, { moneda: m })}
                            >
                              {m.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="w-28 space-y-1">
                        <Label className="text-[11px]">Cuánto</Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            $
                          </span>
                          <Input
                            className="h-9 pl-6"
                            type="number"
                            min={0}
                            step="any"
                            value={f.monto}
                            onChange={(e) => patchForma(f.key, { monto: e.target.value })}
                            placeholder="0"
                            disabled={pagado}
                          />
                        </div>
                      </div>
                      <div className="min-w-[8.5rem] flex-1 space-y-1">
                        <Label className="text-[11px]">Entra en</Label>
                        <Select
                          value={f.cuentaId || "__none__"}
                          onValueChange={(v) =>
                            patchForma(f.key, { cuentaId: v === "__none__" ? "" : v })
                          }
                          disabled={pagado}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Cuenta…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Automática</SelectItem>
                            {cuentasFiltradas.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        disabled={pagado || formasPago.length <= 1}
                        onClick={() =>
                          setFormasPago((prev) => prev.filter((x) => x.key !== f.key))
                        }
                        aria-label="Quitar forma de pago"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={pagado}
                  onClick={() => setFormasPago((prev) => [...prev, nuevaFormaPago(moneda, cuentasPago)])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Agregar forma de pago
                </Button>
                <p className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium tabular-nums">
                  Total que entra {formatTotalesEntra(totalFormas, moneda)}
                </p>
              </div>
            </section>

            {deudasOrdenadas.length > 0 ? (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    2 · A qué deuda va
                  </p>
                  {mostrarDeudas ? (
                    <p
                      className={cn(
                        "inline-flex items-center gap-1 text-xs tabular-nums",
                        deudasRepartidas ? "text-emerald-700" : "text-muted-foreground",
                      )}
                    >
                      {deudasRepartidas ? (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      ) : null}
                      {deudasRepartidas ? "todo repartido" : "repartí el total entre las deudas"}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">va a esta venta</p>
                  )}
                </div>
                <ul className="divide-y divide-border rounded-2xl border border-border bg-background">
                  {deudasOrdenadas.map((d) => {
                    const esActual = d.presupuestoId === presupuestoId;
                    const asignado = parseMontoCampo(asignadoPorId[d.presupuestoId] ?? "") ?? 0;
                    const marcado = asignado > 0.005 || (!mostrarDeudas && esActual);
                    const asignadoOtras = deudasOrdenadas
                      .filter((x) => x.presupuestoId !== d.presupuestoId && x.moneda === d.moneda)
                      .reduce(
                        (acc, x) => acc + (parseMontoCampo(asignadoPorId[x.presupuestoId] ?? "") ?? 0),
                        0,
                      );
                    const aplicarCancelarTodo = () => {
                      const cubre = montoCancelarTodo({
                        saldo: d.saldo,
                        moneda: d.moneda,
                        totalFormas: d.moneda === "usd" ? totalFormas.usd : totalFormas.ars,
                        asignadoOtras,
                      });
                      setAsignadoPorId((prev) => ({
                        ...prev,
                        [d.presupuestoId]: cubre > 0 ? String(cubre) : "",
                      }));
                    };
                    return (
                      <li
                        key={d.presupuestoId}
                        className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap"
                      >
                        <Checkbox
                          checked={marcado}
                          disabled={pagado || (!mostrarDeudas && esActual)}
                          onCheckedChange={(v) => {
                            if (v === true) aplicarCancelarTodo();
                            else {
                              setAsignadoPorId((prev) => ({
                                ...prev,
                                [d.presupuestoId]: "",
                              }));
                            }
                          }}
                          aria-label={`Incluir ${d.numero}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {d.numero}
                            {d.titulo ? ` · ${d.titulo}` : ""}
                            {esActual ? (
                              <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-accent">
                                Esta venta
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            de {formatMonto(d.saldo, d.moneda)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0"
                          disabled={pagado}
                          onClick={aplicarCancelarTodo}
                        >
                          Cancelar todo
                        </Button>
                        <Input
                          className="h-9 w-28 shrink-0"
                          type="number"
                          min={0}
                          step="any"
                          value={asignadoPorId[d.presupuestoId] ?? ""}
                          onChange={(e) =>
                            setAsignadoPorId((prev) => ({
                              ...prev,
                              [d.presupuestoId]: e.target.value,
                            }))
                          }
                          placeholder="0"
                          disabled={pagado}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 flex-col gap-3 border-t border-border px-6 py-3 sm:flex-col">
            {notaOpen ? (
              <Input
                id="vc-nota"
                value={pagoNota}
                onChange={(e) => setPagoNota(e.target.value)}
                placeholder="Referencia, n° de transferencia…"
                disabled={pagado}
                autoFocus
              />
            ) : null}
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground"
                  disabled={pagado}
                  onClick={() => setNotaOpen((v) => !v)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Nota
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 max-w-[14rem] px-2 text-muted-foreground"
                  disabled={pagado}
                  onClick={() => comprobanteInputRef.current?.click()}
                >
                  <Paperclip className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{comprobante?.name ?? "Comprobante"}</span>
                </Button>
                {comprobante ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={pagado}
                    onClick={() => {
                      setComprobante(null);
                      if (comprobanteInputRef.current) comprobanteInputRef.current.value = "";
                    }}
                    aria-label="Quitar comprobante"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
                <input
                  id="vc-comp"
                  ref={comprobanteInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={pagado}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f) {
                      const err = validateFinanzasComprobanteFile(f);
                      if (err) {
                        toast.error(err);
                        e.target.value = "";
                        setComprobante(null);
                        return;
                      }
                    }
                    setComprobante(f);
                  }}
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormPagoOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={pagoBusy || pagado}
                  onClick={() => void onRegistrarPago()}
                >
                  <Check className="mr-1 h-4 w-4" aria-hidden />
                  Registrar pago
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ElegirChapaReemplazoDialog
        open={reemplazoOpen}
        onOpenChange={(o) => {
          setReemplazoOpen(o);
          if (!o) setChapasPendientes([]);
        }}
        pendientes={chapasPendientes}
        onResuelto={async () => {
          setChapasPendientes([]);
          if (presupuestoId) await cargar(presupuestoId);
          await onDatosCambiaron();
        }}
      />
    </>
  );
}
