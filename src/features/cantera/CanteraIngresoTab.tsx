"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MaterialOption } from "@/lib/stock-api";
import { fetchSuppliers, type SupplierRow } from "@/lib/stock-api";
import type { RegisterCanteraLineInput, CanteraPurchaseUom } from "@/lib/cantera-stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";
import { Factory, History, Plus, Trash2, Truck } from "lucide-react";
import { parseDecimalInput } from "@/lib/presupuesto-calculos";
import { useCanteraLotes } from "@/features/cantera/useCanteraLotes";
import { CanteraProcesarTab } from "@/features/cantera/CanteraProcesarTab";

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

type CanteraIngresoTabProps = {
  materiales: MaterialOption[];
  userId?: string | null;
  onCatalogStale?: () => void;
};

export function CanteraIngresoTab({ materiales, userId, onCatalogStale }: CanteraIngresoTabProps) {
  const { lotes, loading, register, reload } = useCanteraLotes(true);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
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
      prev.map((l) => (l.materialId && materiales.some((m) => m.id === l.materialId) ? l : { ...l, materialId: firstId })),
    );
  }, [firstId, materiales]);

  const addLine = () => {
    setLines((rows) => [...rows, blankLine(firstId)]);
  };

  const removeLine = (key: string) => {
    setLines((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  };

  const patchLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const handleSubmitIngreso = async () => {
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
      setReceiptRef("");
      setNotes("");
      onCatalogStale?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar el ingreso.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessed = () => {
    void reload();
    onCatalogStale?.();
  };

  return (
    <div className="space-y-6">
      {!isSupabaseConfigured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          Sin Supabase: los ingresos y procesamientos se acumulan en memoria solo en esta sesión hasta recargar
          la app.
        </p>
      ) : null}

      <Tabs defaultValue="lotes" className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="lotes" className="gap-1.5 px-3">
            <History className="h-4 w-4" />
            Lotes recientes
          </TabsTrigger>
          <TabsTrigger value="ingreso" className="gap-1.5 px-3">
            <Truck className="h-4 w-4" />
            Nuevo ingreso
          </TabsTrigger>
          <TabsTrigger value="procesar" className="gap-1.5 px-3">
            <Factory className="h-4 w-4" />
            Procesar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lotes" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="border-b bg-muted/20 py-3">
              <CardTitle className="text-base">Lotes recientes</CardTitle>
              <CardDescription>
                {loading ? "Cargando…" : `${lotes.length} registro(s).`} Historial de ingresos a granel.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Material</TableHead>
                      <TableHead className="text-xs text-right">kg inicial</TableHead>
                      <TableHead className="text-xs text-right">kg restante</TableHead>
                      <TableHead className="text-xs">UoM compra</TableHead>
                      <TableHead className="text-xs">Proveedor</TableHead>
                      <TableHead className="text-xs">Ref.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!lotes.length ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                          Aún no hay ingresos a granel.
                        </TableCell>
                      </TableRow>
                    ) : (
                      lotes.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs whitespace-nowrap">{l.issue_date}</TableCell>
                          <TableCell className="text-xs max-w-[12rem] truncate">
                            {l.material_name ?? l.material_id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {l.qty_kg_initial.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {l.qty_kg_remaining.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-xs">{l.purchase_uom}</TableCell>
                          <TableCell className="text-xs truncate max-w-[8rem]">
                            {l.supplier_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs truncate max-w-[8rem]">
                            {l.receipt_ref ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingreso" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="border-b bg-muted/20 py-3">
              <CardTitle className="text-base">Nuevo ingreso desde cantera</CardTitle>
              <CardDescription>
                Cantidad en kilogramos o toneladas. Se crea un lote y se incrementa el stock a granel
                del material.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Proveedor (opcional)</Label>
                  <Select
                    value={supplierId || "__none__"}
                    onValueChange={(v) => setSupplierId(v === "__none__" ? "" : v)}
                    disabled={!isSupabaseConfigured}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sin proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin proveedor</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fecha</Label>
                  <Input
                    type="date"
                    className="h-9"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ref. comprobante</Label>
                  <Input
                    className="h-9"
                    placeholder="Remito / nota"
                    value={receiptRef}
                    onChange={(e) => setReceiptRef(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notas</Label>
                <Textarea
                  className="min-h-[52px] text-sm"
                  placeholder="Observaciones del ingreso…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-semibold">Líneas de material</Label>
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={addLine}>
                    <Plus className="h-3.5 w-3.5" />
                    Agregar línea
                  </Button>
                </div>
                <div className="space-y-3 rounded-md border border-border p-3">
                  {lines.map((ln) => (
                    <div
                      key={ln.key}
                      className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem_auto] sm:items-end"
                    >
                      <div className="space-y-1 min-w-0">
                        <Label className="text-[10px] text-muted-foreground">Material</Label>
                        <Select
                          value={ln.materialId}
                          onValueChange={(v) => patchLine(ln.key, { materialId: v })}
                        >
                          <SelectTrigger className="h-9">
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
                        <Label className="text-[10px] text-muted-foreground">Cantidad</Label>
                        <Input
                          className="h-9 tabular-nums"
                          inputMode="decimal"
                          value={ln.qty}
                          onChange={(e) => patchLine(ln.key, { qty: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Unidad</Label>
                        <Select
                          value={ln.uom}
                          onValueChange={(v) => patchLine(ln.key, { uom: v as CanteraPurchaseUom })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
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
                          className="h-9 w-9 text-destructive"
                          disabled={lines.length <= 1}
                          onClick={() => removeLine(ln.key)}
                          aria-label="Quitar línea"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={submitting || !materiales.length}
                onClick={() => void handleSubmitIngreso()}
              >
                {submitting ? "Guardando…" : "Confirmar ingreso"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="procesar" className="mt-4">
          <CanteraProcesarTab
            materiales={materiales}
            lotes={lotes}
            lotesLoading={loading}
            userId={userId}
            onProcessed={handleProcessed}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
