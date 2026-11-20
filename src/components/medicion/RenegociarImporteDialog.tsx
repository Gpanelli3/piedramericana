"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormClassName,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { renegociarImporteTrasMedicion, type MedicionColaItem } from "@/lib/medicion-api";
import { parseDecimalInput } from "@/lib/presupuesto-calculos";
import { formatMoneyAr } from "@/lib/presupuesto-detalle";

type Props = {
  item: MedicionColaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuarioId?: string | null;
  /** Se llama cuando el importe quedó acordado y registrado. */
  onDone: (presupuestoId: string) => void;
};

export function RenegociarImporteDialog({ item, open, onOpenChange, usuarioId, onDone }: Props) {
  const [importe, setImporte] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setImporte(
      item.medicion.conformidad_total_nuevo != null ? String(item.medicion.conformidad_total_nuevo) : "",
    );
    setMotivo("");
  }, [open, item]);

  if (!item) return null;

  const anterior = item.medicion.conformidad_total_anterior;
  const deMedicion = item.medicion.conformidad_total_nuevo;

  const guardar = async () => {
    setGuardando(true);
    const res = await renegociarImporteTrasMedicion({
      presupuestoId: item.presupuestoId,
      nuevoTotal: parseDecimalInput(importe),
      motivo,
      usuarioId: usuarioId ?? null,
    });
    setGuardando(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Importe acordado registrado.");
    onOpenChange(false);
    onDone(item.presupuestoId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogFormClassName} showCloseButton>
        <DialogHeader>
          <DialogTitle>El cliente no acepta el nuevo importe</DialogTitle>
          <DialogDescription>
            {item.numero} · {item.cliente}. Cargá el importe que acordaron: queda registrado y la OT puede
            pasar a producción.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Importe que había aceptado</p>
              <p className="font-medium tabular-nums">
                {anterior != null ? formatMoneyAr(anterior, item.moneda) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Importe según la medición</p>
              <p className="font-medium tabular-nums">
                {deMedicion != null ? formatMoneyAr(deMedicion, item.moneda) : "—"}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="renegociar-importe" className="text-sm">
              Importe acordado ({item.moneda.toUpperCase()})
            </Label>
            <Input
              id="renegociar-importe"
              className="h-10 tabular-nums"
              inputMode="decimal"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              placeholder="Ej. 62000"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="renegociar-motivo" className="text-sm">
              Motivo o cómo se acordó
            </Label>
            <Textarea
              id="renegociar-motivo"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Hablé con el cliente por teléfono y aceptó este importe."
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={guardando} onClick={() => void guardar()}>
            {guardando ? "Guardando…" : "Guardar y continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
