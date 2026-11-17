"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  espesor_cm: string;
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
  espesor_cm: string;
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
  return { key: newLineKey(), largo_cm: "", ancho_cm: "", espesor_cm: "" };
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
    espesor_cm: "",
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

const M2_PLACA_MIN = 1;
const M2_PLACA_MAX = 12;

function parseCm(raw: string): number {
  return Number(raw.replace(",", "."));
}

function m2Placa(largoCm: number, anchoCm: number): number {
  if (!(largoCm > 0) || !(anchoCm > 0)) return 0;
  return (largoCm / 100) * (anchoCm / 100);
}

function m2PlacaFueraDeRango(m2: number): boolean {
  return m2 > 0 && (m2 < M2_PLACA_MIN || m2 > M2_PLACA_MAX);
}

/** Parte `R-01123-00009833` o `01123-00009833` en punto de venta y número. */
function parseRemitoNumero(raw: string): { branch: string; serial: string } | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(?:[A-Za-z]+[\s-]*)?(\d{1,8})[\s\-./]+(\d{1,12})\s*$/);
  if (!m) return null;
  return { branch: m[1]!, serial: m[2]! };
}

function composeRemitoNotes(pedido: string, notes: string): string | null {
  const p = pedido.trim();
  const n = notes.trim();
  if (p && n) return `Pedido: ${p} — ${n}`;
  if (p) return `Pedido: ${p}`;
  if (n) return n;
  return null;
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
  const navigate = useNavigate();
  const [proveedorDialog, setProveedorDialog] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [branchCode, setBranchCode] = useState("");
  const [serialCode, setSerialCode] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pedidoProveedor, setPedidoProveedor] = useState("");
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
    setPedidoProveedor("");
    setBranchCode("");
    setSupplierId(initialSupplierId ?? "");
    setOrigenPlaca(initialOrigen ?? "nacional");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setSerialCode("");
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

  const applyRemitoNumero = useCallback((raw: string, field: "branch" | "serial") => {
    const parsed = parseRemitoNumero(raw);
    if (parsed) {
      setBranchCode(parsed.branch);
      setSerialCode(parsed.serial);
      return;
    }
    if (field === "branch") setBranchCode(raw);
    else setSerialCode(raw);
  }, []);

  const handleGrabar = async () => {
    if (isSupabaseConfigured && !supplierId) {
      toast.error("Seleccioná un proveedor o creá uno nuevo.");
      return;
    }
    if (!issueDate) {
      toast.error("Indicá la fecha del remito.");
      return;
    }
    const composedNotes = composeRemitoNotes(pedidoProveedor, notes);
    if ((composedNotes?.length ?? 0) > MAX_NOTAS) {
      toast.error(`Observación: máximo ${MAX_NOTAS} caracteres (incluye el pedido).`);
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
        const largo = parseCm(d.largo_cm);
        const ancho = parseCm(d.ancho_cm);
        if (!Number.isFinite(qty) || qty < 1 || !(largo > 0) || !(ancho > 0)) {
          toast.error(`Línea ${i + 1}: revisá cantidad y medidas.`);
          return;
        }
        const m2una = m2Placa(largo, ancho);
        if (m2PlacaFueraDeRango(m2una)) {
          toast.error(
            `Línea ${i + 1}: cada placa da ${formatM2(m2una)} m². Si el remito está en metros (2,830 × 1,890), cargá 283 y 189.`,
          );
          return;
        }
      } else {
        for (const m of d.medidas) {
          const largo = parseCm(m.largo_cm);
          const ancho = parseCm(m.ancho_cm);
          if (!(largo > 0) || !(ancho > 0)) {
            toast.error(`Línea ${i + 1}: hay placas sin medida.`);
            return;
          }
          const m2una = m2Placa(largo, ancho);
          if (m2PlacaFueraDeRango(m2una)) {
            toast.error(
              `Línea ${i + 1}: hay una placa de ${formatM2(m2una)} m². Si el remito está en metros (2,830 × 1,890), cargá 283 y 189.`,
            );
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
          const medidas = draft.medidas.map((m) => {
            const esp = m.espesor_cm.trim() ? Number(m.espesor_cm.replace(",", ".")) : null;
            return {
              largo_cm: Number(m.largo_cm.replace(",", ".")),
              ancho_cm: Number(m.ancho_cm.replace(",", ".")),
              espesor_cm: esp !== null && Number.isFinite(esp) && esp > 0 ? esp : null,
            };
          });
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
        const espesor = draft.espesor_cm.trim() ? Number(draft.espesor_cm.replace(",", ".")) : null;
        return {
          material_id: draft.material_id,
          material_label: x.label,
          qty_slabs: qty,
          largo_cm: Number(draft.largo_cm.replace(",", ".")),
          ancho_cm: Number(draft.ancho_cm.replace(",", ".")),
          espesor_cm: espesor !== null && Number.isFinite(espesor) && espesor > 0 ? espesor : null,
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
        const remitoId = await createRemitoWithSlabsViaRpc({
          supplier_id: supplierId,
          branch_code: branchCode,
          serial_code: serialCode,
          issue_date: issueDate,
          notes: composedNotes,
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
        if (remitoId) navigate(`/remitos/${remitoId}/rotulos`);
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
          const puLocal =
            draft.precio.trim() === "" ? null : Number(draft.precio.replace(",", "."));
          const espesorLocal = m.espesor_cm.trim() ? Number(m.espesor_cm.replace(",", ".")) : null;
          nuevas.push({
            bulto,
            material: x.label,
            materialId: draft.material_id,
            largoCm: Number(m.largo_cm.replace(",", ".")),
            anchoCm: Number(m.ancho_cm.replace(",", ".")),
            espesorCm: espesorLocal != null && Number.isFinite(espesorLocal) && espesorLocal > 0 ? espesorLocal : null,
            estado: "Disponible",
            loteCodigo: draft.lote_codigo.trim(),
            origenPlaca: origenPlaca,
            precioM2: puLocal != null && Number.isFinite(puLocal) ? puLocal : null,
          });
        }
      } else {
        const qty = parseInt(draft.qty_slabs.replace(/\s/g, ""), 10);
        const largo = Number(draft.largo_cm.replace(",", "."));
        const ancho = Number(draft.ancho_cm.replace(",", "."));
        const espesor = draft.espesor_cm.trim() ? Number(draft.espesor_cm.replace(",", ".")) : null;
        for (let i = 0; i < qty; i++) {
          const bulto = `#${ini + i}`;
          if (existingBultosLower.has(bulto.toLowerCase())) {
            toast.error(`El bulto ${bulto} ya existe.`);
            return;
          }
          const puLocal =
            draft.precio.trim() === "" ? null : Number(draft.precio.replace(",", "."));
          nuevas.push({
            bulto,
            material: x.label,
            materialId: draft.material_id,
            largoCm: largo,
            anchoCm: ancho,
            espesorCm: espesor != null && Number.isFinite(espesor) && espesor > 0 ? espesor : null,
            estado: "Disponible",
            loteCodigo: draft.lote_codigo.trim(),
            origenPlaca: origenPlaca,
            precioM2: puLocal != null && Number.isFinite(puLocal) ? puLocal : null,
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
        <DialogContent className={dialogFormClassName}>
          <DialogHeader>
            <DialogTitle>Carga manual</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            {loadErr ? <p className="text-xs text-destructive">{loadErr}</p> : null}

            <div className="space-y-1">
              <Label className="text-xs">Proveedor</Label>
              <div className="flex gap-2">
                <Select
                  value={supplierId || undefined}
                  onValueChange={setSupplierId}
                >
                  <SelectTrigger className="h-9 min-w-0 flex-1 text-sm">
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
                  className="h-9 w-9 shrink-0"
                  aria-label="Nuevo proveedor"
                  onClick={() => setProveedorDialog(true)}
                  disabled={!isSupabaseConfigured}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fecha</Label>
                <FechaInput className="h-9 w-full text-sm" value={issueDate} onChange={setIssueDate} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Origen</Label>
                <Select
                  value={origenPlaca}
                  onValueChange={(v) => setOrigenPlaca(v as OrigenPlaca)}
                >
                  <SelectTrigger className="h-9 w-full text-sm">
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
              <div className="space-y-1">
                <Label className="text-xs">Punto de venta</Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="01123"
                  value={branchCode}
                  onChange={(e) => applyRemitoNumero(e.target.value, "branch")}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Número</Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="00009833"
                  value={serialCode}
                  onChange={(e) => applyRemitoNumero(e.target.value, "serial")}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pegá el número completo (R-01123-00009833) en cualquiera de los dos campos.
            </p>

            {lines.map((ln, idx) => {
              const m2tot = m2Linea(ln);
              const m2IgualesUna = m2Placa(parseCm(ln.largo_cm), parseCm(ln.ancho_cm));
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

                  <div className="space-y-1">
                    <Label className="text-xs">Material</Label>
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
                      <SelectTrigger className="h-9 w-full text-sm">
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
                        className="h-9 text-sm"
                        placeholder="Nombre del material"
                        value={ln.material_other}
                        onChange={(e) => patchLine(idx, { material_other: e.target.value })}
                      />
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Lote *</Label>
                      <Input
                        className="h-9 text-sm"
                        placeholder="Código de lote"
                        value={ln.lote_codigo}
                        onChange={(e) => patchLine(idx, { lote_codigo: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">N° bulto inicial</Label>
                      <Input
                        className="h-9 text-sm"
                        inputMode="numeric"
                        placeholder="9001"
                        value={ln.bulto_inicio}
                        onChange={(e) => patchLine(idx, { bulto_inicio: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Modo de medidas</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={ln.modo_medidas === "iguales" ? "default" : "outline"}
                        className="h-9"
                        onClick={() => patchLine(idx, { modo_medidas: "iguales" })}
                      >
                        Iguales
                      </Button>
                      <Button
                        type="button"
                        variant={ln.modo_medidas === "distintas" ? "default" : "outline"}
                        className="h-9"
                        onClick={() => patchLine(idx, { modo_medidas: "distintas" })}
                      >
                        Distintas
                      </Button>
                    </div>
                  </div>

                  {ln.modo_medidas === "iguales" ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Cantidad (placas iguales)</Label>
                        <Input
                          className="h-9 text-sm"
                          inputMode="numeric"
                          value={ln.qty_slabs}
                          onChange={(e) => patchLine(idx, { qty_slabs: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Largo (cm)</Label>
                          <Input
                            className="h-9 text-sm"
                            inputMode="decimal"
                            placeholder="320"
                            value={ln.largo_cm}
                            onChange={(e) => patchLine(idx, { largo_cm: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Ancho (cm)</Label>
                          <Input
                            className="h-9 text-sm"
                            inputMode="decimal"
                            placeholder="160"
                            value={ln.ancho_cm}
                            onChange={(e) => patchLine(idx, { ancho_cm: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Esp (cm)</Label>
                          <Input
                            className="h-9 text-sm"
                            inputMode="decimal"
                            placeholder="2"
                            value={ln.espesor_cm}
                            onChange={(e) => patchLine(idx, { espesor_cm: e.target.value })}
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Si el remito trae metros (2,830 × 1,890), cargá 283 y 189.
                      </p>
                      {m2PlacaFueraDeRango(m2IgualesUna) ? (
                        <p className="text-[11px] text-destructive">
                          Cada placa da {formatM2(m2IgualesUna)} m². Revisá si las medidas están en metros.
                        </p>
                      ) : null}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">m² totales</Label>
                        <p className="text-sm font-semibold tabular-nums">
                          {m2tot > 0 ? formatM2(m2tot) : "—"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <Label className="text-xs">Medida por placa (cm)</Label>
                          <p className="text-[11px] text-muted-foreground">
                            Centímetros. Si el remito trae metros (2,830 × 1,890), cargá 283 y 189.
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
                          const m2Una = m2Placa(parseCm(m.largo_cm), parseCm(m.ancho_cm));
                          return (
                            <div key={m.key} className="flex items-end gap-2">
                              <span className="mb-2 w-5 shrink-0 text-xs text-muted-foreground tabular-nums">
                                {mi + 1}.
                              </span>
                              <div className="grid min-w-0 flex-1 grid-cols-[1fr_1fr_20%_auto] gap-2">
                                <div className="space-y-1">
                                  {mi === 0 ? <Label className="text-xs">Largo (cm)</Label> : null}
                                  <Input
                                    className="h-9 text-sm"
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
                                    className="h-9 text-sm"
                                    inputMode="decimal"
                                    placeholder="160"
                                    value={m.ancho_cm}
                                    onChange={(e) =>
                                      setMedidaAt(idx, m.key, { ancho_cm: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  {mi === 0 ? <Label className="text-xs">Esp (cm)</Label> : null}
                                  <Input
                                    className="h-9 text-sm"
                                    inputMode="decimal"
                                    placeholder="2"
                                    value={m.espesor_cm}
                                    onChange={(e) =>
                                      setMedidaAt(idx, m.key, { espesor_cm: e.target.value })
                                    }
                                  />
                                </div>
                                <div
                                  className={
                                    m2PlacaFueraDeRango(m2Una)
                                      ? "mb-2 w-14 shrink-0 text-right text-[11px] tabular-nums text-destructive"
                                      : "mb-2 w-14 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground"
                                  }
                                >
                                  {m2Una > 0 ? `${formatM2(m2Una)} m²` : "—"}
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="mb-0.5 h-9 w-9 shrink-0 text-destructive"
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

                  <div className="space-y-1">
                    <Label className="text-xs">Precio por m² (opcional)</Label>
                    <Input
                      className="h-9 text-sm"
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

            <div className="space-y-1">
              <Label htmlFor="rem-pedido" className="text-xs">Pedido del proveedor (opcional)</Label>
              <Input
                id="rem-pedido"
                className="h-9 text-sm"
                placeholder="OV_MGSL_2830"
                value={pedidoProveedor}
                onChange={(e) => setPedidoProveedor(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="rem-obs" className="text-xs">Observación (opcional)</Label>
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

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
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
