"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Separator } from "@/components/ui/separator";
import type { Database, VentaEstado } from "@/types/database";
import {
  confirmarMedicionVenta,
  getVentaPorPresupuesto,
  listPagosVenta,
  marcarVentaEntregado,
  pasarAProduccion,
  registrarPagoSena,
} from "@/lib/ventas-api";
import { METODOS_COBRO_UI, etiquetaMetodo } from "@/lib/finanzas-api";
import type { PresupuestoRowList } from "@/lib/presupuestos-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  listChapasUsadasPorOt,
  type ChapaInventarioRow,
} from "@/lib/stock-ot-api";

type VentasPagoRow = Database["public"]["Tables"]["ventas_pagos"]["Row"];

function formatoFechaCortaDb(s: string): string {
  try {
    const d =
      /\d{4}-\d{2}-\d{2}/.exec(s)?.[0]
        ? new Date(s.includes("T") ? s : `${s}T12:00:00`)
        : new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return s;
  }
}

function etiquetaEstadoVenta(e: VentaEstado | null): string {
  if (e === null) return "Sin seña registrada";
  switch (e) {
    case "senado":            return "Con seña — pendiente medición";
    case "en_medicion":       return "En medición — esperando saldo";
    case "en_produccion":     return "En producción";
    case "finalizado":        return "Finalizado";
    case "entregado":         return "Entregado";
    default:                  return String(e);
  }
}

function colorEstado(e: VentaEstado | null): string {
  if (e === null) return "text-amber-600 dark:text-amber-400";
  switch (e) {
    case "senado":            return "text-blue-600 dark:text-blue-400";
    case "en_medicion":       return "text-violet-600 dark:text-violet-400";
    case "en_produccion":     return "text-emerald-600 dark:text-emerald-400";
    case "finalizado":        return "text-sky-600 dark:text-sky-400";
    case "entregado":         return "text-green-700 dark:text-green-400";
    default:                  return "text-foreground";
  }
}

/** Pasos del flujo de medición para mostrar al usuario */
const FLUJO_ESTADOS: { estado: VentaEstado; label: string }[] = [
  { estado: "senado",            label: "Seña" },
  { estado: "en_medicion",       label: "Medición" },
  { estado: "en_produccion",     label: "Producción" },
  { estado: "finalizado",        label: "Finalizado" },
  { estado: "entregado",         label: "Entregado" },
];

