"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Copy,
  UserRound,
  Calendar as CalendarIcon,
  PenSquare,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { MaterialOption } from "@/lib/stock-api";
import {
  fetchSuppliers,
  createRemitoWithSlabsViaRpc,
  type SupplierRow,
  type ChapaRow,
} from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { NuevoProveedorDialog } from "./NuevoProveedorDialog";
import { toast } from "sonner";

const MAX_NOTAS = 200;

type LineDraft = {
  key: string;
  material_id: string | null;
  material_other: string;
  qty_slabs: string;
  largo_cm: string;
  ancho_cm: string;
  bulto_inicio: string;
  precio: string;
  lote_codigo: string;
};

function newLineKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `l-${Math.random().toString(36).slice(2)}`;
}

function blankLine(): LineDraft {
  return {
    key: newLineKey(),
    material_id: null,
    material_other: "",
    qty_slabs: "1",
    largo_cm: "",
    ancho_cm: "",
    bulto_inicio: "",
    precio: "",
    lote_codigo: "",
  };
}

function m2Teoricos(qty: number, largoCm: number, anchoCm: number): number {
  if (
    !Number.isFinite(qty) ||
    qty <= 0 ||
    !Number.isFinite(largoCm) ||
    largoCm <= 0 ||
    !Number.isFinite(anchoCm)
  ) {
    return 0;
  }
  return (largoCm / 100) * (anchoCm / 100) * qty;
}

type CrearRemitoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materiales: MaterialOption[];
  userId: string | null | undefined;
  reloadChapas: () => Promise<void>;
  refreshRemitos: () => Promise<void>;
  setChapas: Dispatch<SetStateAction<ChapaRow[]>>;
  existingBultosLower: Set<string>;
};

