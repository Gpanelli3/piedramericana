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
import type { Database, VentaEstado } from "@/types/database";
import {
  ensureVentaForPresupuestoAprobado,
  getVentaPorPresupuesto,
  listPagosVenta,
  marcarVentaEntregado,
  registrarPagoSena,
} from "@/lib/ventas-api";
import type { PresupuestoRowList } from "@/lib/presupuestos-api";

type VentasPagoRow = Database["public"]["Tables"]["ventas_pagos"]["Row"];

function formatoFechaCortaDb(s: string): string {
  try {
    const d =
      /\d{4}-\d{2}-\d{2}/.exec(s)?.[0] ?
        new Date(s.includes("T") ? s : `${s}T12:00:00`)
      : new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return s;
  }
}

function etiquetaEstadoVenta(e: VentaEstado): string {
  switch (e) {
    case "aprobado_sin_sena":
      return "Sin seña registrada";
    case "senado":
      return "Con seña";
    case "en_produccion":
      return "En producción";
    case "finalizado":
      return "Finalizado";
    case "entregado":
      return "Entregado";
    default:
      return String(e);
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presupuestoId: string | null;
  /** Fila con merge de venta (lista completa desde API con merge) */
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

  const cargar = useCallback(
    async (pid: string) => {
      setBusy(true);
      const en = await ensureVentaForPresupuestoAprobado(pid);
      if (en.error) {
        setVentaCabecera(null);
        setPagosVentas([]);
        setBusy(false);
        return;
      }
      const vt = await getVentaPorPresupuesto(pid);
      if (vt.error || !vt.data) {
        setVentaCabecera(null);
        setPagosVentas([]);
        setBusy(false);
        return;
      }
      const lp = await listPagosVenta(vt.data.id);
      setVentaCabecera({ id: vt.data.id, estado: vt.data.estado as VentaEstado });
      setPagosVentas(lp.error ? [] : lp.data ?? []);
      setBusy(false);
    },
    [],
  );

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
    const n = Number(String(montoDigitado).replace(",", ".").trim());
    if (!Number.isFinite(n) || n <= 0) return;
    setPagoBusy(true);
    const res = await registrarPagoSena({
      presupuestoId,
      monto: n,
      moneda: pagoMoneda,
      fecha: pagoFecha,
      metodo: pagoMetodo || "Sin especificar",
      nota: pagoNota.trim() ? pagoNota.trim() : undefined,
      created_by: null,
    });
    setPagoBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Pago registrado.");
    setMontoDigitado("");
    setPagoNota("");
    await cargar(presupuestoId);
    await onDatosCambiaron();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cobros y venta</DialogTitle>
          <DialogDescription className="space-y-2 text-left">
            {rowResumen ?
              <>
                <span>
                  Presupuesto <span className="font-semibold text-foreground">{rowResumen.numero}</span>
                  {" · "}
                  {rowResumen.cliente}
                </span>
                {ventaCabecera ?
                  <span className="block text-sm">
                    Estado:{" "}
                    <span className="font-medium text-foreground">
                      {etiquetaEstadoVenta(ventaCabecera.estado)}
                    </span>
                  </span>
                : null}
                {rowResumen.pct_sena_sobre_presupuesto != null ?
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    Cobrado sobre total (misma moneda): {rowResumen.pct_sena_sobre_presupuesto.toFixed(1)} %
                  </span>
                : null}
              </>
            : null}
          </DialogDescription>
        </DialogHeader>

        {busy ?
          <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p>
        : <>
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <p className="font-semibold text-foreground">Registrar otro pago</p>
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
                  <Label>Método</Label>
                  <Select value={pagoMetodo} onValueChange={setPagoMetodo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
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
                {ventaCabecera?.estado === "finalizado" ?
                  <Button type="button" variant="outline" disabled={pagoBusy} onClick={() => void onMarcarEntregado()}>
                    Marcar entregado
                  </Button>
                : null}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Historial</p>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-3 text-xs">
                {pagosVentas.length === 0 ?
                  <p className="text-muted-foreground">Sin pagos.</p>
                : pagosVentas.map((p) => {
                    const val = typeof p.monto === "string" ? parseFloat(p.monto) : Number(p.monto ?? 0);
                    const montoTxt = Number.isFinite(val) ?
                        p.moneda === "usd"
                          ? val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : Math.round(val).toLocaleString("es-AR")
                      : String(p.monto);
                    return (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/70 pb-2 last:border-none last:pb-0"
                      >
                        <span className="text-muted-foreground">{formatoFechaCortaDb(p.fecha)}</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {montoTxt} {p.moneda.toUpperCase()}
                        </span>
                        <span className="text-muted-foreground truncate max-w-[8rem]">{p.metodo}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </>
        }

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
