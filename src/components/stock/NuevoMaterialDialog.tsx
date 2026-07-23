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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMaterial } from "@/lib/materials-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { MaterialKindDb } from "@/types/database";
import type { MaterialWizardRow } from "@/types/material-catalog";

type NuevoMaterialDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (material: MaterialWizardRow) => void;
};

export function NuevoMaterialDialog({
  open,
  onOpenChange,
  onCreated,
}: NuevoMaterialDialogProps) {
  const [guardando, setGuardando] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    unit: "m2",
    material_kind: "marmol" as MaterialKindDb,
    peso_por_m2_kg: "",
  });

  const reset = () => {
    setDraft({
      name: "",
      unit: "m2",
      material_kind: "marmol",
      peso_por_m2_kg: "",
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSave = async () => {
    const name = draft.name.trim();
    if (!name) return;
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado.");
      return;
    }

    const pesoRaw = draft.peso_por_m2_kg.trim().replace(",", ".");
    const peso = pesoRaw === "" ? null : Number.parseFloat(pesoRaw);
    if (pesoRaw !== "" && (!Number.isFinite(peso) || (peso ?? 0) < 0)) {
      toast.error("El peso por m² debe ser un número válido.");
      return;
    }

    setGuardando(true);
    try {
      const { data, error } = await createMaterial({
        name,
        unit: draft.unit,
        material_kind: draft.material_kind,
        peso_por_m2_kg: peso,
      });
      if (error || !data) {
        toast.error(error?.message ?? "No se pudo crear el material");
        return;
      }
      onCreated(data);
      handleOpenChange(false);
      toast.success("Material guardado");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Nuevo material</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input
              className="h-9 text-sm"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Ej. Granito Negro Boreal 20mm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Unidad</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                value={draft.unit}
                onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
              >
                <option value="m2">m²</option>
                <option value="ml">ml</option>
                <option value="kg">kg</option>
                <option value="uni">uni</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                value={draft.material_kind}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    material_kind: e.target.value as MaterialKindDb,
                  }))
                }
              >
                <option value="marmol">Mármol</option>
                <option value="otra_piedra">Otra piedra</option>
                <option value="agglomerado_otro">Aglomerado / otro</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Peso kg/m² (opcional)</Label>
            <Input
              className="h-9 text-sm"
              inputMode="decimal"
              value={draft.peso_por_m2_kg}
              onChange={(e) =>
                setDraft((d) => ({ ...d, peso_por_m2_kg: e.target.value }))
              }
              placeholder="Ej. 55"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!draft.name.trim() || guardando}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
