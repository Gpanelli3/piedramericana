"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FechaInput } from "@/components/ui/fecha-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormClassName,
} from "@/components/ui/dialog";
import { nombreEmpleado } from "@/lib/empleados-api";
import {
  quitarPagoLiquidacion,
  registrarPagoLiquidacion,
  type LiquidacionConDetalle,
} from "@/lib/sueldos-api";
import {
  formatFechaIso,
  formatPeriodo,
  formatPesos,
  hoyIso,
  parseMonto,
  round2,
  saldoLiquidacion,
  sumaPagos,
} from "@/lib/sueldos-calculos";

/** Cuánto sugerir en el próximo pago: media quincena, o lo que reste si es menos. */
function pagoSugerido(neto: number, saldo: number): string {
  if (saldo <= 0) return "";
  return String(Math.min(saldo, round2(neto / 2)));
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sueldo del mes de un empleado. Los sueldos se crean solos; acá solo se registran los pagos. */
  liquidacion: LiquidacionConDetalle | null;
  onSaved: (row: LiquidacionConDetalle) => void;
};

export function LiquidacionFormDialog({ open, onOpenChange, liquidacion, onSaved }: Props) {
  const [liq, setLiq] = useState<LiquidacionConDetalle | null>(liquidacion);
  const [pFecha, setPFecha] = useState(hoyIso());
  const [pMonto, setPMonto] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = (row: LiquidacionConDetalle) => {
    setLiq(row);
    setPFecha(hoyIso());
    setPMonto(pagoSugerido(row.total_neto, saldoLiquidacion(row.total_neto, row.liquidacion_pagos)));
  };

  useEffect(() => {
    if (open && liquidacion) cargar(liquidacion);
  }, [open, liquidacion]);

  if (!liq) return null;

  const pagos = liq.liquidacion_pagos;
  const pagado = sumaPagos(pagos);
  const saldo = saldoLiquidacion(liq.total_neto, pagos);
  const adelantos = round2(
    liq.liquidacion_conceptos
      .filter((c) => c.tipo === "adelanto")
      .reduce((s, c) => s + Number(c.monto || 0), 0),
  );
  const otrosDescuentos = round2(liq.total_descuentos - adelantos);
  const porcentaje =
    liq.total_neto > 0 ? Math.min(100, Math.max(0, (pagado / liq.total_neto) * 100)) : 0;
  const nombre = liq.empleados ? nombreEmpleado(liq.empleados) : "Empleado";

  const aplicar = (row: LiquidacionConDetalle) => {
    onSaved(row);
    cargar(row);
  };

  const registrarPago = async () => {
    const monto = parseMonto(pMonto);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error("Escribí el monto del pago");
      return;
    }
    setOcupado(true);
    const res = await registrarPagoLiquidacion(liq.id, { fecha: pFecha, monto });
    setOcupado(false);
    if (res.error || !res.data) {
      toast.error(res.error?.message ?? "No se pudo registrar el pago");
      return;
    }
    aplicar(res.data);
    toast.success(`Pago de ${formatPesos(monto)} registrado`);
  };

  const quitarPago = async (pagoId: string, monto: number, fecha: string) => {
    if (!window.confirm(`¿Quitar el pago de ${formatPesos(monto)} del ${formatFechaIso(fecha)}?`)) return;
    setOcupado(true);
    const res = await quitarPagoLiquidacion(liq.id, pagoId);
    setOcupado(false);
    if (res.error || !res.data) {
      toast.error(res.error?.message ?? "No se pudo quitar el pago");
      return;
    }
    aplicar(res.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogFormClassName} showCloseButton>
        <DialogHeader>
          <DialogTitle>{nombre}</DialogTitle>
          <DialogDescription>
            Sueldo de {formatPeriodo(liq.periodo_mes, liq.periodo_anio)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {saldo < 0 ? "Se le pagó de más" : saldo === 0 ? "Sueldo saldado" : "Falta pagarle"}
              </p>
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  saldo > 0 ? "text-warning-strong" : "text-success-strong"
                }`}
              >
                {formatPesos(Math.abs(saldo))}
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-success-strong transition-all"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Sueldo</dt>
                <dd className="tabular-nums">{formatPesos(liq.total_bruto)}</dd>
              </div>
              {adelantos > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Adelantos ya entregados</dt>
                  <dd className="tabular-nums">− {formatPesos(adelantos)}</dd>
                </div>
              )}
              {otrosDescuentos > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Otros descuentos</dt>
                  <dd className="tabular-nums">− {formatPesos(otrosDescuentos)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Pagos realizados</dt>
                <dd className="tabular-nums">− {formatPesos(pagado)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-medium">
                <dt>{saldo < 0 ? "Pagado de más" : "Falta pagar"}</dt>
                <dd className="tabular-nums">{formatPesos(Math.abs(saldo))}</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Pagos</Label>
            {pagos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no se le pagó nada este mes.</p>
            ) : (
              <ul className="space-y-2">
                {pagos.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-strong">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1">{formatFechaIso(p.fecha)}</span>
                    <span className="font-mono tabular-nums">{formatPesos(Number(p.monto))}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Quitar pago"
                      disabled={ocupado}
                      onClick={() => void quitarPago(p.id, Number(p.monto), p.fecha)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {saldo > 0 && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label className="text-xs">Registrar un pago</Label>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                <FechaInput value={pFecha} onChange={setPFecha} />
                <Input
                  className="h-9 tabular-nums"
                  inputMode="decimal"
                  placeholder="Monto"
                  value={pMonto}
                  onChange={(e) => setPMonto(e.target.value)}
                />
                <Button
                  type="button"
                  className="h-9 gap-1.5"
                  disabled={ocupado}
                  onClick={() => void registrarPago()}
                >
                  <Plus className="h-4 w-4" />
                  Registrar
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Se guarda al instante. Sugerimos media quincena; podés cambiar el monto.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
