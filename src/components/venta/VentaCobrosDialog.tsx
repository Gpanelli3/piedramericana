"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, Download, Plus, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Database, JobStatus, VentaEstado } from "@/types/database";
import {
  getVentaPorPresupuesto,
  listPagosVenta,
  marcarVentaEntregado,
  registrarPagoSena,
  type ChapaReservaPendiente,
} from "@/lib/ventas-api";
import { METODOS_COBRO_UI, etiquetaMetodo } from "@/lib/finanzas-api";
import type { PresupuestoRowList } from "@/lib/presupuestos-api";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  listChapasUsadasPorOt,
  type ChapaInventarioRow,
} from "@/lib/stock-ot-api";
import { ElegirChapaReemplazoDialog } from "@/components/presupuesto/ElegirChapaReemplazoDialog";
import { etiquetaEtapaOt } from "@/lib/etiquetas-ot";

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

type BadgeCobro = { label: string; className: string };

function badgeCobro(cobrado: number, saldo: number): BadgeCobro {
  if (cobrado <= 0.009) {
    return {
      label: "Sin seña",
      className: "border-border bg-muted text-muted-foreground",
    };
  }
  if (saldo <= 0.009) {
    return {
      label: "Al día",
      className: "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
    };
  }
  return {
    label: "Con anticipo",
    className: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presupuestoId: string | null;
  rowResumen: PresupuestoRowList | null;
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
  const [montoDigitado, setMontoDigitado] = useState("");
  const [pagoMoneda, setPagoMoneda] = useState<"ars" | "usd">("ars");
  const [pagoMetodo, setPagoMetodo] = useState("transferencia");
  const [pagoFecha, setPagoFecha] = useState("");
  const [pagoNota, setPagoNota] = useState("");
  const [formOpen, setFormOpen] = useState(true);
  const [placasOt, setPlacasOt] = useState<ChapaInventarioRow[]>([]);
  const [otEtapa, setOtEtapa] = useState<string | null>(null);
  const [otEstado, setOtEstado] = useState<JobStatus | null>(null);
  const [chapasPendientes, setChapasPendientes] = useState<ChapaReservaPendiente[]>([]);
  const [reemplazoOpen, setReemplazoOpen] = useState(false);

  const cargar = useCallback(async (pid: string) => {
    setBusy(true);
    const vt = await getVentaPorPresupuesto(pid);
    if (vt.error || !vt.data) {
      setVentaCabecera(null);
      setPagosVentas([]);
      setPlacasOt([]);
      setOtEtapa(null);
      setOtEstado(null);
      setBusy(false);
      return;
    }
    const lp = await listPagosVenta(vt.data.id);
    setVentaCabecera({ id: vt.data.id, estado: vt.data.estado as VentaEstado });
    setPagosVentas(lp.error ? [] : lp.data ?? []);

    const otId = rowResumen?.orden_trabajo_id;
    if (otId && isSupabaseConfigured) {
      const [ch, otRes] = await Promise.all([
        listChapasUsadasPorOt(otId),
        supabase.from("ordenes_trabajo").select("etapa,estado").eq("id", otId).maybeSingle(),
      ]);
      setPlacasOt(ch.error ? [] : ch.data);
      if (!otRes.error && otRes.data) {
        setOtEtapa(typeof otRes.data.etapa === "string" ? otRes.data.etapa : null);
        setOtEstado((otRes.data.estado as JobStatus) ?? null);
      } else {
        setOtEtapa(rowResumen?.ot_etapa ?? null);
        setOtEstado(rowResumen?.ot_estado ?? null);
      }
    } else {
      setPlacasOt([]);
      setOtEtapa(rowResumen?.ot_etapa ?? null);
      setOtEstado(rowResumen?.ot_estado ?? null);
    }
    setBusy(false);
  }, [rowResumen?.orden_trabajo_id, rowResumen?.ot_etapa, rowResumen?.ot_estado]);

  useEffect(() => {
    if (!open || !presupuestoId) return;
    const hoy = new Date().toISOString().slice(0, 10);
    setPagoFecha(hoy);
    setPagoMetodo("transferencia");
    setMontoDigitado("");
    setPagoNota("");
    setFormOpen(true);
    if (rowResumen?.moneda) setPagoMoneda(rowResumen.moneda);
    setOtEtapa(rowResumen?.ot_etapa ?? null);
    setOtEstado(rowResumen?.ot_estado ?? null);
    void cargar(presupuestoId);
  }, [open, presupuestoId, rowResumen?.moneda, rowResumen?.ot_etapa, rowResumen?.ot_estado, cargar]);

  const moneda: "ars" | "usd" = rowResumen?.moneda ?? "usd";
  const total = rowResumen?.total ?? 0;

  const cobrado = useMemo(() => {
    let sum = 0;
    for (const p of pagosVentas) {
      if (p.moneda !== moneda) continue;
      sum += montoPagoNum(p);
    }
    return sum;
  }, [pagosVentas, moneda]);

  const saldo = Math.max(0, total - cobrado);
  const cobroBadge = badgeCobro(cobrado, saldo);

  const etapaLabel =
    ventaCabecera?.estado === "entregado"
      ? "Entregada"
      : etiquetaEtapaOt(otEtapa, otEstado);

  const onRegistrarPago = useCallback(async () => {
    if (!presupuestoId || pagoBusy) return;
    try {
      const n = Number(String(montoDigitado).replace(",", ".").trim());
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("Ingresá un monto válido para registrar el pago.");
        return;
      }
      if (!pagoMetodo.trim()) {
        toast.error("Indicá cómo se paga: efectivo, transferencia, cheque o tarjeta.");
        return;
      }

      setPagoBusy(true);
      const res = await registrarPagoSena({
        presupuestoId,
        monto: n,
        moneda: pagoMoneda,
        fecha: pagoFecha,
        metodo: pagoMetodo,
        nota: pagoNota.trim() ? pagoNota.trim() : undefined,
        created_by: null,
      });
      if (res.error) {
        toast.error(res.error.message);
        return;
      }

      if (res.chapasPendientes && res.chapasPendientes.length > 0) {
        toast.warning("Algunas chapas señaladas ya no están disponibles. Elegí reemplazo.");
        setChapasPendientes(res.chapasPendientes);
        setReemplazoOpen(true);
      } else {
        toast.success("Pago registrado.");
      }
      setMontoDigitado("");
      setPagoNota("");
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
    montoDigitado,
    pagoMoneda,
    pagoFecha,
    pagoMetodo,
    pagoNota,
    cargar,
    onDatosCambiaron,
  ]);

  const onMarcarEntregado = useCallback(async () => {
    if (!ventaCabecera?.id || pagoBusy || !presupuestoId) return;
    setPagoBusy(true);
    const res = await marcarVentaEntregado(ventaCabecera.id);
    setPagoBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Venta marcada como entregada.");
    await cargar(presupuestoId);
    await onDatosCambiaron();
  }, [ventaCabecera, pagoBusy, presupuestoId, cargar, onDatosCambiaron]);

  const estado = ventaCabecera?.estado;
  const cliente = rowResumen?.cliente?.trim() || "Sin cliente";
  const numero = rowResumen?.numero ?? "—";

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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg max-h-[90vh]">
          <DialogHeader className="space-y-3 border-b border-border px-6 pb-4 pt-6 pr-12 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                {cliente}
              </DialogTitle>
              <Badge variant="outline" className={cn("font-medium", cobroBadge.className)}>
                {cobroBadge.label}
              </Badge>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{numero}</span>
              {" · "}
              {etapaLabel}
            </DialogDescription>
            <div className="flex flex-wrap gap-2 pt-1">
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
                Descargar PDF
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-[calc(90vh-7rem)] space-y-5 overflow-y-auto px-6 py-5">
            {busy ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
            ) : (
              <>
                <div className="rounded-xl bg-foreground px-5 py-4 text-background shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-background/70">
                    {saldo <= 0.009 ? "Saldo" : "Saldo pendiente"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                    {saldo <= 0.009 ? "Al día" : formatMonto(saldo, moneda)}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-background/20 pt-3 text-xs tabular-nums text-background/80">
                    <span>Total {formatMonto(total, moneda)}</span>
                    <span>Cobrado {formatMonto(cobrado, moneda)}</span>
                  </div>
                </div>

                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Pagos ({pagosVentas.length})
                  </h3>
                  {pagosVentas.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      Sin pagos registrados.
                    </p>
                  ) : (
                    <ul className="max-h-52 space-y-2 overflow-y-auto pr-0.5">
                      {pagosVentas.map((p) => {
                        const val = montoPagoNum(p);
                        return (
                          <li
                            key={p.id}
                            className="rounded-lg border border-border bg-card px-3.5 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-0.5">
                                <p className="text-sm font-semibold tabular-nums text-foreground">
                                  {formatMonto(val, p.moneda === "usd" ? "usd" : "ars")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatoFechaCortaDb(p.fecha)}
                                </p>
                              </div>
                              <p className="shrink-0 text-xs font-medium text-muted-foreground">
                                {etiquetaMetodo(p.metodo)}
                              </p>
                            </div>
                            {p.nota ? (
                              <p className="mt-2 text-xs text-muted-foreground">{p.nota}</p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <Collapsible open={formOpen} onOpenChange={setFormOpen}>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 bg-muted/40 px-4 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Plus className="h-4 w-4 opacity-70" aria-hidden />
                          Registrar pago
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            formOpen && "rotate-180",
                          )}
                          aria-hidden
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-3 border-t border-border px-4 py-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="vc-monto">Monto</Label>
                            <Input
                              id="vc-monto"
                              type="number"
                              min={0}
                              step="any"
                              value={montoDigitado}
                              onChange={(e) => setMontoDigitado(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="vc-fecha">Fecha</Label>
                            <Input
                              id="vc-fecha"
                              type="date"
                              value={pagoFecha}
                              onChange={(e) => setPagoFecha(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Moneda</Label>
                            <Select
                              value={pagoMoneda}
                              onValueChange={(v) => setPagoMoneda(v as "ars" | "usd")}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ars">ARS</SelectItem>
                                <SelectItem value="usd">USD</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Cómo se paga</Label>
                            <Select value={pagoMetodo} onValueChange={setPagoMetodo}>
                              <SelectTrigger>
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
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="vc-nota">Nota (opcional)</Label>
                          <Textarea
                            id="vc-nota"
                            rows={2}
                            value={pagoNota}
                            onChange={(e) => setPagoNota(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-2 pt-1">
                          <Button
                            type="button"
                            className="w-full"
                            disabled={pagoBusy}
                            onClick={() => void onRegistrarPago()}
                          >
                            <Plus className="mr-1 h-4 w-4" aria-hidden />
                            Registrar pago
                          </Button>
                          {estado === "finalizado" ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              disabled={pagoBusy}
                              onClick={() => void onMarcarEntregado()}
                            >
                              Marcar entregado
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {placasOt.length > 0 ? (
                  <section className="space-y-2 border-t border-border pt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Placas en OT
                    </h3>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {placasOt.map((c) => (
                        <li key={c.id} className="rounded-md bg-muted/40 px-3 py-2">
                          <span className="font-medium text-foreground">{c.bulto}</span>
                          {" · "}
                          {c.material_label}
                          {c.lote_codigo ? ` · lote ${c.lote_codigo}` : ""}
                          {" · "}
                          {c.estado}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            )}
          </div>
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
