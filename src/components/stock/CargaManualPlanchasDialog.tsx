"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CirclePlus, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createManualSlabs,
  type MaterialOption,
} from "@/lib/stock-api";
import { fetchSuppliers, type SupplierRow } from "@/lib/suppliers-api";
import { createMaterial } from "@/lib/materials-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ProveedorFormDialog } from "@/components/proveedores/ProveedorFormDialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materiales: MaterialOption[];
  onMaterialCreated: (m: MaterialOption) => void;
  userId?: string | null;
  onSuccess: () => void | Promise<void>;
};

type ModoMedidas = "iguales" | "distintas";

type MedidaDraft = {
  key: string;
  largoM: string;
  anchoM: string;
  espCm: string;
};

function newKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `m-${Math.random().toString(36).slice(2)}`;
}

function blankMedida(): MedidaDraft {
  return { key: newKey(), largoM: "", anchoM: "", espCm: "" };
}

function parseNum(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function CargaManualPlanchasDialog({
  open,
  onOpenChange,
  materiales,
  onMaterialCreated,
  userId,
  onSuccess,
}: Props) {
  const [materialId, setMaterialId] = useState<string>("");
  const [lote, setLote] = useState("");
  const [modo, setModo] = useState<ModoMedidas>("iguales");
  const [largoM, setLargoM] = useState("0");
  const [anchoM, setAnchoM] = useState("0");
  const [espCm, setEspCm] = useState("0");
  const [cantidad, setCantidad] = useState("1");
  const [medidas, setMedidas] = useState<MedidaDraft[]>([blankMedida()]);
  const [extraOpen, setExtraOpen] = useState(false);
  const [costoUsd, setCostoUsd] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const sortedSuppliers = useMemo(() => {
    const placasRubros = ["placas_naturales", "placas_industriales"];
    return [...suppliers].sort((a, b) => {
      const aMatch = (a.rubros ?? []).some((r: string) => placasRubros.includes(r)) ? 0 : 1;
      const bMatch = (b.rubros ?? []).some((r: string) => placasRubros.includes(r)) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.name.localeCompare(b.name, "es");
    });
  }, [suppliers]);
  const [creandoMaterial, setCreandoMaterial] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [creandoMatSaving, setCreandoMatSaving] = useState(false);
  const [nuevoProvOpen, setNuevoProvOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const qtyIguales = useMemo(() => {
    const n = Number.parseInt(cantidad.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [cantidad]);

  const qtyIngreso = modo === "iguales" ? qtyIguales : medidas.length;

  const resetNuevoMaterial = () => {
    setCreandoMaterial(false);
    setNuevoNombre("");
    setNuevoCodigo("");
  };

  const reset = () => {
    setMaterialId("");
    setLote("");
    setModo("iguales");
    setLargoM("0");
    setAnchoM("0");
    setEspCm("0");
    setCantidad("1");
    setMedidas([blankMedida()]);
    setExtraOpen(false);
    setCostoUsd("");
    setSupplierId("");
    resetNuevoMaterial();
  };

  useEffect(() => {
    if (!open || !isSupabaseConfigured) return;
    let cancel = false;
    void fetchSuppliers()
      .then((rows) => {
        if (!cancel) setSuppliers(rows);
      })
      .catch(() => {
        if (!cancel) setSuppliers([]);
      });
    return () => {
      cancel = true;
    };
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleCrearYUsar = async () => {
    const name = nuevoNombre.trim();
    if (!name) {
      toast.error("Indicá el nombre del material.");
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado.");
      return;
    }
    setCreandoMatSaving(true);
    try {
      const { data, error } = await createMaterial({
        name,
        unit: "m2",
        material_kind: "marmol",
        codigo: nuevoCodigo.trim() || null,
      });
      if (error || !data) {
        toast.error(error?.message ?? "No se pudo crear el material");
        return;
      }
      onMaterialCreated({
        id: data.id,
        name: data.name,
        unit: data.unit,
        material_kind: data.material_kind,
        peso_por_m2_kg: data.peso_por_m2_kg,
        bulk_stock_kg: data.bulk_stock_kg ?? 0,
        stock_qty: data.stock_qty ?? 0,
        familia: data.familia ?? null,
        codigo: data.codigo ?? null,
        costo_usd: data.costo_usd ?? null,
        espesor_mm: data.espesor_mm ?? null,
      });
      setMaterialId(data.id);
      resetNuevoMaterial();
      toast.success("Material creado");
    } finally {
      setCreandoMatSaving(false);
    }
  };

  const parseCostoOpcional = (): number | null | undefined => {
    if (!extraOpen || !costoUsd.trim()) return null;
    const costo = parseNum(costoUsd);
    if (costo == null || costo < 0) {
      toast.error("Costo USD inválido.");
      return undefined;
    }
    return costo;
  };

  const handleSubmit = async () => {
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado.");
      return;
    }
    if (!materialId) {
      toast.error("Elegí un material.");
      return;
    }

    const costo = parseCostoOpcional();
    if (costo === undefined) return;

    const mat = materiales.find((m) => m.id === materialId);
    const supplierName = suppliers.find((s) => s.id === supplierId)?.name;
    const notesParts: string[] = [];
    if (supplierName) notesParts.push(`Proveedor: ${supplierName}`);

    if (modo === "iguales") {
      const largo = parseNum(largoM);
      const ancho = parseNum(anchoM);
      const esp = parseNum(espCm);
      if (largo == null || largo <= 0 || ancho == null || ancho <= 0) {
        toast.error("Largo y ancho deben ser mayores a 0.");
        return;
      }
      if (qtyIguales < 1) {
        toast.error("La cantidad debe ser al menos 1.");
        return;
      }

      setSaving(true);
      try {
        const inserted = await createManualSlabs({
          material_id: materialId,
          material_label: mat?.name,
          modo_medidas: "iguales",
          qty_slabs: qtyIguales,
          largo_cm: largo * 100,
          ancho_cm: ancho * 100,
          espesor_cm: esp != null && esp > 0 ? esp : null,
          lote_codigo: lote.trim() || null,
          costo_usd: costo,
          notes: notesParts.length ? notesParts.join(" · ") : null,
          created_by: userId ?? null,
        });
        toast.success(
          inserted === 1 ? "1 plancha ingresada" : `${inserted} planchas ingresadas`,
        );
        handleOpenChange(false);
        await onSuccess();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo ingresar");
      } finally {
        setSaving(false);
      }
      return;
    }

    // Distintas: una fila por plancha
    const parsed: Array<{ largo_cm: number; ancho_cm: number; espesor_cm: number | null }> = [];
    for (let i = 0; i < medidas.length; i++) {
      const m = medidas[i]!;
      const largo = parseNum(m.largoM);
      const ancho = parseNum(m.anchoM);
      const esp = parseNum(m.espCm);
      if (largo == null || largo <= 0 || ancho == null || ancho <= 0) {
        toast.error(`Placa ${i + 1}: cargá largo y ancho.`);
        return;
      }
      parsed.push({
        largo_cm: largo * 100,
        ancho_cm: ancho * 100,
        espesor_cm: esp != null && esp > 0 ? esp : null,
      });
    }

    setSaving(true);
    try {
      const inserted = await createManualSlabs({
        material_id: materialId,
        material_label: mat?.name,
        modo_medidas: "distintas",
        medidas: parsed,
        lote_codigo: lote.trim() || null,
        costo_usd: costo,
        notes: notesParts.length ? notesParts.join(" · ") : null,
        created_by: userId ?? null,
      });
      toast.success(
        inserted === 1 ? "1 plancha ingresada" : `${inserted} planchas ingresadas`,
      );
      handleOpenChange(false);
      await onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo ingresar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Carga manual de planchas</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Cuando no hay remito para escanear.
            </p>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm">Material</Label>
                {!creandoMaterial ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    onClick={() => setCreandoMaterial(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Crear material
                  </button>
                ) : null}
              </div>
              {creandoMaterial ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3">
                  <p className="mb-2.5 text-sm font-medium text-foreground">Material nuevo</p>
                  <div className="grid gap-2.5">
                    <Input
                      className="h-10 bg-background"
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      placeholder="Nombre (ej: Granito Negro Brasil)"
                      autoFocus
                    />
                    <Input
                      className="h-10 bg-background"
                      value={nuevoCodigo}
                      onChange={(e) => setNuevoCodigo(e.target.value)}
                      placeholder="Código (opcional)"
                    />
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={resetNuevoMaterial}
                        disabled={creandoMatSaving}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 gap-1.5"
                        disabled={!nuevoNombre.trim() || creandoMatSaving}
                        onClick={() => void handleCrearYUsar()}
                      >
                        <CirclePlus className="h-4 w-4" />
                        {creandoMatSaving ? "Creando…" : "Crear y usar"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Select value={materialId || undefined} onValueChange={setMaterialId}>
                  <SelectTrigger className="h-10 w-full bg-muted/40">
                    <SelectValue placeholder="Elegir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {materiales.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                Lote{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                className="h-10 bg-muted/40"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                placeholder="Ej: 4471"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Medidas</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={modo === "iguales" ? "default" : "outline"}
                  className="h-auto flex-col items-start gap-0.5 px-3 py-2.5 text-left"
                  onClick={() => setModo("iguales")}
                >
                  <span className="text-sm font-medium">Iguales</span>
                  <span className="text-[10px] font-normal opacity-80">
                    Mismas medidas × cantidad
                  </span>
                </Button>
                <Button
                  type="button"
                  variant={modo === "distintas" ? "default" : "outline"}
                  className="h-auto flex-col items-start gap-0.5 px-3 py-2.5 text-left"
                  onClick={() => setModo("distintas")}
                >
                  <span className="text-sm font-medium">Distintas</span>
                  <span className="text-[10px] font-normal opacity-80">
                    Artesanal: cada placa su L×A×Esp
                  </span>
                </Button>
              </div>
            </div>

            {modo === "iguales" ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Largo (m)</Label>
                    <Input
                      className="h-10 bg-muted/40 tabular-nums"
                      inputMode="decimal"
                      value={largoM}
                      onChange={(e) => setLargoM(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Ancho (m)</Label>
                    <Input
                      className="h-10 bg-muted/40 tabular-nums"
                      inputMode="decimal"
                      value={anchoM}
                      onChange={(e) => setAnchoM(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Esp (cm)</Label>
                    <Input
                      className="h-10 bg-muted/40 tabular-nums"
                      inputMode="decimal"
                      value={espCm}
                      onChange={(e) => setEspCm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Cantidad (planchas iguales)</Label>
                  <Input
                    className="h-10 bg-muted/40 tabular-nums"
                    inputMode="numeric"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Una fila por plancha (largo y ancho en metros).
                  </p>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {medidas.length} placa{medidas.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="max-h-52 space-y-2 overflow-y-auto pr-0.5">
                  {medidas.map((m, mi) => (
                    <div key={m.key} className="flex items-end gap-1.5">
                      <span className="mb-2.5 w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {mi + 1}.
                      </span>
                      <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5">
                        <div className="space-y-1">
                          {mi === 0 ? <Label className="text-xs">Largo (m)</Label> : null}
                          <Input
                            className="h-9 bg-muted/40 tabular-nums"
                            inputMode="decimal"
                            placeholder="3.20"
                            value={m.largoM}
                            onChange={(e) =>
                              setMedidas((prev) =>
                                prev.map((x) =>
                                  x.key === m.key ? { ...x, largoM: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          {mi === 0 ? <Label className="text-xs">Ancho (m)</Label> : null}
                          <Input
                            className="h-9 bg-muted/40 tabular-nums"
                            inputMode="decimal"
                            placeholder="1.60"
                            value={m.anchoM}
                            onChange={(e) =>
                              setMedidas((prev) =>
                                prev.map((x) =>
                                  x.key === m.key ? { ...x, anchoM: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          {mi === 0 ? <Label className="text-xs">Esp (cm)</Label> : null}
                          <Input
                            className="h-9 bg-muted/40 tabular-nums"
                            inputMode="decimal"
                            placeholder="2"
                            value={m.espCm}
                            onChange={(e) =>
                              setMedidas((prev) =>
                                prev.map((x) =>
                                  x.key === m.key ? { ...x, espCm: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="mb-0.5 h-9 w-9 shrink-0 text-destructive"
                        disabled={medidas.length <= 1}
                        onClick={() =>
                          setMedidas((prev) => prev.filter((x) => x.key !== m.key))
                        }
                        title="Quitar placa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1 border-dashed"
                  onClick={() => setMedidas((prev) => [...prev, blankMedida()])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar otra placa
                </Button>
              </div>
            )}

            {!extraOpen ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                onClick={() => setExtraOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Agregar costo o proveedor (opcional)
              </button>
            ) : (
              <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Costo USD / m²</Label>
                  <Input
                    className="h-10 bg-background tabular-nums"
                    inputMode="decimal"
                    value={costoUsd}
                    onChange={(e) => setCostoUsd(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm">Proveedor</Label>
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() => setNuevoProvOpen(true)}
                    >
                      + Nuevo
                    </button>
                  </div>
                  <Select
                    value={supplierId || "__none__"}
                    onValueChange={(v) => setSupplierId(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="h-10 w-full bg-background">
                      <SelectValue placeholder="Sin proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin proveedor</SelectItem>
                      {sortedSuppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              disabled={saving || !materialId || qtyIngreso < 1}
              onClick={() => void handleSubmit()}
            >
              <Plus className="h-4 w-4" />
              {saving ? "Ingresando…" : `Ingresar ${qtyIngreso || 1}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProveedorFormDialog
        open={nuevoProvOpen}
        onOpenChange={setNuevoProvOpen}
        onSaved={(s) => {
          setSuppliers((prev) =>
            [...prev, s].sort((a, b) => a.name.localeCompare(b.name, "es")),
          );
          setSupplierId(s.id);
        }}
      />
    </>
  );
}
