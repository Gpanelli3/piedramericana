"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FechaInput } from "@/components/ui/fecha-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { solicitarMedicion } from "@/lib/medicion-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presupuestoId: string | null;
  cliente?: string;
  numero?: string;
  onDone: () => void;
};

export function SolicitarMedicionDialog({
  open,
  onOpenChange,
  presupuestoId,
  cliente,
  numero,
  onDone,
}: Props) {
  const { user } = useAuth();
  const [fecha, setFecha] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setFecha("");
  }, [open]);

  const onConfirm = async () => {
    if (!presupuestoId) return;
    setBusy(true);
    const res = await solicitarMedicion({
      presupuestoId,
      fechaProgramada: fecha || null,
      usuarioId: user?.id ?? null,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Listo para medir.");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Listo para medir</DialogTitle>
          <DialogDescription>
            {numero ? `${numero} · ` : ""}
            {cliente ?? "Valentino coordina la visita."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <Label className="text-xs">Fecha sugerida (opcional)</Label>
          <FechaInput value={fecha} onChange={setFecha} />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy || !presupuestoId} onClick={() => void onConfirm()}>
            {busy ? "Guardando…" : "Marcar listo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
