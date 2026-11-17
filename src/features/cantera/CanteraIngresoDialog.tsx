"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  dialogFormClassName,
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
import type { MaterialOption } from "@/lib/stock-api";
import { fetchSuppliers, type SupplierRow } from "@/lib/suppliers-api";
import type { RegisterCanteraLineInput, CanteraPurchaseUom } from "@/lib/cantera-stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { parseDecimalInput } from "@/lib/presupuesto-calculos";

function newLineKey() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : `l-${Math.random().toString(36).slice(2)}`;
}

type LineDraft = {
  key: string;
  materialId: string;
  qty: string;
  uom: CanteraPurchaseUom;
};

function blankLine(defaultMaterialId: string): LineDraft {
  return { key: newLineKey(), materialId: defaultMaterialId, qty: "", uom: "KG" };
}

type CanteraIngresoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materiales: MaterialOption[];
  userId?: string | null;
  register: (lines: RegisterCanteraLineInput[]) => Promise<void>;
  onSuccess: () => void;
};

export function CanteraIngresoDialog({
  open,
  onOpenChange,
  materiales,
  userId,
  register,
  onSuccess,
}: CanteraIngresoDialogProps) {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      const aMatch = (a.rubros ?? []).includes("piedra_kg") ? 0 : 1;
      const bMatch = (b.rubros ?? []).includes("piedra_kg") ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.name.localeCompare(b.name, "es");
    });
  }, [suppliers]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptRef, setReceiptRef] = useState("");
  const [notes, setNotes] = useState("");
  const firstId = materiales[0]?.id ?? "";
  const [lines, setLines] = useState<LineDraft[]>(() => [blankLine(firstId)]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSuppliers([]);
      return;
    }
    let cancel = false;
    void fetchSuppliers()
      .then((s) => {
        if (!cancel) setSuppliers(s);
      })
      .catch(() => {
        if (!cancel) setSuppliers([]);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!firstId) return;
    setLines((prev) =>
      prev.map((l) =>
        l.materialId && materiales.some((m) => m.id === l.materialId) ? l : { ...l, materialId: firstId },
      ),
    );
  }, [firstId, materiales]);

  useEffect(() => {
    if (open) {
      setSupplierId("");
      setIssueDate(new Date().toISOString().slice(0, 10));
      setReceiptRef("");
      setNotes("");
      setLines([blankLine(firstId)]);
    }
  }, [open, firstId]);

  const addLine = () => setLines((rows) => [...rows, blankLine(firstId)]);
  const removeLine = (key: string) => setLines((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  const patchLine = (key: string, patch: Partial<LineDraft>) => setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const handleSubmit = async () => {
    if (!materiales.length) {
      toast.error("No hay materiales en catálogo.");
      return;
    }
    const payload: RegisterCanteraLineInput[] = [];
    for (const ln of lines) {
      const qty = parseDecimalInput(ln.qty);
      if (!ln.materialId || qty <= 0) {
        toast.error("Completá material y cantidad (> 0) en cada línea.");
        return;
      }
      payload.push({
        material_id: ln.materialId,
        quantity: qty,
        purchase_uom: ln.uom,
        supplier_id: supplierId || null,
        receipt_ref: receiptRef,
        notes,
        issue_date: issueDate,
        created_by: userId ?? null,
      });
    }
    setSubmitting(true);
    try {
      await register(payload);
      toast.success(
        isSupabaseConfigured
          ? "Ingreso registrado. Stock a granel actualizado."
          : "Ingreso demo (solo esta sesión, sin Supabase).",
      );
      onSuccess();
      onOpenChange(false);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "No se pudo registrar el ingreso.";
      toast.error(msg);
      console.error("[cantera ingreso]", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogFormClassName}>
        <DialogHeader>
          <DialogTitle>Nuevo ingreso de cantera</DialogTitle>
          <DialogDescription>
            Registrá la materia prima recibida. Se crea un lote y se actualiza el stock a granel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Proveedor</Label>
              <Select
                value={supplierId || "__none__"}
                onValueChange={(v) => setSupplierId(v === "__none__" ? "" : v)}
                disabled={!isSupabaseConfigured}
              >
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder="Sin proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin proveedor</SelectItem>
                  {sortedSuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Fecha</Label>
              <FechaInput className="h-9 w-full text-sm" value={issueDate} onChange={setIssueDate} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ref. comprobante</Label>
              <Input className="h-9 text-sm" placeholder="Remito / nota" value={receiptRef} onChange={(e) => setReceiptRef(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notas</Label>
              <Textarea className="min-h-[56px] text-sm" placeholder="Observaciones…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Líneas de material</h3>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((ln, idx) => (
                <div
                  key={ln.key}
                  className="grid gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-[1fr_7rem_7rem_auto] sm:items-end"
                >
                  <div className="space-y-1 min-w-0">
                    <Label className="text-[11px] text-muted-foreground">Material</Label>
                    <Select value={ln.materialId} onValueChange={(v) => patchLine(ln.key, { materialId: v })}>
                      <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {materiales.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Cantidad</Label>
                    <Input className="h-9 text-sm tabular-nums" inputMode="decimal" placeholder="0" value={ln.qty} onChange={(e) => patchLine(ln.key, { qty: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Unidad</Label>
                    <Select value={ln.uom} onValueChange={(v) => patchLine(ln.key, { uom: v as CanteraPurchaseUom })}>
                      <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KG">kg</SelectItem>
                        <SelectItem value="T">ton</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end pb-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      disabled={lines.length <= 1}
                      onClick={() => removeLine(ln.key)}
                      aria-label={`Quitar línea ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={submitting || !materiales.length}
              onClick={() => void handleSubmit()}
            >
              {submitting ? "Guardando…" : "Confirmar ingreso"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
