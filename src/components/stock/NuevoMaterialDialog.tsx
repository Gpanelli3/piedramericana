"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormClassName,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createMaterial } from "@/lib/materials-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { CirclePlus } from "lucide-react";
import type { MaterialWizardRow } from "@/types/material-catalog";

type NuevoMaterialDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (material: MaterialWizardRow) => void;
  /** Texto del CTA primario. Default: "Crear y usar" */
  confirmLabel?: string;
};

export function NuevoMaterialDialog({
  open,
  onOpenChange,
  onCreated,
  confirmLabel = "Crear y usar",
}: NuevoMaterialDialogProps) {
  const [guardando, setGuardando] = useState(false);
  const [name, setName] = useState("");
  const [codigo, setCodigo] = useState("");

  const reset = () => {
    setName("");
    setCodigo("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado.");
      return;
    }

    setGuardando(true);
    try {
      const { data, error } = await createMaterial({
        name: trimmed,
        unit: "m2",
        material_kind: "marmol",
        codigo: codigo.trim() || null,
      });
      if (error || !data) {
        toast.error(error?.message ?? "No se pudo crear el material");
        return;
      }
      onCreated(data);
      handleOpenChange(false);
      toast.success("Material creado");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={dialogFormClassName} showCloseButton>
        <DialogHeader>
          <DialogTitle>Material</DialogTitle>
        </DialogHeader>
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Material nuevo</p>
          <div className="grid gap-2.5">
            <Input
              className="h-10 bg-background"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre (ej: Granito Negro Brasil)"
              autoFocus
            />
            <Input
              className="h-10 bg-background"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Código (opcional)"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            className="gap-1.5"
            onClick={() => void handleSave()}
            disabled={!name.trim() || guardando}
          >
            <CirclePlus className="h-4 w-4" />
            {guardando ? "Creando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
