"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Plus, Trash2 } from "lucide-react";
import type { MaterialOption, ModoMedidasRemito, OrigenPlaca } from "@/lib/stock-api";
import {
  fetchSuppliers,
  type SupplierRow,
} from "@/lib/suppliers-api";
import {
  createRemitoWithSlabsViaRpc,
  type ChapaRow,
} from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ProveedorFormDialog } from "@/components/proveedores/ProveedorFormDialog";
import { toast } from "sonner";

const MAX_NOTAS = 200;

type MedidaDraft = {
  key: string;
  largo_cm: string;
  ancho_cm: string;
};

type LineDraft = {
  key: string;
  material_id: string | null;
  material_other: string;
  otro: boolean;
  modo_medidas: ModoMedidasRemito;
  qty_slabs: string;
  largo_cm: string;
  ancho_cm: string;
  medidas: MedidaDraft[];
  bulto_inicio: string;
  precio: string;
  lote_codigo: string;
};

function newLineKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `l-${Math.random().toString(36).slice(2)}`;
}

function blankMedida(): MedidaDraft {
  return { key: newLineKey(), largo_cm: "", ancho_cm: "" };
}

function blankLine(): LineDraft {
  return {
    key: newLineKey(),
    material_id: null,
    material_other: "",
    otro: false,
    modo_medidas: "iguales",
    qty_slabs: "1",
    largo_cm: "",
    ancho_cm: "",
    medidas: [blankMedida()],
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
    !Number.isFinite(anchoCm) ||
    anchoCm <= 0
  ) {
    return 0;
  }
  return (largoCm / 100) * (anchoCm / 100) * qty;
}

function m2MedidasDistintas(medidas: MedidaDraft[]): number {
  let total = 0;
  for (const m of medidas) {
    const largo = Number(m.largo_cm.replace(",", "."));
    const ancho = Number(m.ancho_cm.replace(",", "."));
    if (Number.isFinite(largo) && largo > 0 && Number.isFinite(ancho) && ancho > 0) {
      total += (largo / 100) * (ancho / 100);
    }
  }
  return total;
}

function m2Linea(ln: LineDraft): number {
  if (ln.modo_medidas === "distintas") return m2MedidasDistintas(ln.medidas);
  const qty = parseInt(ln.qty_slabs.replace(/\s/g, ""), 10) || 0;
  const largo = Number(ln.largo_cm.replace(",", "."));
  const ancho = Number(ln.ancho_cm.replace(",", "."));
  return m2Teoricos(qty, largo, ancho);
}

