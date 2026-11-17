"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InventoryLoteListItem, RegisterCanteraProcesamientoInput } from "@/lib/cantera-stock-api";
import type { MaterialOption } from "@/lib/stock-api";
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
  materialId: string;
  cantidad: string;
};

function blankProductLine(defaultMaterialId: string): ProductLineDraft {
  return { key: newLineKey(), materialId: defaultMaterialId, cantidad: "" };
}

type CanteraProcesarTabProps = {
  materiales: MaterialOption[];
  lotes: InventoryLoteListItem[];
  lotesLoading: boolean;
  userId?: string | null;
  onProcessed?: () => void;
};

export function CanteraProcesarTab({
  materiales,
  lotes,
  lotesLoading,
  userId,
  onProcessed,
}: CanteraProcesarTabProps) {
  const { procesamientos, loading: procLoading, register } = useCanteraProcesamientos(true);
  const lotesDisponibles = useMemo(
    () => lotes.filter((l) => l.qty_kg_remaining > 0),
    [lotes],
  );

  const firstProductId = materiales[0]?.id ?? "";
  const [loteId, setLoteId] = useState("");
  const [kgConsumidos, setKgConsumidos] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [productLines, setProductLines] = useState<ProductLineDraft[]>(() => [blankProductLine(firstProductId)]);
  const [submitting, setSubmitting] = useState(false);

  const loteSeleccionado = lotesDisponibles.find((l) => l.id === loteId);

  useEffect(() => {
    if (!firstProductId) return;
    setProductLines((prev) =>
      prev.map((l) =>
        l.materialId && materiales.some((m) => m.id === l.materialId) ? l : { ...l, materialId: firstProductId },
      ),
    );
  }, [firstProductId, materiales]);

  useEffect(() => {
    if (!loteId && lotesDisponibles.length > 0) {
      setLoteId(lotesDisponibles[0].id);
    }
    if (loteId && !lotesDisponibles.some((l) => l.id === loteId)) {
      setLoteId(lotesDisponibles[0]?.id ?? "");
    }
  }, [loteId, lotesDisponibles]);

  const addProductLine = () => {
    setProductLines((rows) => [...rows, blankProductLine(firstProductId)]);
  };

  const removeProductLine = (key: string) => {
    setProductLines((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  };

  const patchProductLine = (key: string, patch: Partial<ProductLineDraft>) => {
    setProductLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

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

    const lines: RegisterCanteraProcesamientoInput["lines"] = [];
    for (const ln of productLines) {
      const cantidad = parseDecimalInput(ln.cantidad);
      if (!ln.materialId || cantidad <= 0) {
        toast.error("Completá producto y cantidad (> 0) en cada línea.");
        return;
      }
      lines.push({ material_producto_id: ln.materialId, cantidad });
    }

    setSubmitting(true);
    try {
      await register({
        lote_id: loteId,
        qty_kg_consumidos: kg,
        issue_date: issueDate,
        notes,
        created_by: userId ?? null,
        lines,
      });
      toast.success(
        isSupabaseConfigured
          ? "Procesamiento registrado. Stock de productos actualizado."
          : "Procesamiento demo (solo esta sesión, sin Supabase).",
      );
      setKgConsumidos("");
      setNotes("");
      setProductLines([blankProductLine(firstProductId)]);
      onProcessed?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar el procesamiento.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Procesar piedra bruta</CardTitle>
          <p className="text-sm text-muted-foreground">
            Consumí kg de un lote y registrá los productos terminados (adoquines, m² de laja, etc.).
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {lotesLoading ? (
            <p className="text-sm text-muted-foreground">Cargando lotes…</p>
          ) : lotesDisponibles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No hay lotes con kg disponibles. Registrá un ingreso con el botón de arriba.
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5 sm:col-span-2">
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
                      {loteSeleccionado.qty_kg_remaining.toLocaleString("es-AR", {
                        maximumFractionDigits: 1,
                      })}{" "}
                      kg
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Fecha</Label>
                  <FechaInput
                    value={issueDate}
                    onChange={setIssueDate}
                  />
                </div>
              </div>

              {loteSeleccionado ? (
                <ConversionesMaestroHints parentMaterialId={loteSeleccionado.material_id} />
              ) : null}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notas</Label>
                <Textarea
                  className="min-h-[56px] text-sm"
                  placeholder="Observaciones del procesamiento…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Productos terminados</h3>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addProductLine}>
                    <Plus className="h-3.5 w-3.5" />
                    Agregar producto
                  </Button>
                </div>
                <div className="space-y-2">
                  {productLines.map((ln) => {
                    const mat = materiales.find((m) => m.id === ln.materialId);
                    return (
                      <div
                        key={ln.key}
                        className="grid gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
                      >
                        <div className="space-y-1 min-w-0">
                          <Label className="text-[11px] text-muted-foreground">Producto (stock)</Label>
                          <Select
                            value={ln.materialId}
                            onValueChange={(v) => patchProductLine(ln.key, { materialId: v })}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {materiales.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            Cantidad {mat?.unit ? `(${mat.unit})` : ""}
                          </Label>
                          <Input
                            className="tabular-nums"
                            inputMode="decimal"
                            value={ln.cantidad}
                            onChange={(e) => patchProductLine(ln.key, { cantidad: e.target.value })}
                          />
                        </div>
                        <div className="flex justify-end pb-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            disabled={productLines.length <= 1}
                            onClick={() => removeProductLine(ln.key)}
                            aria-label="Quitar producto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={submitting || !materiales.length || !loteId}
                onClick={() => void handleSubmit()}
              >
                {submitting ? "Guardando…" : "Confirmar procesamiento"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Procesamientos recientes</CardTitle>
          <p className="text-sm text-muted-foreground">
            {procLoading ? "Cargando…" : `${procesamientos.length} registro(s)`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Material bruto</TableHead>
                  <TableHead className="text-right">kg consumidos</TableHead>
                  <TableHead>Productos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!procesamientos.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-12">
                      Aún no hay procesamientos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  procesamientos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm whitespace-nowrap">{p.issue_date}</TableCell>
                      <TableCell className="text-sm max-w-[10rem] truncate">
                        {p.material_bruto_name ?? p.material_bruto_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums">
                        {p.qty_kg_consumidos.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.lineas.length === 0
                          ? "—"
                          : p.lineas
                              .map(
                                (ln) =>
                                  `${ln.material_producto_name ?? ln.material_producto_id.slice(0, 6)}: ${ln.cantidad.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${ln.unit}`,
                              )
                              .join(" · ")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
