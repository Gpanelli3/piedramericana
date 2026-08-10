"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

function etiquetaEtapaOt(etapa: string | null, estadoOt: JobStatus | null): string {
  if (estadoOt === "done") return "Finalizada";
  if (estadoOt === "cancelled") return "Cancelada";
  switch (etapa) {
    case "medicion":
      return "Medición";
    case "corte":
      return "Corte";
    case "produccion":
      return "Producción";
    case "despacho":
      return "Despacho";
    default:
      return "Sin OT";
  }
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
        setOtEtapa(null);
        setOtEstado(null);
      }
    } else {
      setPlacasOt([]);
      setOtEtapa(null);
      setOtEstado(null);
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

  return (
    <>
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
              <p className="text-sm">
                Estado OT:{" "}
                <span className="font-semibold text-foreground">
                  {estado === "entregado"
                    ? "Entregada"
                    : etiquetaEtapaOt(otEtapa, otEstado)}
                </span>
              </p>
              {rowResumen?.pct_sena_sobre_presupuesto != null ? (
                <p className="text-xs text-muted-foreground tabular-nums">
                  Cobrado:{" "}
                  <span className="font-medium text-foreground">
                    {rowResumen.pct_sena_sobre_presupuesto.toFixed(1)} %
                  </span>
                  {" "}(misma moneda)
                  {typeof rowResumen.saldo_misma_moneda === "number" ? (
                    <>
                      {" · "}Saldo:{" "}
                      <span className="font-medium text-foreground">
                        {rowResumen.moneda === "usd"
                          ? rowResumen.saldo_misma_moneda.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : Math.round(rowResumen.saldo_misma_moneda).toLocaleString("es-AR")}
                      </span>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p>
        ) : (
          <div className="space-y-4">
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
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" disabled={pagoBusy} onClick={() => void onRegistrarPago()}>
                  Registrar pago
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
                        <span className="text-muted-foreground">
                          {formatoFechaCortaDb(p.fecha)} · {etiquetaMetodo(p.metodo)}
                        </span>
                        <span className="font-medium tabular-nums text-foreground">
                          {p.moneda === "usd" ? "USD " : "$ "}
                          {montoTxt}
                        </span>
                        {p.nota ? (
                          <span className="w-full text-muted-foreground">{p.nota}</span>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {placasOt.length > 0 ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Placas asociadas a la OT</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {placasOt.map((c) => (
                      <li key={c.id}>
                        {c.bulto} · {c.material_label}
                        {c.lote_codigo ? ` · lote ${c.lote_codigo}` : ""} · {c.estado}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}
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
