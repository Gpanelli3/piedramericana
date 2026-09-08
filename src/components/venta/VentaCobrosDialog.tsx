"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Download, Plus, Printer } from "lucide-react";
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
  listPagosVenta,
  registrarPagoSena,
  type ChapaReservaPendiente,
} from "@/lib/ventas-api";
import { METODOS_COBRO_UI, etiquetaMetodo } from "@/lib/finanzas-api";
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
      label: "Pagado",
      className: "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
    };
  }
  return {
    label: "Con anticipo",
    className: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
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
  const [montoDigitado, setMontoDigitado] = useState("");
  const [pagoMoneda, setPagoMoneda] = useState<"ars" | "usd">("ars");
  const [pagoMetodo, setPagoMetodo] = useState("transferencia");
  const [pagoFecha, setPagoFecha] = useState("");
  const [pagoNota, setPagoNota] = useState("");
  const [placasOt, setPlacasOt] = useState<ChapaInventarioRow[]>([]);
  const [otEtapa, setOtEtapa] = useState<string | null>(null);
  const [otEstado, setOtEstado] = useState<JobStatus | null>(null);
  const [chapasPendientes, setChapasPendientes] = useState<ChapaReservaPendiente[]>([]);
  const [reemplazoOpen, setReemplazoOpen] = useState(false);
  const [presCabecera, setPresCabecera] = useState<{
    numero: string;
    cliente: string;
    total: number;
    moneda: "ars" | "usd";
  } | null>(null);

  const cargar = useCallback(async (pid: string) => {
    setBusy(true);
    setPresCabecera(null);

    if (isSupabaseConfigured) {
      const presRes = await supabase
        .from("presupuestos")
        .select("numero, cliente, total, moneda")
        .eq("id", pid)
        .maybeSingle();
      if (!presRes.error && presRes.data) {
        const monedaPres = presRes.data.moneda === "usd" ? "usd" : "ars";
        setPresCabecera({
          numero: presRes.data.numero ?? "—",
          cliente: (presRes.data.cliente ?? "").trim(),
          total: Number(presRes.data.total ?? 0),
          moneda: monedaPres,
        });
        setPagoMoneda(monedaPres);
      } else {
        setPresCabecera(null);
      }
    }

    const vt = await getVentaPorPresupuesto(pid);
    if (vt.error || !vt.data) {
      setVentaCabecera(null);
      setPagosVentas([]);
      setPlacasOt([]);
      setOtEtapa(rowResumen?.ot_etapa ?? null);
      setOtEstado(rowResumen?.ot_estado ?? null);
      setBusy(false);
      return;
    }
    const lp = await listPagosVenta(vt.data.id);
    setVentaCabecera({ id: vt.data.id, estado: vt.data.estado as VentaEstado });
    setPagosVentas(lp.error ? [] : lp.data ?? []);

    let otId = rowResumen?.orden_trabajo_id ?? null;
    if (!otId && isSupabaseConfigured) {
      const otFind = await supabase
        .from("ordenes_trabajo")
        .select("id, etapa, estado")
        .eq("venta_id", vt.data.id)
        .limit(1);
      const otRow = otFind.data?.[0];
      if (otRow) otId = otRow.id;
    }

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
    if (rowResumen?.moneda) setPagoMoneda(rowResumen.moneda);
    setOtEtapa(rowResumen?.ot_etapa ?? null);
    setOtEstado(rowResumen?.ot_estado ?? null);
    void cargar(presupuestoId);
  }, [open, presupuestoId, rowResumen?.moneda, rowResumen?.ot_etapa, rowResumen?.ot_estado, cargar]);

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
  const cobroBadge = badgeCobro(cobrado, saldo);

  const etapaLabel = etiquetaEtapaOt(
    otEtapa,
    ventaCabecera?.estado === "entregado" ? "done" : otEstado,
  );

  const onRegistrarPago = useCallback(async () => {
    if (!presupuestoId || pagoBusy || pagado) return;
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
    pagado,
    montoDigitado,
    pagoMoneda,
    pagoFecha,
    pagoMetodo,
    pagoNota,
    cargar,
    onDatosCambiaron,
  ]);

  const cliente =
    presCabecera?.cliente?.trim() || rowResumen?.cliente?.trim() || "Sin cliente";
  const numero = presCabecera?.numero ?? rowResumen?.numero ?? "—";

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
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
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
          </DialogHeader>

          {busy ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Saldo — compacto, siempre visible */}
              <div className="shrink-0 px-6 pt-4">
                <div className="grid grid-cols-3 overflow-hidden rounded-xl bg-foreground text-background">
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-background/60">
                      {saldo <= 0.009 ? "Saldo" : "Pendiente"}
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
                      {saldo <= 0.009 ? "Pagado" : formatMonto(saldo, moneda)}
                    </p>
                  </div>
                  <div className="border-l border-background/15 px-4 py-3">
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
                </div>
              </div>

              {/* Formulario de pago — arriba, sin scrollear */}
              <div className="shrink-0 px-6 pt-3 pb-4">
                <div
                  className={cn(
                    "rounded-xl border p-4",
                    pagado
                      ? "border-border bg-muted/40"
                      : "border-accent/20 bg-accent/[0.08]",
                  )}
                >
                  <p
                    className={cn(
                      "mb-3 text-xs font-semibold uppercase tracking-wider",
                      pagado
                        ? "text-muted-foreground"
                        : "text-accent-foreground/75",
                    )}
                  >
                    Registrar pago
                    {pagado ? " · Total cubierto" : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1.4fr)_7.5rem_minmax(0,1.3fr)_minmax(0,1.1fr)]">
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
                        disabled={pagado}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Moneda</Label>
                      <Select
                        value={pagoMoneda}
                        onValueChange={(v) => setPagoMoneda(v as "ars" | "usd")}
                        disabled={pagado}
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
                      <Select
                        value={pagoMetodo}
                        onValueChange={setPagoMetodo}
                        disabled={pagado}
                      >
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
                    <div className="space-y-1.5">
                      <Label htmlFor="vc-fecha">Fecha</Label>
                      <FechaInput
                        id="vc-fecha"
                        value={pagoFecha}
                        onChange={setPagoFecha}
                        disabled={pagado}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label htmlFor="vc-nota">Nota (opcional)</Label>
                      <Input
                        id="vc-nota"
                        value={pagoNota}
                        onChange={(e) => setPagoNota(e.target.value)}
                        placeholder="Referencia, n° de transferencia…"
                        disabled={pagado}
                      />
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pagoBusy || pagado}
                        onClick={() => void onRegistrarPago()}
                      >
                        <Plus className="mr-1 h-4 w-4" aria-hidden />
                        Registrar pago
                      </Button>
                    </div>
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
                      return (
                        <li key={p.id} className="flex items-center gap-3 px-3.5 py-2.5">
                          <p className="w-28 shrink-0 text-sm font-semibold tabular-nums text-foreground">
                            {formatMonto(val, p.moneda === "usd" ? "usd" : "ars")}
                          </p>
                          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {formatoFechaCortaDb(p.fecha)}
                            {p.nota ? ` · ${p.nota}` : ""}
                          </p>
                          <p className="shrink-0 text-xs font-medium text-muted-foreground">
                            {etiquetaMetodo(p.metodo)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {placasOt.length > 0 ? (
                  <section className="mt-4 space-y-2 border-t border-border pt-4">
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
              </div>
            </div>
          )}
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
