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
import { Check, ChevronDown, Plus } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { listClients, type ClientePresupuesto } from "@/lib/clients-api";
import { parseDecimalInput } from "@/lib/presupuesto-calculos";
import {
  createBachaInventario,
  fetchBachasInventario,
  type BachaInventarioLista,
} from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { BachaOrigen } from "@/types/database";

function etiquetaEstadoBacha(row: BachaInventarioLista): string {
  if (row.ot_id) return row.ot_estado === "done" ? "Usada" : "Ocupada";
  if (row.estado === "usada") return "Usada";
  if (row.estado === "baja") return "Baja";
  return "Disponible";
}

const ORIGEN_TODOS = "__all__";

export function BachasInventarioTab() {
  const [rows, setRows] = useState<BachaInventarioLista[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtroOrigen, setFiltroOrigen] = useState<string>(ORIGEN_TODOS);
  const [clientes, setClientes] = useState<ClientePresupuesto[]>([]);
  const [clientesCargando, setClientesCargando] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState({
    origen: "propia" as BachaOrigen,
    cliente_id: "",
    cliente_nombre: "",
    modelo: "",
    medidas: "",
    ubicacion: "",
    notas: "",
    precio_venta: "",
    moneda: "ars" as "ars" | "usd",
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

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setClientesCargando(true);
    void listClients().then(({ data, error }) => {
      if (cancel) return;
      if (error) toast.error(error.message);
      setClientes(data);
      setClientesCargando(false);
    });
    return () => {
      cancel = true;
    };
  }, [open]);

  const visibles = useMemo(() => {
    if (filtroOrigen === ORIGEN_TODOS) return rows;
    return rows.filter((r) => r.origen === filtroOrigen);
  }, [rows, filtroOrigen]);

  const resetDraft = () =>
    setDraft({
      origen: "propia",
      cliente_id: "",
      cliente_nombre: "",
      modelo: "",
      medidas: "",
      ubicacion: "",
      notas: "",
      precio_venta: "",
      moneda: "ars",
    });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetDraft();
      setPickerOpen(false);
    }
    setOpen(next);
  };

  const elegirCliente = (c: ClientePresupuesto) => {
    setDraft((d) => ({ ...d, cliente_id: c.id, cliente_nombre: c.nombre }));
    // Cerrar en el próximo turno: si el popup se va en el mismo clic, el evento
    // cae sobre el botón de abajo y lo vuelve a abrir.
    window.setTimeout(() => setPickerOpen(false), 0);
  };

  const handleSave = async () => {
    if (draft.origen === "cliente" && !draft.cliente_id) {
      toast.error("Elegí el cliente.");
      return;
    }
    const precio = parseDecimalInput(draft.precio_venta);
    if (draft.origen === "propia" && precio <= 0) {
      toast.error("Cargá el precio de venta de la bacha.");
      return;
    }
    setSaving(true);
    try {
      await createBachaInventario({
        precio_venta: draft.origen === "propia" ? precio : null,
        moneda: draft.moneda,
        origen: draft.origen,
        cliente_id: draft.origen === "cliente" ? draft.cliente_id : null,
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
                      {r.origen === "propia" && r.precio_venta != null ? (
                        <span className="block text-xs font-medium text-foreground">
                          {r.moneda === "usd" ? "US$ " : "$ "}
                          {Number(r.precio_venta).toLocaleString("es-AR", {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.ubicacion?.trim() || "—"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-normal">
                      <div className="flex flex-col">
                        <span>{etiquetaEstadoBacha(r)}</span>
                        {r.ot_id ? (
                          <span
                            className="max-w-[12rem] truncate text-[11px] text-muted-foreground"
                            title={r.ot_titulo ?? undefined}
                          >
                            {r.ot_titulo?.trim() || "Orden de trabajo"}
                          </span>
                        ) : null}
                      </div>
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
                    cliente_id: v === "cliente" ? d.cliente_id : "",
                    cliente_nombre: v === "cliente" ? d.cliente_nombre : "",
                  }))
                }
              >
                <SelectTrigger className="h-10 w-full">
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
                <button
                  type="button"
                  disabled={clientesCargando || clientes.length === 0}
                  onClick={() => setPickerOpen(true)}
                  className="border-input flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-card px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    className={cn(
                      "truncate",
                      !draft.cliente_nombre && "text-muted-foreground",
                    )}
                  >
                    {clientesCargando
                      ? "Cargando clientes…"
                      : clientes.length === 0
                        ? "No hay clientes cargados"
                        : draft.cliente_nombre || "Elegí un cliente"}
                  </span>
                  <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
                </button>
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
            {draft.origen === "propia" ? (
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <div className="space-y-1.5">
                  <Label className="text-sm">Precio de venta</Label>
                  <Input
                    className="h-10"
                    inputMode="decimal"
                    value={draft.precio_venta}
                    onChange={(e) => setDraft((d) => ({ ...d, precio_venta: e.target.value }))}
                    placeholder="Ej. 80000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Moneda</Label>
                  <Select
                    value={draft.moneda}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, moneda: v === "usd" ? "usd" : "ars" }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ars">ARS</SelectItem>
                      <SelectItem value="usd">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
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
              disabled={saving || (draft.origen === "cliente" && !draft.cliente_id)}
              onClick={() => void handleSave()}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton>
          <DialogHeader className="px-4 pt-4 pr-12 pb-2">
            <DialogTitle>Elegir cliente</DialogTitle>
          </DialogHeader>
          <Command>
            <CommandInput autoFocus placeholder="Buscar por nombre, teléfono o mail…" />
            <CommandList className="max-h-80">
              <CommandEmpty>Ningún cliente coincide.</CommandEmpty>
              <CommandGroup>
                {clientes.map((c) => {
                  const detalle = [c.contacto !== c.nombre ? c.contacto : null, c.tel, c.email]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <CommandItem
                      key={c.id}
                      value={`${c.nombre} ${c.contacto} ${c.tel} ${c.email}`}
                      onSelect={() => elegirCliente(c)}
                    >
                      <Check
                        className={cn(
                          "size-4",
                          draft.cliente_id === c.id ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{c.nombre}</span>
                        {detalle ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {detalle}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
