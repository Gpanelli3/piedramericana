"use client";

import { useEffect, useState } from "react";
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
import { METODOS_COBRO_UI } from "@/lib/finanzas-api";

export type PresupuestoRowAprobacion = {
  id: string;
  numero: string;
  cliente: string;
  total: number;
  moneda: "ars" | "usd";
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PresupuestoRowAprobacion | null;
  busy: boolean;
  onConfirm: (payload: {
    totalAprobado: number;
    montoSenia: number;
    fecha: string;
    metodo: string;
    nota: string;
  }) => Promise<void>;
};

export function AprobarPresupuestoDialog({ open, onOpenChange, row, busy, onConfirm }: Props) {
  const [totalStr, setTotalStr] = useState("");
  const [senaStr, setSenaStr] = useState("");
  const [fecha, setFecha] = useState("");
  const [metodo, setMetodo] = useState("transferencia");
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (!open || !row) return;
    setTotalStr(String(row.total));
    setSenaStr("0");
    setFecha(new Date().toISOString().slice(0, 10));
    setMetodo("transferencia");
    setNota("");
  }, [open, row?.id]);

  const monedaLabel = row?.moneda === "usd" ? "USD" : "ARS";

  const handleSubmit = async () => {
    if (!row) return;
    const total = Number(String(totalStr).replace(",", "."));
    const sena = Number(String(senaStr).replace(",", "."));
    if (!Number.isFinite(total) || total < 0) return;
    if (!Number.isFinite(sena) || sena < 0) return;
    if (sena > total) return;
    await onConfirm({
      totalAprobado: total,
      montoSenia: sena,
      fecha,
      metodo: metodo || "transferencia",
      nota: nota.trim(),
    });
  };

  const senaInvalida =
    Number.isFinite(Number(String(senaStr).replace(",", "."))) &&
    Number(String(senaStr).replace(",", ".")) > Number(String(totalStr).replace(",", "."));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>Aprobar presupuesto</DialogTitle>
          <DialogDescription className="text-left">
            Confirmá el total del trabajo y la seña que ingresa ahora (puede ser el monto total o una parte). Los
            cobros posteriores se registran solo en{" "}
            <span className="font-medium text-foreground">Ventas</span> (menú lateral).
          </DialogDescription>
        </DialogHeader>

        {row ?
          <div className="space-y-4 text-sm">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
              <p className="font-medium text-foreground">{row.numero}</p>
              <p className="text-muted-foreground">{row.cliente}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ap-total">Total aprobado ({monedaLabel})</Label>
              <Input
                id="ap-total"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={totalStr}
                onChange={(e) => setTotalStr(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ap-sena">Seña que ingresa ahora ({monedaLabel})</Label>
              <Input
                id="ap-sena"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={senaStr}
                onChange={(e) => setSenaStr(e.target.value)}
              />
              {senaInvalida ?
                <p className="text-xs text-destructive">La seña no puede superar el total aprobado.</p>
              : (
                <p className="text-xs text-muted-foreground leading-snug">
                  Si ponés 0, la venta queda sin cobros hasta que cargues el primer pago en Ventas.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ap-fecha">Fecha del pago</Label>
                <Input id="ap-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Cómo se paga</Label>
                <Select value={metodo} onValueChange={setMetodo}>
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
              <Label htmlFor="ap-nota">Nota (opcional)</Label>
              <Textarea id="ap-nota" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} />
            </div>
          </div>
        : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy || !row || senaInvalida}
          >
            {busy ? "Guardando…" : "Aprobar y pasar a ventas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
