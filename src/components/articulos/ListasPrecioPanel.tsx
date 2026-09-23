"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  createListaPrecio,
  fetchListasPrecioTodas,
  fetchMaterialesPreciosDeLista,
  updateListaPrecio,
  upsertPrecioListaMaterial,
  type ListaPrecioUpsertInput,
  type PrecioListaMaterialRow,
} from "@/lib/articulos-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ListaPrecioRow } from "@/types/articulos";

function emptyLista(): ListaPrecioUpsertInput {
  return {
    codigo: "",
    label: "",
    moneda: "usd",
    descripcion: "",
    activa: true,
    sort_order: 0,
  };
}

export function ListasPrecioPanel() {
  const [listas, setListas] = useState<ListaPrecioRow[]>([]);
  const [listaId, setListaId] = useState<string | null>(null);
  const [filas, setFilas] = useState<PrecioListaMaterialRow[]>([]);
  const [draftPrecios, setDraftPrecios] = useState<Record<string, string>>({});
  const [cargandoListas, setCargandoListas] = useState(true);
  const [cargandoFilas, setCargandoFilas] = useState(false);
  const [guardandoPrecioId, setGuardandoPrecioId] = useState<string | null>(null);

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [draftLista, setDraftLista] = useState<ListaPrecioUpsertInput>(emptyLista);
  const [guardandoLista, setGuardandoLista] = useState(false);

  const listaActiva = useMemo(
    () => listas.find((l) => l.id === listaId) ?? null,
    [listas, listaId],
  );

  const recargarListas = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setListas([]);
      setCargandoListas(false);
      return;
    }
    setCargandoListas(true);
    const { data, error } = await fetchListasPrecioTodas();
    if (error) {
      toast.error(error.message);
      setListas([]);
    } else {
      const rows = data ?? [];
      setListas(rows);
      setListaId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    }
    setCargandoListas(false);
  }, []);

  const recargarFilas = useCallback(async (id: string) => {
    setCargandoFilas(true);
    const { data, error } = await fetchMaterialesPreciosDeLista(id);
    if (error) {
      toast.error(error.message);
      setFilas([]);
      setDraftPrecios({});
    } else {
      const rows = data ?? [];
      setFilas(rows);
      const map: Record<string, string> = {};
      for (const r of rows) {
        map[r.material_id] = r.precio != null ? String(r.precio) : "";
      }
      setDraftPrecios(map);
    }
    setCargandoFilas(false);
  }, []);

  useEffect(() => {
    void recargarListas();
  }, [recargarListas]);

  useEffect(() => {
    if (!listaId) {
      setFilas([]);
      return;
    }
    void recargarFilas(listaId);
  }, [listaId, recargarFilas]);

  const abrirNuevaLista = () => {
    setEditandoId(null);
    setDraftLista({
      ...emptyLista(),
      sort_order: listas.length,
    });
    setDialogAbierto(true);
  };

  const abrirEditarLista = (l: ListaPrecioRow) => {
    setEditandoId(l.id);
    setDraftLista({
      codigo: l.codigo,
      label: l.label,
      moneda: l.moneda,
      descripcion: l.descripcion ?? "",
      activa: l.activa !== false,
      sort_order: l.sort_order,
    });
    setDialogAbierto(true);
  };

  const guardarLista = async () => {
    if (!draftLista.codigo.trim() || !draftLista.label.trim()) {
      toast.error("Completá código y nombre de la lista.");
      return;
    }
    setGuardandoLista(true);
    try {
      if (editandoId) {
        const { error } = await updateListaPrecio(editandoId, draftLista);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Lista actualizada.");
      } else {
        const { data, error } = await createListaPrecio(draftLista);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Lista creada.");
        if (data) setListaId(data.id);
      }
      setDialogAbierto(false);
      await recargarListas();
    } finally {
      setGuardandoLista(false);
    }
  };

  const guardarPrecioFila = async (materialId: string) => {
    if (!listaId) return;
    const raw = (draftPrecios[materialId] ?? "").trim().replace(",", ".");
    let precio: number | null = null;
    if (raw !== "") {
      const n = Number.parseFloat(raw);
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Precio inválido.");
        return;
      }
      precio = n;
    }
    setGuardandoPrecioId(materialId);
    const { error } = await upsertPrecioListaMaterial({
      lista_precio_id: listaId,
      material_id: materialId,
      precio,
    });
    setGuardandoPrecioId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(precio == null ? "Precio quitado." : "Precio guardado.");
    await recargarFilas(listaId);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1 min-w-0 flex-1 sm:max-w-sm">
          <Label className="text-xs">Lista</Label>
          <div className="flex gap-2">
            <Select
              value={listaId ?? undefined}
              onValueChange={setListaId}
              disabled={cargandoListas || listas.length === 0}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={cargandoListas ? "Cargando…" : "Elegí una lista"} />
              </SelectTrigger>
              <SelectContent>
                {listas.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                    {l.activa === false ? " (inactiva)" : ""}
                    {" · "}
                    {l.moneda.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {listaActiva ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Editar lista"
                onClick={() => abrirEditarLista(listaActiva)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <Button type="button" size="sm" className="gap-1.5" onClick={abrirNuevaLista}>
          <Plus className="h-4 w-4" />
          Nueva lista
        </Button>
      </div>

      {listaActiva ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{listaActiva.label}</span>
          <Badge variant="outline" className="text-[11px] tabular-nums">
            {listaActiva.moneda.toUpperCase()}
          </Badge>
          {listaActiva.activa === false ? (
            <Badge variant="outline" className="text-[11px] border-amber-300 text-amber-900">
              Inactiva
            </Badge>
          ) : null}
          {listaActiva.descripcion ? (
            <span className="text-xs">{listaActiva.descripcion}</span>
          ) : null}
        </div>
      ) : null}

      {cargandoListas ? (
        <div className="rounded-lg border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Cargando listas…
        </div>
      ) : !listaId ? (
        <div className="rounded-lg border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Creá una lista de precios para mármoles, planchas y bachas.
        </div>
      ) : cargandoFilas ? (
        <div className="rounded-lg border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Cargando precios…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="w-36">Precio ({listaActiva?.moneda.toUpperCase()})</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => {
                const dirty =
                  (draftPrecios[f.material_id] ?? "") !==
                  (f.precio != null ? String(f.precio) : "");
                return (
                  <TableRow key={f.material_id}>
                    <TableCell className="font-mono text-xs">{f.codigo ?? "—"}</TableCell>
                    <TableCell>{f.name}</TableCell>
                    <TableCell>
                      <Input
                        className={cn(
                          "h-8 text-sm tabular-nums",
                          dirty && "border-amber-400",
                        )}
                        inputMode="decimal"
                        placeholder="—"
                        value={draftPrecios[f.material_id] ?? ""}
                        onChange={(e) =>
                          setDraftPrecios((prev) => ({
                            ...prev,
                            [f.material_id]: e.target.value,
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant={dirty ? "default" : "outline"}
                        className="h-8 text-xs"
                        disabled={!dirty || guardandoPrecioId === f.material_id}
                        onClick={() => void guardarPrecioFila(f.material_id)}
                      >
                        {guardandoPrecioId === f.material_id ? "…" : "Guardar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogAbierto} onOpenChange={(o) => !o && setDialogAbierto(false)}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar lista" : "Nueva lista de precios"}</DialogTitle>
            <DialogDescription>
              Las listas (General, Contado, etc.) definen el precio de mármoles, planchas y bachas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Código</Label>
                <Input
                  className="h-9 text-sm"
                  value={draftLista.codigo}
                  onChange={(e) =>
                    setDraftLista((d) => ({ ...d, codigo: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Moneda</Label>
                <Select
                  value={draftLista.moneda}
                  onValueChange={(v) =>
                    setDraftLista((d) => ({ ...d, moneda: v as "ars" | "usd" }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD</SelectItem>
                    <SelectItem value="ars">ARS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input
                className="h-9 text-sm"
                value={draftLista.label}
                onChange={(e) =>
                  setDraftLista((d) => ({ ...d, label: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <Input
                className="h-9 text-sm"
                value={draftLista.descripcion ?? ""}
                onChange={(e) =>
                  setDraftLista((d) => ({ ...d, descripcion: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div>
                <Label className="text-xs">Activa</Label>
                <p className="text-[11px] text-muted-foreground">
                  Si está off, no se ofrece al armar presupuestos.
                </p>
              </div>
              <Switch
                checked={draftLista.activa !== false}
                onCheckedChange={(v) => setDraftLista((d) => ({ ...d, activa: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogAbierto(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={guardandoLista}
              onClick={() => void guardarLista()}
            >
              {guardandoLista ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