export function CrearRemitoDialog({
  open,
  onOpenChange,
  materiales,
  userId,
  reloadChapas,
  refreshRemitos,
  setChapas,
  existingBultosLower,
}: CrearRemitoDialogProps) {
  const [proveedorDialog, setProveedorDialog] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [branchCode, setBranchCode] = useState("");
  const [serialCode, setSerialCode] = useState("000000");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>(() => [blankLine()]);
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const reloadSuppliers = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const s = await fetchSuppliers();
      setSuppliers(s);
      setLoadErr(null);
    } catch {
      setLoadErr("No se pudieron cargar proveedores.");
      setSuppliers([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void reloadSuppliers();
  }, [open, reloadSuppliers]);

  useEffect(() => {
    if (!open) return;
    setLines([blankLine()]);
    setNotes("");
    setBranchCode("");
    setSupplierId("");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setSerialCode("000000");
  }, [open]);

  const materialLabelForLine = useCallback(
    (l: LineDraft) => {
      if (l.material_id) {
        const m = materiales.find((x) => x.id === l.material_id);
        return m?.name?.trim() || l.material_other.trim();
      }
      return l.material_other.trim();
    },
    [materiales],
  );

  const setLine = useCallback((key: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, blankLine()]);
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  }, []);

  const duplicateLine = useCallback((row: LineDraft) => {
    setLines((prev) => [...prev, { ...row, key: newLineKey(), bulto_inicio: "" }]);
  }, []);

  const canSave = useMemo(() => notes.length <= MAX_NOTAS, [notes]);

  const handleGrabar = async () => {
    if (!canSave) {
      toast.error(`Observación: máximo ${MAX_NOTAS} caracteres.`);
      return;
    }

    const labelLines: { draft: LineDraft; label: string }[] = [];
    for (const d of lines) {
      const label = materialLabelForLine(d);
      if (!label) {
        toast.error("Definí el material en cada línea.");
        return;
      }
      const qty = parseInt(d.qty_slabs.replace(/\s/g, ""), 10);
      const largo = Number(d.largo_cm.replace(",", "."));
      const ancho = Number(d.ancho_cm.replace(",", "."));
      const ini = parseInt(d.bulto_inicio.trim().replace(/^#/, ""), 10);

      if (!Number.isFinite(qty) || qty < 1) {
        toast.error("Cantidad de placas inválida.");
        return;
      }
      if (!Number.isFinite(largo) || largo <= 0 || !Number.isFinite(ancho) || ancho <= 0) {
        toast.error("Largo y ancho deben ser mayores a 0.");
        return;
      }
      if (!Number.isFinite(ini) || ini < 1) {
        toast.error("Indicá N° inicial de bulto (entero positivo) por línea.");
        return;
      }

      labelLines.push({
        draft: {
          ...d,
          material_id: d.material_id,
          material_other: d.material_id ? "" : label,
        },
        label,
      });
    }

    if (isSupabaseConfigured) {
      if (!supplierId) {
        toast.error("Seleccioná un proveedor o creá uno nuevo.");
        return;
      }

      const payloadLines = labelLines.map((x, idx) => {
        const draft = x.draft;
        const qty = parseInt(draft.qty_slabs.replace(/\s/g, ""), 10);
        const largo = Number(draft.largo_cm.replace(",", "."));
        const ancho = Number(draft.ancho_cm.replace(",", "."));
        const ini = parseInt(draft.bulto_inicio.trim().replace(/^#/, ""), 10);
        const pu =
          draft.precio.trim() === "" ? null : Number(draft.precio.replace(",", "."));

        return {
          material_id: draft.material_id,
          material_label: x.label,
          qty_slabs: qty,
          largo_cm: largo,
          ancho_cm: ancho,
          bulto_numero_inicio: ini,
          precio_unitario: pu !== null && Number.isFinite(pu) ? pu : null,
          lote_codigo: draft.lote_codigo.trim() || null,
          sort_order: idx,
        };
      });

      setSaving(true);
      try {
        await createRemitoWithSlabsViaRpc({
          supplier_id: supplierId,
          branch_code: branchCode,
          serial_code: serialCode,
          issue_date: issueDate,
          notes: notes || null,
          created_by: userId ?? null,
          lines: payloadLines,
        });
        toast.success("Remito creado y stock actualizado.");
        await reloadChapas();
        await refreshRemitos();
        onOpenChange(false);
      } catch {
        toast.error("No se pudo grabar el remito (¿bultos duplicados o datos inválidos?).");
      } finally {
        setSaving(false);
      }
      return;
    }

    const nuevas: ChapaRow[] = [];
    for (const x of labelLines) {
      const draft = x.draft;
      const qty = parseInt(draft.qty_slabs.replace(/\s/g, ""), 10);
      const largo = Number(draft.largo_cm.replace(",", "."));
      const ancho = Number(draft.ancho_cm.replace(",", "."));
      const ini = parseInt(draft.bulto_inicio.trim().replace(/^#/, ""), 10);
      for (let i = 0; i < qty; i++) {
        const bulto = `#${ini + i}`;
        if (existingBultosLower.has(bulto.toLowerCase())) {
          toast.error(`El bulto ${bulto} ya existe.`);
          return;
        }
        nuevas.push({
          bulto,
          material: x.label,
          largoCm: largo,
          anchoCm: ancho,
          estado: "Disponible",
        });
      }
    }
    setChapas((prev) => [...prev, ...nuevas]);
    toast.success("Demo: placas cargadas al inventario local (sin remito en servidor).");
    onOpenChange(false);
  };

  return (
    <>
      <NuevoProveedorDialog
        open={proveedorDialog}
        onOpenChange={setProveedorDialog}
        onCreated={(id) => {
          void reloadSuppliers().then(() => setSupplierId(id));
        }}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] max-w-[min(64rem,calc(100vw-2rem))] flex-col gap-3 overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0 space-y-1 text-left">
            <DialogTitle>Crear remito</DialogTitle>
            <DialogDescription>
              Registro contenedor desde proveedor. Con Supabase se guardan cabecera, líneas e historial; sin
              conexión, solo se actualiza el inventario local de demostración.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {loadErr ? <p className="text-xs text-destructive">{loadErr}</p> : null}

            <div className="grid gap-3 sm:grid-cols-12">
              <div className="space-y-1.5 sm:col-span-6">
                <Label>N° remito — sucursal</Label>
                <Input
                  placeholder="Ej. 1"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-6">
                <Label>N° remito — serie</Label>
                <Input
                  placeholder="000000"
                  value={serialCode}
                  onChange={(e) => setSerialCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-6">
                <Label>Fecha</Label>
                <div className="relative">
                  <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    className="pr-10"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-6">
                <Label>Proveedor</Label>
                <div className="flex gap-2">
                  <Select
                    value={supplierId || "__none__"}
                    onValueChange={(v) => setSupplierId(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="min-w-0 flex-1">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Seleccionar</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    className="h-10 w-10 shrink-0 bg-sky-600 text-white hover:bg-sky-700"
                    aria-label="Nuevo proveedor"
                    onClick={() => setProveedorDialog(true)}
                    disabled={!isSupabaseConfigured}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-10 w-10 shrink-0 border-amber-500 text-amber-700 hover:bg-amber-50"
                    aria-label="Editar proveedor"
                    disabled
                    title="Disponible en una siguiente versión"
                  >
                    <PenSquare className="h-4 w-4" />
                  </Button>
                </div>
                {!isSupabaseConfigured ? (
                  <p className="text-[11px] text-muted-foreground">
                    Proveedores disponibles cuando Supabase esté configurado.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rem-obs">{`Observación (${notes.length}/${MAX_NOTAS})`}</Label>
              <Textarea
                id="rem-obs"
                placeholder="Observaciones — máximo 200 caracteres"
                className="min-h-[72px] resize-none"
                value={notes}
                maxLength={MAX_NOTAS}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <Table className="min-w-[760px] text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/45 hover:bg-muted/45 [&_th]:py-2">
                    <TableHead className="min-w-[200px]">Material</TableHead>
                    <TableHead className="w-16 whitespace-nowrap">Cant.</TableHead>
                    <TableHead className="w-24 whitespace-nowrap">Largo cm</TableHead>
                    <TableHead className="w-24 whitespace-nowrap">Ancho cm</TableHead>
                    <TableHead className="w-28 whitespace-nowrap">Precio u.</TableHead>
                    <TableHead className="w-28 whitespace-nowrap">N° inicial</TableHead>
                    <TableHead className="w-28 whitespace-nowrap" title="Código de lote del proveedor. No mezclar lotes en una misma OT.">
                      Lote
                    </TableHead>
                    <TableHead className="w-24 whitespace-nowrap text-right">m² total</TableHead>
                    <TableHead className="w-[88px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((ln) => {
                    const qty = parseInt(ln.qty_slabs.replace(/\s/g, ""), 10) || 0;
                    const largo = Number(ln.largo_cm.replace(",", "."));
                    const ancho = Number(ln.ancho_cm.replace(",", "."));
                    const m2tot =
                      Number.isFinite(largo) && Number.isFinite(ancho) && Number.isFinite(qty)
                        ? m2Teoricos(qty, largo, ancho)
                        : 0;

                    const label = ln.material_id
                      ? materiales.find((x) => x.id === ln.material_id)?.name || ""
                      : ln.material_other;

                    return (
                      <TableRow key={ln.key} className="align-top">
                        <TableCell className="py-2">
                          <div className="flex flex-col gap-1">
                            <Select
                              value={ln.material_id ? ln.material_id : "__otro__"}
                              onValueChange={(v) => {
                                if (v === "__otro__") {
                                  setLine(ln.key, { material_id: null });
                                  return;
                                }
                                const m = materiales.find((x) => x.id === v);
                                setLine(ln.key, {
                                  material_id: v,
                                  material_other: m?.name ?? "",
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 text-[11px]">
                                <UserRound className="mr-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                                <SelectValue placeholder="Material" />
                              </SelectTrigger>
                              <SelectContent>
                                {materiales.map((m) => (
                                  <SelectItem key={m.id} value={m.id} className="text-xs">
                                    {m.name}
                                  </SelectItem>
                                ))}
                                <SelectItem value="__otro__" className="text-xs">
                                  Otro (texto libre)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {!ln.material_id ? (
                              <Input
                                className="h-8 text-xs"
                                placeholder="Nombre material"
                                value={ln.material_other}
                                onChange={(e) =>
                                  setLine(ln.key, { material_other: e.target.value })
                                }
                              />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            className="h-8 px-2 text-xs tabular-nums"
                            inputMode="numeric"
                            value={ln.qty_slabs}
                            onChange={(e) => setLine(ln.key, { qty_slabs: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            className="h-8 px-2 text-xs tabular-nums"
                            inputMode="decimal"
                            placeholder="320"
                            value={ln.largo_cm}
                            onChange={(e) => setLine(ln.key, { largo_cm: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            className="h-8 px-2 text-xs tabular-nums"
                            inputMode="decimal"
                            placeholder="160"
                            value={ln.ancho_cm}
                            onChange={(e) => setLine(ln.key, { ancho_cm: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            className="h-8 px-2 text-xs tabular-nums"
                            inputMode="decimal"
                            placeholder="0"
                            value={ln.precio}
                            onChange={(e) => setLine(ln.key, { precio: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            className="h-8 px-2 text-xs tabular-nums"
                            inputMode="numeric"
                            placeholder="9001"
                            value={ln.bulto_inicio}
                            onChange={(e) => setLine(ln.key, { bulto_inicio: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            className="h-8 px-2 text-xs"
                            placeholder="Ej. L-240501"
                            title="Código de lote del proveedor"
                            value={ln.lote_codigo}
                            onChange={(e) => setLine(ln.key, { lote_codigo: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-2 text-right font-semibold tabular-nums text-muted-foreground">
                          {label
                            ? m2tot.toLocaleString("es-AR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 3,
                              })
                            : "–"}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex flex-col items-stretch gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 border-destructive/40 px-2 text-destructive"
                              onClick={() => removeLine(ln.key)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-sky-700"
                              onClick={() => duplicateLine(ln)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-center">
              <Button
                type="button"
                className="h-9 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={addLine}
              >
                <Plus className="h-4 w-4" />
                Agregar ítem
              </Button>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border pt-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button type="button" onClick={handleGrabar} disabled={saving}>
              Grabar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
