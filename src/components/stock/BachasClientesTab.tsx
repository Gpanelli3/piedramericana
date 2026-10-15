"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import {
  createBachaInventario,
  fetchBachasInventario,
  updateBachaInventarioEstado,
  type BachaInventarioRow,
} from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { BachaInventarioEstado, BachaOrigen } from "@/types/database";

const ESTADO_LABEL: Record<BachaInventarioEstado, string> = {
  disponible: "Disponible",
  asignada: "Asignada",
  usada: "Usada",
  baja: "Baja",
};

const ORIGEN_TODOS = "__all__";

export function BachasInventarioTab() {
  const [rows, setRows] = useState<BachaInventarioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtroOrigen, setFiltroOrigen] = useState<string>(ORIGEN_TODOS);
  const [draft, setDraft] = useState({
    origen: "propia" as BachaOrigen,
    cliente_nombre: "",
    modelo: "",
    medidas: "",
    ubicacion: "",
    notas: "",
  });

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      setRows(await fetchBachasInventario());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar las bachas");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visibles = useMemo(() => {
    if (filtroOrigen === ORIGEN_TODOS) return rows;
    return rows.filter((r) => r.origen === filtroOrigen);
  }, [rows, filtroOrigen]);

  const resetDraft = () =>
    setDraft({
      origen: "propia",
      cliente_nombre: "",
      modelo: "",
      medidas: "",
      ubicacion: "",
      notas: "",
    });

  const handleOpenChange = (next: boolean) => {
    if (!next) resetDraft();
    setOpen(next);
  };

  const handleSave = async () => {
    if (draft.origen === "cliente" && !draft.cliente_nombre.trim()) {
      toast.error("Indicá el nombre del cliente.");
      return;
    }
    setSaving(true);
    try {
      await createBachaInventario({
        origen: draft.origen,
        cliente_nombre: draft.origen === "cliente" ? draft.cliente_nombre.trim() : null,
        modelo: draft.modelo.trim() || null,
        medidas: draft.medidas.trim() || null,
        ubicacion: draft.ubicacion.trim() || null,
        notas: draft.notas.trim() || null,
        estado: "disponible",
      });
      toast.success("Bacha registrada");
      handleOpenChange(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar");
    } finally {
      setSaving(false);
    }
  };

  const handleEstado = async (id: string, estado: BachaInventarioEstado) => {
    try {
      await updateBachaInventarioEstado(id, estado);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, estado } : r)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filtroOrigen} onValueChange={setFiltroOrigen}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ORIGEN_TODOS}>Todos los orígenes</SelectItem>
              <SelectItem value="propia">Nuestras</SelectItem>
              <SelectItem value="cliente">Del cliente</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" size="sm" className="h-9 gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Registrar bacha
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Origen
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cliente
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Modelo
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ubicación
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Estado
                </TableHead>
                <TableHead className="pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Notas
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : visibles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Todavía no hay bachas registradas.
                  </TableCell>
                </TableRow>
              ) : (
                visibles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4 text-sm">
                      {r.origen === "cliente" ? (
                        <span className="font-medium">Del cliente</span>
                      ) : (
                        "Nuestra"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.origen === "cliente" ? (
                        <span className="font-medium">{r.cliente_nombre?.trim() || "—"}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.modelo?.trim() || "—"}
                      {r.medidas?.trim() ? ` · ${r.medidas.trim()}` : ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.ubicacion?.trim() || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={r.estado}
                        onChange={(e) =>
                          void handleEstado(r.id, e.target.value as BachaInventarioEstado)
                        }
                      >
                        {(Object.keys(ESTADO_LABEL) as BachaInventarioEstado[]).map((k) => (
                          <option key={k} value={k}>
                            {ESTADO_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="pr-4 text-sm text-muted-foreground">
                      {r.notas?.trim() || "—"}
                      {r.origen === "cliente" ? (
                        <span className="ml-1 text-[11px] text-muted-foreground">No vendible</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Registrar bacha</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-sm">Origen</Label>
              <Select
                value={draft.origen}
                onValueChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    origen: v === "cliente" ? "cliente" : "propia",
                    cliente_nombre: v === "cliente" ? d.cliente_nombre : "",
                  }))
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="propia">Nuestra</SelectItem>
                  <SelectItem value="cliente">Del cliente (no vendible)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.origen === "cliente" ? (
              <div className="space-y-1.5">
                <Label className="text-sm">Cliente</Label>
                <Input
                  className="h-10"
                  value={draft.cliente_nombre}
                  onChange={(e) => setDraft((d) => ({ ...d, cliente_nombre: e.target.value }))}
                  placeholder="Nombre del cliente"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-sm">Modelo (opcional)</Label>
              <Input
                className="h-10"
                value={draft.modelo}
                onChange={(e) => setDraft((d) => ({ ...d, modelo: e.target.value }))}
                placeholder="Ej. Johnson 70x40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Medidas (opcional)</Label>
              <Input
                className="h-10"
                value={draft.medidas}
                onChange={(e) => setDraft((d) => ({ ...d, medidas: e.target.value }))}
                placeholder="Ej. 70 × 40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Ubicación (opcional)</Label>
              <Input
                className="h-10"
                value={draft.ubicacion}
                onChange={(e) => setDraft((d) => ({ ...d, ubicacion: e.target.value }))}
                placeholder="Ej. Estantería B3"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Notas (opcional)</Label>
              <Input
                className="h-10"
                value={draft.notas}
                onChange={(e) => setDraft((d) => ({ ...d, notas: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={saving || (draft.origen === "cliente" && !draft.cliente_nombre.trim())}
              onClick={() => void handleSave()}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
