"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { insertStockScraps } from "@/lib/stock-api";
import type { MaterialOption } from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Minus, Plus, Scissors } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/types/database";

type ScrapInsert = Database["public"]["Tables"]["stock_scraps"]["Insert"];

const ACCIONES = [{ value: "Reingresar", label: "Reingresar" }] as const;
const INGRESOS = [
  { value: "Recorte Cuadrado/Rectangulo", label: "Recorte cuadrado/rectángulo" },
  { value: "Otro", label: "Otro" },
] as const;

function rowKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `r-${Math.random().toString(36).slice(2)}`;
}

type RowDraft = {
  key: string;
  accion: string;
  ingreso_tipo: string;
  material_id: string | null;
  material_other: string;
  cantidad: string;
  n_chapa: string;
  observacion: string;
};

function emptyRow(prefillMaterialId: string | null): RowDraft {
  return {
    key: rowKey(),
    accion: ACCIONES[0].value,
    ingreso_tipo: INGRESOS[0].value,
    material_id: prefillMaterialId,
    material_other: "",
    cantidad: "1",
    n_chapa: "",
    observacion: "",
  };
}

type RecortesPorMaterialTabProps = {
  materiales: MaterialOption[];
  onCommitted?: () => void;
};

export function RecortesPorMaterialTab({ materiales, onCommitted }: RecortesPorMaterialTabProps) {
  const { user } = useAuth();
  const [defaultMat, setDefaultMat] = useState<string>("__none__");
  const [rows, setRows] = useState<RowDraft[]>(() => [emptyRow(null)]);
  const [saving, setSaving] = useState(false);

  const materialLabelFor = useCallback(
    (r: RowDraft) => {
      if (r.material_id) {
        const m = materiales.find((x) => x.id === r.material_id);
        return m?.name?.trim() ?? r.material_other.trim();
      }
      return r.material_other.trim();
    },
    [materiales],
  );

  const patchRow = (key: string, p: Partial<RowDraft>) => {
    setRows((prev) => prev.map((x) => (x.key === key ? { ...x, ...p } : x)));
  };

  const addRow = () => {
    const pre = defaultMat !== "__none__" ? defaultMat : null;
    setRows((prev) => [...prev, emptyRow(pre)]);
  };

  const removeRow = (key: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.key !== key)));
  };

  const handleGrabar = async () => {
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado.");
      return;
    }

    const inserts: ScrapInsert[] = [];

    for (const r of rows) {
      const label = materialLabelFor(r);
      if (!label) {
        toast.error("Completá el material en todas las filas.");
        return;
      }
      const cant = Number(String(r.cantidad).replace(",", "."));
      if (!Number.isFinite(cant) || cant <= 0) {
        toast.error("Cantidad inválida.");
        return;
      }
      inserts.push({
        accion: r.accion,
        ingreso_tipo: r.ingreso_tipo,
        material_id: r.material_id,
        material_label: label,
        cantidad: cant,
        n_chapa: r.n_chapa.trim() || null,
        observacion: r.observacion.trim() || null,
        created_by: user?.id ?? null,
      });
    }

    setSaving(true);
    try {
      await insertStockScraps(inserts);
      toast.success("Recortes registrados en stock.");
      setRows([emptyRow(defaultMat !== "__none__" ? defaultMat : null)]);
      onCommitted?.();
    } catch {
      toast.error("No se pudieron grabar los recortes.");
    } finally {
      setSaving(false);
    }
  };

  const showEmptyState = materiales.length === 0 && isSupabaseConfigured;

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="border-b border-border bg-muted/20 py-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Scissors className="h-4 w-4" />
          Ingreso de recortes por material
        </CardTitle>
        {!isSupabaseConfigured ? (
          <p className="text-xs text-muted-foreground">
            Esta pantalla necesita Supabase para persistir registros de recorte.
          </p>
        ) : null}
        {showEmptyState ? (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            No hay materiales en el catálogo. Andá a{" "}
            <span className="font-medium text-foreground">Stock → Materiales</span> y creá el
            primero.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] space-y-1.5">
            <Label>Material sugerido (nuevas filas)</Label>
            <Select value={defaultMat} onValueChange={setDefaultMat}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Seleccionar</SelectItem>
                {materiales.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table className="min-w-[720px] text-xs">
            <TableHeader>
              <TableRow className="bg-muted/45 hover:bg-muted/45 [&_th]:py-2">
                <TableHead>Acción</TableHead>
                <TableHead>Ingreso</TableHead>
                <TableHead className="min-w-[140px]">Material</TableHead>
                <TableHead className="w-20">Cant.</TableHead>
                <TableHead className="min-w-[100px]">N° Chapa</TableHead>
                <TableHead className="min-w-[140px]">Observación</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key} className="align-top">
                  <TableCell className="py-2">
                    <Select value={r.accion} onValueChange={(v) => patchRow(r.key, { accion: v })}>
                      <SelectTrigger className="h-8 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCIONES.map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2">
                    <Select
                      value={r.ingreso_tipo}
                      onValueChange={(v) => patchRow(r.key, { ingreso_tipo: v })}
                    >
                      <SelectTrigger className="h-8 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INGRESOS.map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col gap-1">
                      <Select
                        value={r.material_id ? r.material_id : "__otro__"}
                        onValueChange={(v) =>
                          patchRow(r.key, {
                            material_id: v === "__otro__" ? null : v,
                            material_other:
                              v !== "__otro__" ? (materiales.find((x) => x.id === v)?.name ?? "") : "",
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-[11px]">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {materiales.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="__otro__">Otro texto</SelectItem>
                        </SelectContent>
                      </Select>
                      {!r.material_id ? (
                        <Input
                          className="h-8 text-[11px]"
                          placeholder="Material"
                          value={r.material_other}
                          onChange={(e) => patchRow(r.key, { material_other: e.target.value })}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      className="h-8 tabular-nums"
                      inputMode="decimal"
                      value={r.cantidad}
                      onChange={(e) => patchRow(r.key, { cantidad: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      className="h-8 font-mono text-[11px]"
                      placeholder="N° Chapa"
                      value={r.n_chapa}
                      onChange={(e) => patchRow(r.key, { n_chapa: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Textarea
                      className="min-h-[56px] resize-none text-[11px]"
                      placeholder="Observación"
                      value={r.observacion}
                      onChange={(e) => patchRow(r.key, { observacion: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Button type="button" size="sm" variant="outline" className="h-8 w-8 border-emerald-600 p-0 text-emerald-700" aria-label="Quitar fila" onClick={() => removeRow(r.key)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            size="sm"
            className="gap-2 self-center bg-sky-600 text-white hover:bg-sky-700 sm:self-start"
            onClick={addRow}
          >
            <Plus className="h-4 w-4" />
            Agregar fila
          </Button>
          <div className="flex gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setRows([emptyRow(defaultMat !== "__none__" ? defaultMat : null)])}>
              Limpiar
            </Button>
            <Button type="button" onClick={handleGrabar} disabled={saving}>
              Grabar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
