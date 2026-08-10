"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { MaterialOption, ModoMedidasRemito, OrigenPlaca } from "@/lib/stock-api";
import {
  fetchSuppliers,
  createRemitoWithSlabsViaRpc,
  type SupplierRow,
  type ChapaRow,
} from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { NuevoProveedorDialog } from "./NuevoProveedorDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_NOTAS = 200;

const PASOS = [
  { kicker: "Remito", subtitle: "Proveedor y origen" },
  { kicker: "Material", subtitle: "Lote y modo" },
  { kicker: "Medidas", subtitle: "Cantidad o por placa" },
  { kicker: "Confirmar", subtitle: "Revisar y guardar" },
] as const;

type MedidaDraft = {
  key: string;
  largo_cm: string;
  ancho_cm: string;
};

type LineDraft = {
  key: string;
  material_id: string | null;
  material_other: string;
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

function qtyLinea(ln: LineDraft): number {
  if (ln.modo_medidas === "distintas") return ln.medidas.length;
  return parseInt(ln.qty_slabs.replace(/\s/g, ""), 10) || 0;
}

function formatM2(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function etiquetaOrigen(o: OrigenPlaca): string {
  switch (o) {
    case "importado":
      return "Importado";
    case "cantera":
      return "Cantera";
    case "otro":
      return "Otro";
    default:
      return "Nacional";
  }
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
  const [origenPlaca, setOrigenPlaca] = useState<OrigenPlaca>("nacional");
  const [lines, setLines] = useState<LineDraft[]>(() => [blankLine()]);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [step, setStep] = useState(0);
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
    setActiveLineIdx(0);
    setStep(0);
    setNotes("");
    setBranchCode("");
    setSupplierId("");
    setOrigenPlaca("nacional");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setSerialCode("000000");
  }, [open]);

  const activeLine = lines[activeLineIdx] ?? lines[0]!;

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

  const setActiveLine = useCallback(
    (patch: Partial<LineDraft>) => {
      setLines((prev) =>
        prev.map((r, i) => (i === activeLineIdx ? { ...r, ...patch } : r)),
      );
    },
    [activeLineIdx],
  );

  const setMedida = useCallback(
    (medidaKey: string, patch: Partial<MedidaDraft>) => {
      setLines((prev) =>
        prev.map((r, i) =>
          i === activeLineIdx
            ? {
                ...r,
                medidas: r.medidas.map((m) => (m.key === medidaKey ? { ...m, ...patch } : m)),
              }
            : r,
        ),
      );
    },
    [activeLineIdx],
  );

  const addMedida = useCallback(() => {
    setLines((prev) =>
      prev.map((r, i) =>
        i === activeLineIdx ? { ...r, medidas: [...r.medidas, blankMedida()] } : r,
      ),
    );
  }, [activeLineIdx]);

  const removeMedida = useCallback(
    (medidaKey: string) => {
      setLines((prev) =>
        prev.map((r, i) => {
          if (i !== activeLineIdx) return r;
          if (r.medidas.length <= 1) return r;
          return { ...r, medidas: r.medidas.filter((m) => m.key !== medidaKey) };
        }),
      );
    },
    [activeLineIdx],
  );

  const removeLineAt = useCallback((idx: number) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
    setActiveLineIdx((cur) => {
      if (idx < cur) return cur - 1;
      if (idx === cur) return Math.max(0, cur - 1);
      return cur;
    });
  }, []);

  const supplierName = useMemo(
    () => suppliers.find((s) => s.id === supplierId)?.name ?? null,
    [suppliers, supplierId],
  );

  const totalM2 = useMemo(() => lines.reduce((acc, ln) => acc + m2Linea(ln), 0), [lines]);
  const totalPlacas = useMemo(() => lines.reduce((acc, ln) => acc + qtyLinea(ln), 0), [lines]);

  const validateStep = (s: number): boolean => {
    if (s === 0) {
      if (isSupabaseConfigured && !supplierId) {
        toast.error("Seleccioná un proveedor o creá uno nuevo.");
        return false;
      }
      if (!issueDate) {
        toast.error("Indicá la fecha del remito.");
        return false;
      }
      if (notes.length > MAX_NOTAS) {
        toast.error(`Observación: máximo ${MAX_NOTAS} caracteres.`);
        return false;
      }
      return true;
    }

    if (s === 1) {
      const label = materialLabelForLine(activeLine);
      if (!label) {
        toast.error("Definí el material.");
        return false;
      }
      if (!activeLine.lote_codigo.trim()) {
        toast.error("El lote es obligatorio.");
        return false;
      }
      const ini = parseInt(activeLine.bulto_inicio.trim().replace(/^#/, ""), 10);
      if (!Number.isFinite(ini) || ini < 1) {
        toast.error("Indicá el N° de bulto inicial (entero positivo).");
        return false;
      }
      return true;
    }

    if (s === 2) {
      if (activeLine.modo_medidas === "iguales") {
        const qty = parseInt(activeLine.qty_slabs.replace(/\s/g, ""), 10);
        const largo = Number(activeLine.largo_cm.replace(",", "."));
        const ancho = Number(activeLine.ancho_cm.replace(",", "."));
        if (!Number.isFinite(qty) || qty < 1) {
          toast.error("Cantidad de chapas inválida.");
          return false;
        }
        if (!Number.isFinite(largo) || largo <= 0 || !Number.isFinite(ancho) || ancho <= 0) {
          toast.error("Largo y ancho deben ser mayores a 0.");
          return false;
        }
      } else {
        if (activeLine.medidas.length < 1) {
          toast.error("Agregá al menos una placa con medida.");
          return false;
        }
        for (const m of activeLine.medidas) {
          const largo = Number(m.largo_cm.replace(",", "."));
          const ancho = Number(m.ancho_cm.replace(",", "."));
          if (!Number.isFinite(largo) || largo <= 0 || !Number.isFinite(ancho) || ancho <= 0) {
            toast.error("Cada placa necesita largo y ancho en cm (mayores a 0).");
            return false;
          }
        }
      }
      return true;
    }

    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(PASOS.length - 1, s + 1));
  };

  const goBack = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  const startAnotherLine = () => {
    setLines((prev) => [...prev, blankLine()]);
    setActiveLineIdx(lines.length);
    setStep(1);
  };

  const editLine = (idx: number) => {
    setActiveLineIdx(idx);
    setStep(1);
  };

  const handleGrabar = async () => {
    for (let i = 0; i < lines.length; i++) {
      setActiveLineIdx(i);
      // validate using the line at i directly
      const d = lines[i]!;
      const label = materialLabelForLine(d);
      if (!label) {
        toast.error(`Línea ${i + 1}: definí el material.`);
        setStep(1);
        return;
      }
      const ini = parseInt(d.bulto_inicio.trim().replace(/^#/, ""), 10);
      if (!Number.isFinite(ini) || ini < 1) {
        toast.error(`Línea ${i + 1}: bulto inicial inválido.`);
        setActiveLineIdx(i);
        setStep(1);
        return;
      }
      if (!d.lote_codigo.trim()) {
        toast.error(`Línea ${i + 1}: el lote es obligatorio.`);
        setActiveLineIdx(i);
        setStep(1);
        return;
      }
      if (d.modo_medidas === "iguales") {
        const qty = parseInt(d.qty_slabs.replace(/\s/g, ""), 10);
        const largo = Number(d.largo_cm.replace(",", "."));
        const ancho = Number(d.ancho_cm.replace(",", "."));
        if (!Number.isFinite(qty) || qty < 1 || !(largo > 0) || !(ancho > 0)) {
          toast.error(`Línea ${i + 1}: revisá cantidad y medidas.`);
          setActiveLineIdx(i);
          setStep(2);
          return;
        }
      } else {
        for (const m of d.medidas) {
          const largo = Number(m.largo_cm.replace(",", "."));
          const ancho = Number(m.ancho_cm.replace(",", "."));
          if (!(largo > 0) || !(ancho > 0)) {
            toast.error(`Línea ${i + 1}: hay placas sin medida.`);
            setActiveLineIdx(i);
            setStep(2);
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
      if (!supplierId) {
        toast.error("Seleccioná un proveedor o creá uno nuevo.");
        setStep(0);
        return;
      }

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
          lines: payloadLines,
        });
        toast.success("Ingreso guardado. Chapas disponibles en inventario.");
        await reloadChapas();
        await refreshRemitos();
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

  const m2tot = m2Linea(activeLine);

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
        <DialogContent className="flex max-h-[min(40rem,94vh)] w-full max-w-[min(28rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 space-y-2 border-b border-border px-4 pb-2.5 pt-4 pr-12 text-left sm:px-5">
            <DialogTitle>Cargar chapas</DialogTitle>
            <nav aria-label="Progreso del ingreso">
              <ol className="flex items-center gap-1">
                {PASOS.map((p, idx) => {
                  const estado = idx < step ? "done" : idx === step ? "current" : "todo";
                  return (
                    <li key={p.kicker} className="flex min-w-0 flex-1 items-center gap-1">
                      <div className="flex min-w-0 flex-col items-center gap-0.5">
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums",
                            estado === "current" &&
                              "border-primary bg-primary text-primary-foreground",
                            estado === "done" &&
                              "border-emerald-600 bg-emerald-600 text-white",
                            estado === "todo" &&
                              "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
                          )}
                          aria-current={estado === "current" ? "step" : undefined}
                        >
                          {idx + 1}
                        </span>
                        <span
                          className={cn(
                            "truncate text-[10px] font-medium",
                            estado === "current" ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {p.kicker}
                        </span>
                      </div>
                      {idx < PASOS.length - 1 ? (
                        <div
                          className={cn(
                            "mb-3.5 h-px min-w-[0.5rem] flex-1",
                            idx < step ? "bg-emerald-600" : "bg-border",
                          )}
                          aria-hidden
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                Paso {step + 1} de {PASOS.length} — {PASOS[step]!.subtitle}
                {step >= 1 && step <= 2 && lines.length > 1
                  ? ` · Material ${activeLineIdx + 1}/${lines.length}`
                  : ""}
              </p>
            </nav>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
            {loadErr ? <p className="mb-3 text-xs text-destructive">{loadErr}</p> : null}

            {step === 0 ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
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
            ) : null}

            {step === 1 ? (
              <div className="space-y-2.5">
                <div className="space-y-1.5">
                  <Label>Material</Label>
                  <Select
                    value={activeLine.material_id ? activeLine.material_id : "__otro__"}
                    onValueChange={(v) => {
                      if (v === "__otro__") {
                        setActiveLine({ material_id: null });
                        return;
                      }
                      const m = materiales.find((x) => x.id === v);
                      setActiveLine({
                        material_id: v,
                        material_other: m?.name ?? "",
                      });
                    }}
                  >
                    <SelectTrigger>
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
                  {!activeLine.material_id ? (
                    <Input
                      placeholder="Nombre del material"
                      value={activeLine.material_other}
                      onChange={(e) => setActiveLine({ material_other: e.target.value })}
                    />
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label>Modo de medidas</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={activeLine.modo_medidas === "iguales" ? "default" : "outline"}
                      className="h-auto flex-col items-start gap-0 px-3 py-2 text-left"
                      onClick={() => setActiveLine({ modo_medidas: "iguales" })}
                    >
                      <span className="text-sm font-medium">Iguales</span>
                      <span className="text-[10px] font-normal opacity-80">
                        China / sintético
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant={activeLine.modo_medidas === "distintas" ? "default" : "outline"}
                      className="h-auto flex-col items-start gap-0 px-3 py-2 text-left"
                      onClick={() => setActiveLine({ modo_medidas: "distintas" })}
                    >
                      <span className="text-sm font-medium">Distintas</span>
                      <span className="text-[10px] font-normal opacity-80">
                        Cada placa su medida
                      </span>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Lote *</Label>
                    <Input
                      placeholder="Código de lote"
                      value={activeLine.lote_codigo}
                      onChange={(e) => setActiveLine({ lote_codigo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>N° bulto inicial</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="9001"
                      value={activeLine.bulto_inicio}
                      onChange={(e) => setActiveLine({ bulto_inicio: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Precio unitario (opcional)</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0"
                    value={activeLine.precio}
                    onChange={(e) => setActiveLine({ precio: e.target.value })}
                  />
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {materialLabelForLine(activeLine) || "Material"}
                  </span>
                  {" · "}
                  lote {activeLine.lote_codigo || "—"}
                  {" · "}
                  {activeLine.modo_medidas === "iguales" ? "medidas iguales" : "medidas distintas"}
                </div>

                {activeLine.modo_medidas === "iguales" ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1.5">
                        <Label>Cantidad</Label>
                        <Input
                          inputMode="numeric"
                          value={activeLine.qty_slabs}
                          onChange={(e) => setActiveLine({ qty_slabs: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Largo (cm)</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="320"
                          value={activeLine.largo_cm}
                          onChange={(e) => setActiveLine({ largo_cm: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Ancho (cm)</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="160"
                          value={activeLine.ancho_cm}
                          onChange={(e) => setActiveLine({ ancho_cm: e.target.value })}
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
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <Label>Medida por placa (cm)</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Centímetros. Ej.: 320 × 160 → 5,12 m²
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {activeLine.medidas.length} placa
                        {activeLine.medidas.length === 1 ? "" : "s"}
                        {m2tot > 0 ? ` · ${formatM2(m2tot)} m²` : ""}
                      </span>
                    </div>
                    <div className="min-h-0 max-h-[14rem] space-y-2 overflow-y-auto pr-0.5">
                      {activeLine.medidas.map((m, mi) => {
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
                                  setMedida(m.key, { largo_cm: e.target.value })
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
                                  setMedida(m.key, { ancho_cm: e.target.value })
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
                            disabled={activeLine.medidas.length <= 1}
                            onClick={() => removeMedida(m.key)}
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
                      onClick={addMedida}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar otra placa
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <p className="font-medium text-foreground">
                    {supplierName ?? (isSupabaseConfigured ? "Sin proveedor" : "Demo local")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {issueDate}
                    {branchCode || serialCode
                      ? ` · ${branchCode || "—"}-${serialCode || "—"}`
                      : ""}
                    {" · "}
                    {etiquetaOrigen(origenPlaca)}
                  </p>
                  {notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">Obs.: {notes}</p>
                  ) : null}
                  <p className="mt-2 text-xs font-medium text-foreground">
                    {totalPlacas} placa{totalPlacas === 1 ? "" : "s"} · {formatM2(totalM2)} m²
                  </p>
                </div>

                <ul className="space-y-2">
                  {lines.map((ln, idx) => {
                    const label = materialLabelForLine(ln) || `Material ${idx + 1}`;
                    const q = qtyLinea(ln);
                    const m2 = m2Linea(ln);
                    return (
                      <li
                        key={ln.key}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{label}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                            {ln.modo_medidas === "distintas"
                              ? `${q} chapas · medidas variables`
                              : `${q} × ${ln.largo_cm} × ${ln.ancho_cm} cm`}
                            {m2 > 0 ? ` → ${formatM2(m2)} m²` : ""}
                            {ln.lote_codigo ? ` · lote ${ln.lote_codigo}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-0.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            onClick={() => editLine(idx)}
                          >
                            Editar
                          </Button>
                          {lines.length > 1 ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeLineAt(idx)}
                              title="Quitar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1 border-dashed"
                  onClick={startAnotherLine}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar otro material
                </Button>
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-between sm:space-x-0 sm:px-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => (step === 0 ? onOpenChange(false) : goBack())}
              disabled={saving}
            >
              {step === 0 ? (
                "Cancelar"
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  Atrás
                </>
              )}
            </Button>
            {step < PASOS.length - 1 ? (
              <Button type="button" onClick={goNext}>
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={() => void handleGrabar()} disabled={saving}>
                {saving ? "Guardando…" : "Guardar ingreso"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
