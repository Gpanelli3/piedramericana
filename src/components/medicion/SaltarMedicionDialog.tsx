"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { saltarMedicion } from "@/lib/medicion-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presupuestoId: string | null;
  cliente?: string;
  numero?: string;
  onDone: () => void;
};

export function SaltarMedicionDialog({
  open,
  onOpenChange,
  presupuestoId,
  cliente,
  numero,
  onDone,
}: Props) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setMotivo("");
  }, [open]);

  const onConfirm = async () => {
    if (!presupuestoId) return;
    setBusy(true);
    const res = await saltarMedicion({
      presupuestoId,
      motivo,
      usuarioId: user?.id ?? null,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Medición saltada. El vendedor puede mandar a producción cuando haya seña.");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Saltar medición</DialogTitle>
          <DialogDescription>
            {numero ? `${numero} · ` : ""}
            {cliente ?? "El cliente ya trajo la medida final."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <Label className="text-xs">Motivo (obligatorio)</Label>
          <Textarea
            rows={3}
            className="resize-none text-sm"
            placeholder="Ej. el cliente trajo la mesada de 1 × 2 m."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy || !presupuestoId || !motivo.trim()}
            onClick={() => void onConfirm()}
          >
            {busy ? "Guardando…" : "Saltar medición"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
