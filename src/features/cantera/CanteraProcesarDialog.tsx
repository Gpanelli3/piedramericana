"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FechaInput } from "@/components/ui/fecha-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InventoryLoteListItem } from "@/lib/cantera-stock-api";
import { findOrCreateMaterialByName } from "@/lib/cantera-stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { parseDecimalInput } from "@/lib/presupuesto-calculos";
import { ConversionesMaestroHints } from "@/features/cantera/ConversionesMaestroHints";
import { useCanteraProcesamientos } from "@/features/cantera/useCanteraProcesamientos";

function newLineKey() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : `p-${Math.random().toString(36).slice(2)}`;
}

type ProductLineDraft = {
  key: string;
  nombre: string;
  cantidad: string;
  unit: string;
};

function blankProductLine(): ProductLineDraft {
  return { key: newLineKey(), nombre: "", cantidad: "", unit: "u." };
}

type CanteraProcesarDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotes: InventoryLoteListItem[];
  lotesLoading: boolean;
  userId?: string | null;
  onSuccess: () => void;
};

export function CanteraProcesarDialog({
  open,
  onOpenChange,
  lotes,
  lotesLoading,
  userId,
  onSuccess,
}: CanteraProcesarDialogProps) {
  const { register } = useCanteraProcesamientos(true);
  const lotesDisponibles = useMemo(
    () => lotes.filter((l) => l.qty_kg_remaining > 0),
    [lotes],
  );

  const [loteId, setLoteId] = useState("");
  const [kgConsumidos, setKgConsumidos] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [productLines, setProductLines] = useState<ProductLineDraft[]>(() => [blankProductLine()]);
  const [submitting, setSubmitting] = useState(false);

  const loteSeleccionado = lotesDisponibles.find((l) => l.id === loteId);

  useEffect(() => {
    if (open) {
      setKgConsumidos("");
      setIssueDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      setProductLines([blankProductLine()]);
      if (lotesDisponibles.length > 0) setLoteId(lotesDisponibles[0].id);
    }
  }, [open, lotesDisponibles]);

  useEffect(() => {
    if (!loteId && lotesDisponibles.length > 0) {
      setLoteId(lotesDisponibles[0].id);
    }
    if (loteId && !lotesDisponibles.some((l) => l.id === loteId)) {
      setLoteId(lotesDisponibles[0]?.id ?? "");
    }
  }, [loteId, lotesDisponibles]);

  const addProductLine = () => setProductLines((rows) => [...rows, blankProductLine()]);
  const removeProductLine = (key: string) => setProductLines((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  const patchProductLine = (key: string, patch: Partial<ProductLineDraft>) => setProductLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const handleSubmit = async () => {
    if (!loteId) {
      toast.error("Seleccioná un lote con kg disponibles.");
      return;
    }
    const kg = parseDecimalInput(kgConsumidos);
    if (!(kg > 0)) {
      toast.error("Los kg a consumir deben ser mayores a 0.");
      return;
    }
    const lote = lotesDisponibles.find((l) => l.id === loteId);
    if (!lote || kg > lote.qty_kg_remaining) {
      toast.error(`No hay suficientes kg en el lote (máx. ${lote?.qty_kg_remaining ?? 0}).`);
      return;
    }

    for (const ln of productLines) {
      const cantidad = parseDecimalInput(ln.cantidad);
      if (!ln.nombre.trim() || cantidad <= 0) {
        toast.error("Completá nombre y cantidad (> 0) en cada producto.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const resolvedLines: { material_producto_id: string; cantidad: number }[] = [];
      for (const ln of productLines) {
        const materialId = await findOrCreateMaterialByName(ln.nombre.trim(), ln.unit);
        resolvedLines.push({
          material_producto_id: materialId,
          cantidad: parseDecimalInput(ln.cantidad),
        });
      }

      await register({
        lote_id: loteId,
        qty_kg_consumidos: kg,
        issue_date: issueDate,
        notes,
        created_by: userId ?? null,
        lines: resolvedLines,
      });
      toast.success(
        isSupabaseConfigured
          ? "Procesamiento registrado. Stock de productos actualizado."
          : "Procesamiento demo (solo esta sesión, sin Supabase).",
      );
      onSuccess();
      onOpenChange(false);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "No se pudo registrar el procesamiento.";
      toast.error(msg);
      console.error("[cantera procesar]", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Procesar piedra bruta</DialogTitle>
          <DialogDescription>
            Consumí kg de un lote y registrá los productos terminados (adoquines, laja, etc.). Si el producto no existe, se crea automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {lotesLoading ? (
            <p className="text-sm text-muted-foreground">Cargando lotes…</p>
          ) : lotesDisponibles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No hay lotes con kg disponibles. Registrá un ingreso primero.
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Lote de origen</Label>
                  <Select value={loteId || "__none__"} onValueChange={(v) => setLoteId(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Elegir lote" />
                    </SelectTrigger>
                    <SelectContent>
                      {lotesDisponibles.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.material_name ?? l.material_id.slice(0, 8)} ·{" "}
                          {l.qty_kg_remaining.toLocaleString("es-AR", { maximumFractionDigits: 1 })} kg restantes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Kg a consumir</Label>
                  <Input
                    className="tabular-nums"
                    inputMode="decimal"
                    placeholder="ej. 2000"
                    value={kgConsumidos}
                    onChange={(e) => setKgConsumidos(e.target.value)}
                  />
                  {loteSeleccionado ? (
                    <p className="text-[10px] text-muted-foreground">
                      Máx.{" "}
                      {loteSeleccionado.qty_kg_remaining.toLocaleString("es-AR", { maximumFractionDigits: 1 })} kg
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Fecha</Label>
                  <FechaInput value={issueDate} onChange={setIssueDate} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Notas</Label>
                  <Textarea className="min-h-[56px] text-sm" placeholder="Observaciones…" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>

              {loteSeleccionado ? (
                <ConversionesMaestroHints parentMaterialId={loteSeleccionado.material_id} />
              ) : null}

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Productos terminados</h3>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addProductLine}>
                    <Plus className="h-3.5 w-3.5" />
                    Agregar
                  </Button>
                </div>
                <div className="space-y-2">
                  {productLines.map((ln, idx) => (
                    <div
                      key={ln.key}
                      className="grid gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-[1fr_6rem_6rem_auto] sm:items-end"
                    >
                      <div className="space-y-1 min-w-0">
                        <Label className="text-[11px] text-muted-foreground">Nombre del producto</Label>
                        <Input
                          placeholder="ej. Adoquines 10x20"
                          value={ln.nombre}
                          onChange={(e) => patchProductLine(ln.key, { nombre: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Cantidad</Label>
                        <Input
                          className="tabular-nums"
                          inputMode="decimal"
                          placeholder="0"
                          value={ln.cantidad}
                          onChange={(e) => patchProductLine(ln.key, { cantidad: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Unidad</Label>
                        <Select value={ln.unit} onValueChange={(v) => patchProductLine(ln.key, { unit: v })}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="u.">unidades</SelectItem>
                            <SelectItem value="m2">m²</SelectItem>
                            <SelectItem value="ml">ml</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end pb-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          disabled={productLines.length <= 1}
                          onClick={() => removeProductLine(ln.key)}
                          aria-label={`Quitar producto ${idx + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="accent"
                  disabled={submitting || !loteId}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? "Guardando…" : "Confirmar procesamiento"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