function FlujoPasos({ estado }: { estado: VentaEstado | null }) {
  const idx = estado ? FLUJO_ESTADOS.findIndex((f) => f.estado === estado) : -1;
  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {FLUJO_ESTADOS.map((f, i) => (
        <div key={f.estado} className="flex items-center gap-0 shrink-0">
          <div
            className={`flex h-6 min-w-[5rem] items-center justify-center rounded px-2 text-[10px] font-medium transition-colors ${
              i < idx
                ? "bg-muted text-muted-foreground"
                : i === idx
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground/50"
            }`}
          >
            {f.label}
          </div>
          {i < FLUJO_ESTADOS.length - 1 && (
            <div className={`h-px w-3 shrink-0 ${i < idx ? "bg-muted-foreground/40" : "bg-muted/40"}`} />
          )}
        </div>
      ))}
    </div>
  );
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
  const [busy, setBusy] = useState(false);
  const [ventaCabecera, setVentaCabecera] = useState<{ id: string; estado: VentaEstado } | null>(null);
  const [pagosVentas, setPagosVentas] = useState<VentasPagoRow[]>([]);
  const [pagoBusy, setPagoBusy] = useState(false);
  const [montoDigitado, setMontoDigitado] = useState("");
  const [pagoMoneda, setPagoMoneda] = useState<"ars" | "usd">("ars");
  const [pagoMetodo, setPagoMetodo] = useState("transferencia");
  const [pagoFecha, setPagoFecha] = useState("");
  const [pagoNota, setPagoNota] = useState("");
  const [notasMedicion, setNotasMedicion] = useState("");
  const [placasOt, setPlacasOt] = useState<ChapaInventarioRow[]>([]);

  const cargar = useCallback(async (pid: string) => {
    setBusy(true);
    const vt = await getVentaPorPresupuesto(pid);
    if (vt.error || !vt.data) {
      setVentaCabecera(null);
      setPagosVentas([]);
      setPlacasOt([]);
      setBusy(false);
      return;
    }
    const lp = await listPagosVenta(vt.data.id);
    setVentaCabecera({ id: vt.data.id, estado: vt.data.estado as VentaEstado });
    setPagosVentas(lp.error ? [] : lp.data ?? []);

    const otId = rowResumen?.orden_trabajo_id;
    if (otId && isSupabaseConfigured) {
      const ch = await listChapasUsadasPorOt(otId);
      setPlacasOt(ch.error ? [] : ch.data);
    } else {
      setPlacasOt([]);
    }
    setBusy(false);
  }, [rowResumen?.orden_trabajo_id]);

  useEffect(() => {
    if (!open || !presupuestoId) return;
    const hoy = new Date().toISOString().slice(0, 10);
    setPagoFecha(hoy);
    setPagoMetodo("transferencia");
    setMontoDigitado("");
    setPagoNota("");
    setNotasMedicion("");
    if (rowResumen?.moneda) setPagoMoneda(rowResumen.moneda);
    void cargar(presupuestoId);
  }, [open, presupuestoId, rowResumen?.moneda, cargar]);

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
      if (
        ventaCabecera?.estado === "en_medicion" &&
        typeof rowResumen?.saldo_misma_moneda === "number" &&
        n + 0.005 < rowResumen.saldo_misma_moneda
      ) {
        toast.error("Para desbloquear producción tenés que registrar el saldo completo.");
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
      if (res.error) { toast.error(res.error.message); return; }

      if (ventaCabecera?.id && ventaCabecera.estado === "en_medicion") {
        const prod = await pasarAProduccion({ ventaId: ventaCabecera.id });
        if (prod.error) { toast.error(prod.error.message); return; }
        toast.success("Pago del saldo registrado. Venta en producción y OT desbloqueada.");
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
    rowResumen?.saldo_misma_moneda,
    ventaCabecera,
    cargar,
    onDatosCambiaron,
  ]);

  const onMarcarEntregado = useCallback(async () => {
    if (!ventaCabecera?.id || pagoBusy || !presupuestoId) return;
    setPagoBusy(true);
    const res = await marcarVentaEntregado(ventaCabecera.id);
    setPagoBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Venta marcada como entregada.");
    await cargar(presupuestoId);
    await onDatosCambiaron();
  }, [ventaCabecera, pagoBusy, presupuestoId, cargar, onDatosCambiaron]);

  const onConfirmarMedicion = useCallback(async () => {
    if (!ventaCabecera?.id || pagoBusy || !presupuestoId) return;
    try {
      setPagoBusy(true);
      const res = await confirmarMedicionVenta({
        ventaId: ventaCabecera.id,
        notasMedicion: notasMedicion.trim() || undefined,
      });
      if (res.error) { toast.error(res.error.message); return; }
      toast.success("Medidas confirmadas. La venta quedó en medición.");
      setNotasMedicion("");
      await cargar(presupuestoId);
      await onDatosCambiaron();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo confirmar la medición.");
    } finally {
      setPagoBusy(false);
    }
  }, [ventaCabecera, pagoBusy, presupuestoId, notasMedicion, cargar, onDatosCambiaron]);

  const estado = ventaCabecera?.estado;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <DialogTitle>Cobros y venta</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              {rowResumen ? (
                <p className="text-sm">
                  <span className="font-semibold text-foreground">{rowResumen.numero}</span>
                  {" · "}
                  <span className="text-foreground">{rowResumen.cliente}</span>
                </p>
              ) : null}
              <div className="space-y-2">
                <p className="text-sm">
                  Estado:{" "}
                  <span className={`font-semibold ${colorEstado(estado ?? null)}`}>
                    {etiquetaEstadoVenta(estado ?? null)}
                  </span>
                </p>
                <FlujoPasos estado={estado ?? null} />
              </div>
              {rowResumen?.pct_sena_sobre_presupuesto != null ? (
                <p className="text-xs text-muted-foreground tabular-nums">
                  Cobrado:{" "}
                  <span className="font-medium text-foreground">
                    {rowResumen.pct_sena_sobre_presupuesto.toFixed(1)} %
                  </span>
                  {" "}(misma moneda)
                </p>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p>
        ) : (
          <div className="space-y-4">
            {/* ─── Acciones de flujo de medición ─── */}
            {(estado === "senado" || estado === "en_medicion") && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-4 py-3 space-y-3 dark:border-violet-900/40 dark:bg-violet-950/20">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  Flujo de medición
                </p>

                {estado === "senado" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground leading-snug">
                      El medidor fue a obra. Confirmá las medidas para pasar a <strong>En medición</strong>.
                      La OT seguirá bloqueada hasta registrar el pago del saldo.
                    </p>
                    <div className="space-y-1">
                      <Label className="text-xs">Notas de medición (opcional)</Label>
                      <Textarea
                        rows={2}
                        className="text-xs resize-none"
                        placeholder="Diferencias encontradas, observaciones de obra…"
                        value={notasMedicion}
                        onChange={(e) => setNotasMedicion(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pagoBusy}
                      className="bg-violet-600 text-white hover:bg-violet-700"
                      onClick={() => void onConfirmarMedicion()}
                    >
                      Confirmar medidas
                    </Button>
                  </div>
                )}

                {estado === "en_medicion" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground leading-snug">
                      Medidas confirmadas. Registrá el pago del saldo para pasar la venta a
                      <strong> Producción</strong> y desbloquear la OT.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pagoBusy}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => void onRegistrarPago()}
                    >
                      Registrar pago del saldo
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ─── Registrar pago ─── */}
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <p className="font-semibold text-foreground">Registrar pago</p>
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
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vc-fecha">Fecha</Label>
                  <Input id="vc-fecha" type="date" value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Moneda</Label>
                  <Select value={pagoMoneda} onValueChange={(v) => setPagoMoneda(v as "ars" | "usd")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ars">ARS</SelectItem>
                      <SelectItem value="usd">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cómo se paga</Label>
                  <Select value={pagoMetodo} onValueChange={setPagoMetodo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Textarea id="vc-nota" rows={2} value={pagoNota} onChange={(e) => setPagoNota(e.target.value)} />
              </div>
              {estado === "en_medicion" && (
                <p className="text-xs text-muted-foreground">
                  Este pago final pasa la venta a producción y mueve la OT fuera de <strong>medición</strong>.
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" disabled={pagoBusy} onClick={() => void onRegistrarPago()}>
                  {estado === "en_medicion" ? "Registrar pago del saldo" : "Registrar pago"}
                </Button>
                {estado === "finalizado" && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pagoBusy}
                    onClick={() => void onMarcarEntregado()}
                  >
                    Marcar entregado
                  </Button>
                )}
              </div>
            </div>

            {/* ─── Historial de pagos ─── */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Historial de cobros</p>
              <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-md border border-border p-3 text-xs">
                {pagosVentas.length === 0 ? (
                  <p className="text-muted-foreground">Sin pagos registrados.</p>
                ) : (
                  pagosVentas.map((p) => {
                    const val = typeof p.monto === "string" ? parseFloat(p.monto) : Number(p.monto ?? 0);
                    const montoTxt = Number.isFinite(val)
                      ? p.moneda === "usd"
                        ? val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : Math.round(val).toLocaleString("es-AR")
                      : String(p.monto);
                    return (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border/60 pb-1.5 last:border-none last:pb-0"
                      >
                        <span className="text-muted-foreground">{formatoFechaCortaDb(p.fecha)}</span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {montoTxt} {p.moneda.toUpperCase()}
                        </span>
                        <span className="text-muted-foreground truncate max-w-[8rem]">{etiquetaMetodo(p.metodo)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ─── Placas usadas en la OT ─── */}
            {rowResumen?.orden_trabajo_id ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Placas de la obra</p>
                <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border border-border p-3 text-xs">
                  {placasOt.length === 0 ? (
                    <p className="text-muted-foreground">
                      Sin placas reservadas/usadas aún. Se asignan desde Producción.
                    </p>
                  ) : (
                    placasOt.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border/60 pb-1.5 last:border-none last:pb-0"
                      >
                        <span className="font-mono font-medium text-foreground">{c.bulto}</span>
                        <span className="text-muted-foreground truncate max-w-[10rem]">
                          {c.lote_codigo ? `lote ${c.lote_codigo}` : "sin lote"}
                          {c.origen_placa ? ` · ${c.origen_placa}` : ""}
                        </span>
                        <span className="font-medium">{c.estado}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <Separator />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
