"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ExportacionFormDialog } from "@/components/comercio-exterior/ExportacionFormDialog";
import { ExportacionFicha } from "@/components/comercio-exterior/ExportacionFicha";
import {
  deleteExportacion,
  estadoExportacionLabel,
  EXPORTACION_ESTADOS,
  fetchExportaciones,
  yaTieneIngreso,
  type ExportacionListRow,
} from "@/lib/exportaciones-api";
import { isSupabaseConfigured } from "@/lib/supabase";

function fmtFecha(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtMonto(n: number | null, moneda: string) {
  if (n == null) return "—";
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  };
  const prefix = moneda === "usd" ? "USD " : "$ ";
  return prefix + n.toLocaleString("es-AR", opts);
}

export function ExportacionesCatalogo() {
  const [filas, setFilas] = useState<ExportacionListRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editando, setEditando] = useState<ExportacionListRow | null>(null);
  const [ficha, setFicha] = useState<ExportacionListRow | null>(null);

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      setFilas(await fetchExportaciones());
    } catch (err) {
      toast.error(
        `No se pudieron cargar las exportaciones: ${err instanceof Error ? err.message : String(err)}`,
      );
      setFilas([]);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const stats = useMemo(() => {
    const abiertas = filas.filter((r) => r.estado !== "cobrada");
    const cobradas = filas.filter((r) => r.estado === "cobrada" || yaTieneIngreso(r));
    return {
      abiertas: abiertas.length,
      cobradas: cobradas.length,
      total: filas.length,
    };
  }, [filas]);

  const filtrados = useMemo(() => {
    let list = filas;
    if (filtroEstado === "abiertas") list = list.filter((r) => r.estado !== "cobrada");
    else if (filtroEstado !== "todos") list = list.filter((r) => r.estado === filtroEstado);
    const q = busqueda.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.descripcion.toLowerCase().includes(q) ||
          r.client_name.toLowerCase().includes(q) ||
          (r.pais_destino ?? "").toLowerCase().includes(q) ||
          (r.nro_factura ?? "").toLowerCase().includes(q) ||
          (r.nro_pedido ?? "").toLowerCase().includes(q) ||
          (r.nro_bl ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [busqueda, filtroEstado, filas]);

  const onSaved = (row: ExportacionListRow) => {
    setFilas((prev) => {
      const sin = prev.filter((r) => r.id !== row.id);
      return [row, ...sin];
    });
    if (ficha?.id === row.id) setFicha(row);
  };

  if (ficha) {
    return (
      <ExportacionFicha exportacion={ficha} onBack={() => setFicha(null)} onUpdated={onSaved} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" className="text-left" onClick={() => setFiltroEstado("abiertas")}>
          <Card className={`gap-0 py-0 ${filtroEstado === "abiertas" ? "border-primary" : ""}`}>
            <CardContent className="flex items-center gap-3 p-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Abiertas</p>
                <p className="text-lg font-semibold tabular-nums">{stats.abiertas}</p>
              </div>
            </CardContent>
          </Card>
        </button>
        <button type="button" className="text-left" onClick={() => setFiltroEstado("cobrada")}>
          <Card className={`gap-0 py-0 ${filtroEstado === "cobrada" ? "border-primary" : ""}`}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Cobradas</p>
              <p className="text-lg font-semibold tabular-nums">{stats.cobradas}</p>
            </CardContent>
          </Card>
        </button>
        <Card className="gap-0 py-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-semibold tabular-nums">{stats.total}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="Buscar por mercadería, cliente, factura…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="abiertas">Abiertas</SelectItem>
              {EXPORTACION_ESTADOS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          className="h-9 gap-1.5 shrink-0"
          onClick={() => {
            setEditando(null);
            setDialogAbierto(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva exportación
        </Button>
      </div>

      {!isSupabaseConfigured ? (
        <p className="text-sm text-muted-foreground">
          Configurá Supabase para ver y editar las exportaciones.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mercadería</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Destino</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Factura</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {filas.length === 0
                      ? "Todavía no hay exportaciones. Creá la primera."
                      : "Ninguna exportación coincide con el filtro."}
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setFicha(r)}>
                    <TableCell className="font-medium">
                      {r.descripcion}
                      {r.nro_pedido ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          Pedido {r.nro_pedido}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{r.client_name}</TableCell>
                    <TableCell className="hidden md:table-cell">{r.pais_destino || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {estadoExportacionLabel(r.estado)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {r.nro_factura ? `${r.nro_factura} · ${fmtMonto(r.monto_factura, r.moneda)}` : fmtFecha(r.fecha_pedido)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Eliminar"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!confirm(`¿Eliminar la exportación "${r.descripcion}"?`)) return;
                          void deleteExportacion(r.id)
                            .then(() => {
                              setFilas((prev) => prev.filter((f) => f.id !== r.id));
                              toast.success("Exportación eliminada.");
                            })
                            .catch((err) =>
                              toast.error(err instanceof Error ? err.message : "No se pudo eliminar."),
                            );
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <ExportacionFormDialog
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
        exportacion={editando}
        onSaved={onSaved}
      />
    </div>
  );
}
