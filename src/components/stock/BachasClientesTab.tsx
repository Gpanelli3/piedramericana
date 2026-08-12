"use client";

import { useCallback, useEffect, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import {
  createBachaCliente,
  fetchBachasClientes,
  updateBachaClienteEstado,
  type BachaClienteRow,
} from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { BachaClienteEstado } from "@/types/database";

const ESTADO_LABEL: Record<BachaClienteEstado, string> = {
  pendiente: "Pendiente",
  en_taller: "En taller",
  usada: "Usada",
};

export function BachasClientesTab() {
  const [rows, setRows] = useState<BachaClienteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    cliente_nombre: "",
    modelo: "",
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
      setRows(await fetchBachasClientes());
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

  const resetDraft = () =>
    setDraft({ cliente_nombre: "", modelo: "", ubicacion: "", notas: "" });

  const handleOpenChange = (next: boolean) => {
    if (!next) resetDraft();
    setOpen(next);
  };

  const handleSave = async () => {
    const nombre = draft.cliente_nombre.trim();
    if (!nombre) {
      toast.error("Indicá el nombre del cliente.");
      return;
    }
    setSaving(true);
    try {
      await createBachaCliente({
        cliente_nombre: nombre,
        modelo: draft.modelo.trim() || null,
        ubicacion: draft.ubicacion.trim() || null,
        notas: draft.notas.trim() || null,
        estado: "pendiente",
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

  const handleEstado = async (id: string, estado: BachaClienteEstado) => {
    try {
      await updateBachaClienteEstado(id, estado);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, estado } : r)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Bachas que trae el cliente. Registro mínimo (sin vínculo OT todavía).
        </p>
        <Button type="button" size="sm" className="h-9 gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Registrar bacha
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Todavía no hay bachas de clientes registradas.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4 text-sm font-medium">{r.cliente_nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.modelo?.trim() || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.ubicacion?.trim() || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={r.estado}
                        onChange={(e) =>
                          void handleEstado(r.id, e.target.value as BachaClienteEstado)
                        }
                      >
                        {(Object.keys(ESTADO_LABEL) as BachaClienteEstado[]).map((k) => (
                          <option key={k} value={k}>
                            {ESTADO_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="pr-4 text-sm text-muted-foreground">
                      {r.notas?.trim() || "—"}
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
            <DialogTitle>Registrar bacha de cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-sm">Cliente</Label>
              <Input
                className="h-10"
                value={draft.cliente_nombre}
                onChange={(e) => setDraft((d) => ({ ...d, cliente_nombre: e.target.value }))}
                placeholder="Nombre del cliente"
              />
            </div>
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
              disabled={saving || !draft.cliente_nombre.trim()}
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
