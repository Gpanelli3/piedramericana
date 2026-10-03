"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OtMedidasPanel } from "@/components/produccion/OtMedidasPanel";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presupuestoId: string | null;
  cliente?: string;
  numero?: string;
  onSaved: () => void;
};

export function ConfirmarMedidasDialog({
  open,
  onOpenChange,
  presupuestoId,
  cliente,
  numero,
  onSaved,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(40rem,90vh)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Confirmar medidas</DialogTitle>
          <DialogDescription>
            {numero ? `${numero} · ` : ""}
            {cliente ?? "Ajustá las medidas de obra y confirmá."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {open && presupuestoId ? (
            <OtMedidasPanel
              presupuestoId={presupuestoId}
              destacado
              confirmarPipeline
              onSaved={() => {
                onOpenChange(false);
                onSaved();
              }}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
