"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { createRetazosManual } from "@/lib/stock-api";
import type { MaterialOption } from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

function rowKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `r-${Math.random().toString(36).slice(2)}`;
}

type RowDraft = {
  key: string;
  material_id: string | null;
  material_other: string;
  largo_cm: string;
  ancho_cm: string;
  cantidad: string;
  n_chapa: string;
  observacion: string;
};

function emptyRow(prefillMaterialId: string | null): RowDraft {
  return {
    key: rowKey(),
    material_id: prefillMaterialId,
    material_other: "",
    largo_cm: "",
    ancho_cm: "",
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

    const payloads = [];
    for (const r of rows) {
      const label = materialLabelFor(r);
      if (!label) {
        toast.error("Completá el material en todas las filas.");
        return;
      }
      const largo = Number(String(r.largo_cm).replace(",", "."));
      const ancho = Number(String(r.ancho_cm).replace(",", "."));
      if (!Number.isFinite(largo) || largo <= 0 || !Number.isFinite(ancho) || ancho <= 0) {
        toast.error("Indicá largo y ancho en cm (mayores a 0).");
        return;
      }
      const cant = Number(String(r.cantidad).replace(",", "."));
      if (!Number.isFinite(cant) || cant < 1 || !Number.isInteger(cant)) {
        toast.error("La cantidad debe ser un entero mayor a 0.");
        return;
      }
      payloads.push({
        material_id: r.material_id,
        material_label: label,
        largo_cm: largo,
        ancho_cm: ancho,
        cantidad: cant,
        bulto: r.n_chapa.trim() || null,
        observacion: r.observacion.trim() || null,
        created_by: user?.id ?? null,
      });
    }

    setSaving(true);
    try {
      const n = await createRetazosManual(payloads);
      toast.success(
        n === 1 ? "Retazo dado de alta en stock." : `${n} retazos dados de alta en stock.`,
      );
      setRows([emptyRow(defaultMat !== "__none__" ? defaultMat : null)]);
      onCommitted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron grabar los recortes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
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

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table className="min-w-[720px] text-xs">
          <TableHeader>
            <TableRow className="bg-muted/45 hover:bg-muted/45 [&_th]:py-2">
              <TableHead className="min-w-[140px]">Material</TableHead>
              <TableHead className="w-24">Largo cm</TableHead>
              <TableHead className="w-24">Ancho cm</TableHead>
              <TableHead className="w-16">Cant.</TableHead>
              <TableHead className="min-w-[100px]">N° bulto</TableHead>
              <TableHead className="min-w-[140px]">Observación</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key} className="align-top">
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
                    placeholder="80"
                    value={r.largo_cm}
                    onChange={(e) => patchRow(r.key, { largo_cm: e.target.value })}
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    className="h-8 tabular-nums"
                    inputMode="decimal"
                    placeholder="40"
                    value={r.ancho_cm}
                    onChange={(e) => patchRow(r.key, { ancho_cm: e.target.value })}
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    className="h-8 tabular-nums"
                    inputMode="numeric"
                    value={r.cantidad}
                    onChange={(e) => patchRow(r.key, { cantidad: e.target.value })}
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    className="h-8 font-mono text-[11px]"
                    placeholder="Opcional"
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
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    aria-label="Quitar fila"
                    onClick={() => removeRow(r.key)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" size="sm" variant="outline" className="gap-2 self-center sm:self-start" onClick={addRow}>
          <Plus className="h-4 w-4" />
          Agregar fila
        </Button>
        <div className="flex gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setRows([emptyRow(defaultMat !== "__none__" ? defaultMat : null)])}
          >
            Limpiar
          </Button>
          <Button type="button" onClick={() => void handleGrabar()} disabled={saving}>
            {saving ? "Grabando…" : "Grabar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