function formatM2(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
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
  initialSupplierId?: string;
  initialOrigen?: OrigenPlaca;
  importacionId?: string | null;
  onSaved?: () => void;
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
  initialSupplierId,
  initialOrigen,
  importacionId,
  onSaved,
}: CrearRemitoDialogProps) {
  const [proveedorDialog, setProveedorDialog] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [branchCode, setBranchCode] = useState("");
  const [serialCode, setSerialCode] = useState("000000");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [origenPlaca, setOrigenPlaca] = useState<OrigenPlaca>("nacional");
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

  const sortedSuppliers = useMemo(() => {
    const placasRubros = ["placas_naturales", "placas_industriales"];
    return [...suppliers].sort((a, b) => {
      const aMatch = (a.rubros ?? []).some((r: string) => placasRubros.includes(r)) ? 0 : 1;
      const bMatch = (b.rubros ?? []).some((r: string) => placasRubros.includes(r)) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.name.localeCompare(b.name, "es");
    });
  }, [suppliers]);

  useEffect(() => {
    if (!open) return;
    void reloadSuppliers();
  }, [open, reloadSuppliers]);

  useEffect(() => {
    if (!open) return;
    setLines([blankLine()]);
    setNotes("");
    setBranchCode("");
    setSupplierId(initialSupplierId ?? "");
    setOrigenPlaca(initialOrigen ?? "nacional");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setSerialCode("000000");
  }, [open, initialSupplierId, initialOrigen]);

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

  const patchLine = useCallback((idx: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const setMedidaAt = useCallback(
    (lineIdx: number, medidaKey: string, patch: Partial<MedidaDraft>) => {
      setLines((prev) =>
        prev.map((r, i) =>
          i === lineIdx
            ? {
                ...r,
                medidas: r.medidas.map((m) => (m.key === medidaKey ? { ...m, ...patch } : m)),
              }
            : r,
        ),
      );
    },
    [],
  );

  const addMedidaAt = useCallback((lineIdx: number) => {
    setLines((prev) =>
      prev.map((r, i) =>
        i === lineIdx ? { ...r, medidas: [...r.medidas, blankMedida()] } : r,
      ),
    );
  }, []);

  const removeMedidaAt = useCallback((lineIdx: number, medidaKey: string) => {
    setLines((prev) =>
      prev.map((r, i) => {
        if (i !== lineIdx) return r;
        if (r.medidas.length <= 1) return r;
        return { ...r, medidas: r.medidas.filter((m) => m.key !== medidaKey) };
      }),
    );
  }, []);

  const removeLineAt = useCallback((idx: number) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const materialSelectValue = (ln: LineDraft) =>
    ln.material_id || (ln.otro ? "__otro__" : undefined);

  const handleGrabar = async () => {
    if (isSupabaseConfigured && !supplierId) {
      toast.error("Seleccioná un proveedor o creá uno nuevo.");
      return;
    }
    if (!issueDate) {
      toast.error("Indicá la fecha del remito.");
      return;
    }
    if (notes.length > MAX_NOTAS) {
      toast.error(`Observación: máximo ${MAX_NOTAS} caracteres.`);
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const d = lines[i]!;
      const label = materialLabelForLine(d);
      if (!label) {
        toast.error(`Línea ${i + 1}: definí el material.`);
        return;
      }
      const ini = parseInt(d.bulto_inicio.trim().replace(/^#/, ""), 10);
      if (!Number.isFinite(ini) || ini < 1) {
        toast.error(`Línea ${i + 1}: bulto inicial inválido.`);
        return;
      }
      if (!d.lote_codigo.trim()) {
        toast.error(`Línea ${i + 1}: el lote es obligatorio.`);
        return;
      }
      if (d.modo_medidas === "iguales") {
        const qty = parseInt(d.qty_slabs.replace(/\s/g, ""), 10);
        const largo = Number(d.largo_cm.replace(",", "."));
        const ancho = Number(d.ancho_cm.replace(",", "."));
        if (!Number.isFinite(qty) || qty < 1 || !(largo > 0) || !(ancho > 0)) {
          toast.error(`Línea ${i + 1}: revisá cantidad y medidas.`);
          return;
        }
      } else {
        for (const m of d.medidas) {
          const largo = Number(m.largo_cm.replace(",", "."));
          const ancho = Number(m.ancho_cm.replace(",", "."));
          if (!(largo > 0) || !(ancho > 0)) {
            toast.error(`Línea ${i + 1}: hay placas sin medida.`);
            return;
          }
        }
      }
    }

    const labelLines = lines.map((d) => ({
      draft: d,
      label: materialLabelForLine(d),
    }));

    if (isSupabaseConfigured) {
      const payloadLines = labelLines.map((x, idx) => {
        const draft = x.draft;
        const ini = parseInt(draft.bulto_inicio.trim().replace(/^#/, ""), 10);
        const pu =
          draft.precio.trim() === "" ? null : Number(draft.precio.replace(",", "."));

        if (draft.modo_medidas === "distintas") {
          const medidas = draft.medidas.map((m) => ({
            largo_cm: Number(m.largo_cm.replace(",", ".")),
            ancho_cm: Number(m.ancho_cm.replace(",", ".")),
          }));
          return {
            material_id: draft.material_id,
            material_label: x.label,
            qty_slabs: medidas.length,
            bulto_numero_inicio: ini,
            precio_unitario: pu !== null && Number.isFinite(pu) ? pu : null,
            lote_codigo: draft.lote_codigo.trim(),
            origen_placa: origenPlaca,
            sort_order: idx,
            modo_medidas: "distintas" as const,
            medidas,
          };
        }

        const qty = parseInt(draft.qty_slabs.replace(/\s/g, ""), 10);
        return {
          material_id: draft.material_id,
          material_label: x.label,
          qty_slabs: qty,
          largo_cm: Number(draft.largo_cm.replace(",", ".")),
          ancho_cm: Number(draft.ancho_cm.replace(",", ".")),
          bulto_numero_inicio: ini,
          precio_unitario: pu !== null && Number.isFinite(pu) ? pu : null,
          lote_codigo: draft.lote_codigo.trim(),
          origen_placa: origenPlaca,
          sort_order: idx,
          modo_medidas: "iguales" as const,
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
          origen_placa: origenPlaca,
          created_by: userId ?? null,
          importacion_id: importacionId ?? null,
          lines: payloadLines,
        });
        toast.success("Ingreso guardado. Chapas disponibles en inventario.");
        await reloadChapas();
        await refreshRemitos();
        onSaved?.();
        onOpenChange(false);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "No se pudo guardar (¿bultos duplicados o datos inválidos?).",
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    const nuevas: ChapaRow[] = [];
    for (const x of labelLines) {
      const draft = x.draft;
      const ini = parseInt(draft.bulto_inicio.trim().replace(/^#/, ""), 10);
      if (draft.modo_medidas === "distintas") {
        for (let i = 0; i < draft.medidas.length; i++) {
          const m = draft.medidas[i]!;
          const bulto = `#${ini + i}`;
          if (existingBultosLower.has(bulto.toLowerCase())) {
            toast.error(`El bulto ${bulto} ya existe.`);
            return;
          }
          nuevas.push({
            bulto,
            material: x.label,
            largoCm: Number(m.largo_cm.replace(",", ".")),
            anchoCm: Number(m.ancho_cm.replace(",", ".")),
            estado: "Disponible",
            loteCodigo: draft.lote_codigo.trim(),
            origenPlaca: origenPlaca,
          });
        }
      } else {
        const qty = parseInt(draft.qty_slabs.replace(/\s/g, ""), 10);
        const largo = Number(draft.largo_cm.replace(",", "."));
        const ancho = Number(draft.ancho_cm.replace(",", "."));
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
            loteCodigo: draft.lote_codigo.trim(),
            origenPlaca: origenPlaca,
          });
        }
      }
    }
    setChapas((prev) => [...prev, ...nuevas]);
    toast.success("Demo: chapas cargadas al inventario local.");
    onOpenChange(false);
  };

  return (
    <>
      <ProveedorFormDialog
        open={proveedorDialog}
        onOpenChange={setProveedorDialog}
        onSaved={(s) => {
          void reloadSuppliers().then(() => setSupplierId(s.id));
        }}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(40rem,94vh)] w-full max-w-[min(28rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 space-y-0 border-b border-border px-4 pb-2.5 pt-4 pr-12 text-left sm:px-5">
            <DialogTitle>Cargar chapas</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
            {loadErr ? <p className="text-xs text-destructive">{loadErr}</p> : null}

            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <div className="flex gap-2">
                <Select
                  value={supplierId || undefined}
                  onValueChange={setSupplierId}
                >
                  <SelectTrigger className="min-w-0 flex-1">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Nuevo proveedor"
                  onClick={() => setProveedorDialog(true)}
                  disabled={!isSupabaseConfigured}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <FechaInput value={issueDate} onChange={setIssueDate} />
              </div>
              <div className="space-y-1.5">
                <Label>Origen</Label>
                <Select
                  value={origenPlaca}
                  onValueChange={(v) => setOrigenPlaca(v as OrigenPlaca)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nacional">Nacional</SelectItem>
                    <SelectItem value="importado">Importado</SelectItem>
                    <SelectItem value="cantera">Cantera</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>N° remito — sucursal</Label>
                <Input
                  placeholder="Ej. 1"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>N° remito — serie</Label>
                <Input
                  placeholder="000000"
                  value={serialCode}
                  onChange={(e) => setSerialCode(e.target.value)}
                />
              </div>
            </div>

            {lines.map((ln, idx) => {
              const m2tot = m2Linea(ln);
              return (
                <div key={ln.key} className="space-y-3">
                  {lines.length > 1 ? (
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-sm font-medium">Material {idx + 1}</p>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeLineAt(idx)}
                        title="Quitar material"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <Label>Material</Label>
                    <Select
                      value={materialSelectValue(ln)}
                      onValueChange={(v) => {
                        if (v === "__otro__") {
                          patchLine(idx, { material_id: null, material_other: "", otro: true });
                          return;
                        }
                        const m = materiales.find((x) => x.id === v);
                        patchLine(idx, {
                          material_id: v,
                          material_other: m?.name ?? "",
                          otro: false,
                        });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Elegir material…" />
                      </SelectTrigger>
                      <SelectContent>
                        {materiales.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__otro__">Otro (escribir nombre)</SelectItem>
                      </SelectContent>
                    </Select>
                    {ln.otro ? (
                      <Input
                        placeholder="Nombre del material"
                        value={ln.material_other}
                        onChange={(e) => patchLine(idx, { material_other: e.target.value })}
                      />
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Lote *</Label>
                      <Input
                        placeholder="Código de lote"
                        value={ln.lote_codigo}
                        onChange={(e) => patchLine(idx, { lote_codigo: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>N° bulto inicial</Label>
                      <Input
                        inputMode="numeric"
                        placeholder="9001"
                        value={ln.bulto_inicio}
                        onChange={(e) => patchLine(idx, { bulto_inicio: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Modo de medidas</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={ln.modo_medidas === "iguales" ? "default" : "outline"}
                        className="h-auto flex-col items-start gap-0 px-3 py-2 text-left"
                        onClick={() => patchLine(idx, { modo_medidas: "iguales" })}
                      >
                        <span className="text-sm font-medium">Iguales</span>
                        <span className="text-[10px] font-normal opacity-80">
                          China / sintético
                        </span>
                      </Button>
                      <Button
                        type="button"
                        variant={ln.modo_medidas === "distintas" ? "default" : "outline"}
                        className="h-auto flex-col items-start gap-0 px-3 py-2 text-left"
                        onClick={() => patchLine(idx, { modo_medidas: "distintas" })}
                      >
                        <span className="text-sm font-medium">Distintas</span>
                        <span className="text-[10px] font-normal opacity-80">
                          Cada placa su medida
                        </span>
                      </Button>
                    </div>
                  </div>

                  {ln.modo_medidas === "iguales" ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                          <Label>Cantidad</Label>
                          <Input
                            inputMode="numeric"
                            value={ln.qty_slabs}
                            onChange={(e) => patchLine(idx, { qty_slabs: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Largo (cm)</Label>
                          <Input
                            inputMode="decimal"
                            placeholder="320"
                            value={ln.largo_cm}
                            onChange={(e) => patchLine(idx, { largo_cm: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Ancho (cm)</Label>
                          <Input
                            inputMode="decimal"
                            placeholder="160"
                            value={ln.ancho_cm}
                            onChange={(e) => patchLine(idx, { ancho_cm: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">m² totales</Label>
                        <p className="text-sm font-semibold tabular-nums">
                          {m2tot > 0 ? formatM2(m2tot) : "—"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <Label>Medida por placa (cm)</Label>
                          <p className="text-[11px] text-muted-foreground">
                            Centímetros. Ej.: 320 × 160 → 5,12 m²
                          </p>
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {ln.medidas.length} placa
                          {ln.medidas.length === 1 ? "" : "s"}
                          {m2tot > 0 ? ` · ${formatM2(m2tot)} m²` : ""}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {ln.medidas.map((m, mi) => {
                          const largo = Number(m.largo_cm.replace(",", "."));
                          const ancho = Number(m.ancho_cm.replace(",", "."));
                          const m2Placa =
                            Number.isFinite(largo) &&
                            largo > 0 &&
                            Number.isFinite(ancho) &&
                            ancho > 0
                              ? (largo / 100) * (ancho / 100)
                              : 0;
                          return (
                            <div key={m.key} className="flex items-end gap-2">
                              <span className="mb-2 w-5 shrink-0 text-xs text-muted-foreground tabular-nums">
                                {mi + 1}.
                              </span>
                              <div className="grid min-w-0 flex-1 grid-cols-[1fr_1fr_auto] gap-2">
                                <div className="space-y-1">
                                  {mi === 0 ? <Label className="text-xs">Largo (cm)</Label> : null}
                                  <Input
                                    inputMode="decimal"
                                    placeholder="320"
                                    value={m.largo_cm}
                                    onChange={(e) =>
                                      setMedidaAt(idx, m.key, { largo_cm: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  {mi === 0 ? <Label className="text-xs">Ancho (cm)</Label> : null}
                                  <Input
                                    inputMode="decimal"
                                    placeholder="160"
                                    value={m.ancho_cm}
                                    onChange={(e) =>
                                      setMedidaAt(idx, m.key, { ancho_cm: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="mb-2 w-14 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                                  {m2Placa > 0 ? `${formatM2(m2Placa)} m²` : "—"}
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="mb-0.5 h-10 w-10 shrink-0 text-destructive"
                                disabled={ln.medidas.length <= 1}
                                onClick={() => removeMedidaAt(idx, m.key)}
                                title="Quitar placa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-1 border-dashed"
                        onClick={() => addMedidaAt(idx)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar otra placa
                      </Button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>Precio unitario (opcional)</Label>
                    <Input
                      inputMode="decimal"
                      placeholder="0"
                      value={ln.precio}
                      onChange={(e) => patchLine(idx, { precio: e.target.value })}
                    />
                  </div>
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1 border-dashed"
              onClick={() => setLines((prev) => [...prev, blankLine()])}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar otro material
            </Button>

            <div className="space-y-1.5">
              <Label htmlFor="rem-obs">Observación (opcional)</Label>
              <Textarea
                id="rem-obs"
                placeholder={`Máximo ${MAX_NOTAS} caracteres`}
                className="min-h-[56px] resize-none"
                value={notes}
                maxLength={MAX_NOTAS}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-between sm:space-x-0 sm:px-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleGrabar()} disabled={saving}>
              {saving ? "Guardando…" : "Guardar ingreso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
