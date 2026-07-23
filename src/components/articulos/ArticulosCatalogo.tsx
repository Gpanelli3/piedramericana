"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  createArticulo,
  fetchArticulos,
  updateArticulo,
  type ArticuloUpsertInput,
} from "@/lib/articulos-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ArticuloConPrecio } from "@/types/articulos";
import type { UnidadArticuloDb } from "@/types/database";

const UNIDADES: { value: UnidadArticuloDb; label: string }[] = [
  { value: "M2", label: "m²" },
  { value: "ML", label: "metro lineal" },
  { value: "UNI", label: "unidad" },
];

function emptyDraft(): ArticuloUpsertInput {
  return {
    codigo: "",
    descripcion: "",
    unidad: "M2",
    calcula_material: true,
    medida_estandar_m2: null,
    prefer_modo_manual: false,
    sort_order: 0,
  };
}

function labelUnidad(u: UnidadArticuloDb): string {
  return UNIDADES.find((x) => x.value === u)?.label ?? u;
}

export function ArticulosCatalogo() {
  const [articulos, setArticulos] = useState<ArticuloConPrecio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [draft, setDraft] = useState<ArticuloUpsertInput>(emptyDraft);

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setArticulos([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const { data, error } = await fetchArticulos();
    if (error) {
      toast.error(error.message);
      setArticulos([]);
    } else {
      setArticulos(data ?? []);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const abrirNuevo = () => {
    setEditandoId(null);
    setDraft(emptyDraft());
    setDialogAbierto(true);
  };

  const abrirEditar = (art: ArticuloConPrecio) => {
    setEditandoId(art.id);
    setDraft({
      codigo: art.codigo,
      descripcion: art.descripcion,
      unidad: art.unidad,
      calcula_material: art.calcula_material,
      medida_estandar_m2: art.medida_estandar_m2,
      prefer_modo_manual: art.prefer_modo_manual,
      sort_order: art.sort_order,
    });
    setDialogAbierto(true);
  };

  const cerrarDialog = () => {
    setDialogAbierto(false);
    setEditandoId(null);
    setDraft(emptyDraft());
  };

  const handleGuardar = async () => {
    if (!draft.codigo.trim() || !draft.descripcion.trim()) {
      toast.error("Completá código y descripción.");
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado.");
      return;
    }

    setGuardando(true);
    try {
      if (editandoId) {
        const { error } = await updateArticulo(editandoId, draft);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Artículo actualizado.");
      } else {
        const { error } = await createArticulo(draft);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Artículo creado.");
      }
      cerrarDialog();
      await recargar();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <h2 className="sr-only">Catálogo de artículos</h2>
        <Button type="button" size="sm" className="gap-1.5" onClick={abrirNuevo}>
          <Plus className="h-4 w-4" />
          Nuevo artículo
        </Button>
      </div>

      {cargando ? (
        <div className="rounded-lg border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Cargando artículos…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Calcula mat.</TableHead>
                <TableHead>Std m²</TableHead>
                <TableHead>Modo manual</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {articulos.map((art) => (
                <TableRow key={art.id}>
                  <TableCell className="font-mono text-xs">{art.codigo}</TableCell>
                  <TableCell>{art.descripcion}</TableCell>
                  <TableCell>{labelUnidad(art.unidad)}</TableCell>
                  <TableCell>{art.calcula_material ? "Sí" : "No"}</TableCell>
                  <TableCell className="tabular-nums">
                    {art.medida_estandar_m2 != null ? art.medida_estandar_m2 : "—"}
                  </TableCell>
                  <TableCell>{art.prefer_modo_manual ? "Sí" : "No"}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Editar"
                      onClick={() => abrirEditar(art)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogAbierto} onOpenChange={(o) => !o && cerrarDialog()}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar artículo" : "Nuevo artículo"}</DialogTitle>
            <DialogDescription>
              Unidad y flags de cálculo determinan los campos habilitados en presupuestos (alto,
              ancho, m²).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Código</Label>
                <Input
                  className="h-9 text-sm"
                  value={draft.codigo}
                  onChange={(e) => setDraft((d) => ({ ...d, codigo: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unidad</Label>
                <Select
                  value={draft.unidad}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, unidad: v as UnidadArticuloDb }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <Input
                className="h-9 text-sm"
                value={draft.descripcion}
                onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div>
                <Label className="text-xs">Calcula material</Label>
                <p className="text-[11px] text-muted-foreground">
                  Habilita alto/ancho y suma m² al presupuesto.
                </p>
              </div>
              <Switch
                checked={draft.calcula_material}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, calcula_material: v }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Medida estándar (m² por unidad)</Label>
              <Input
                className="h-9 text-sm tabular-nums"
                inputMode="decimal"
                placeholder="Vacío = sin estándar"
                value={
                  draft.medida_estandar_m2 != null ? String(draft.medida_estandar_m2) : ""
                }
                onChange={(e) => {
                  const t = e.target.value.trim().replace(",", ".");
                  setDraft((d) => ({
                    ...d,
                    medida_estandar_m2: t === "" ? null : Number.parseFloat(t),
                  }));
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div>
                <Label className="text-xs">Preferir m² totales (manual)</Label>
                <p className="text-[11px] text-muted-foreground">
                  Solo artículos M2 sin medida estándar.
                </p>
              </div>
              <Switch
                checked={draft.prefer_modo_manual}
                disabled={draft.unidad !== "M2" || !draft.calcula_material}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, prefer_modo_manual: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrarDialog}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleGuardar()} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
