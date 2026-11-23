"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Search, Ship } from "lucide-react";
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
import { ImportacionFormDialog } from "@/components/comercio-exterior/ImportacionFormDialog";
import { ImportacionFicha } from "@/components/comercio-exterior/ImportacionFicha";
import {
  estadoLabel,
  fetchImportaciones,
  hoyISO,
  IMPORTACION_ESTADOS,
  isImportacionDemorada,
  type ImportacionListRow,
} from "@/lib/comercio-exterior-api";
import { isSupabaseConfigured } from "@/lib/supabase";

function fmtFecha(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ImportacionesCatalogo() {
  const [filas, setFilas] = useState<ImportacionListRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editando, setEditando] = useState<ImportacionListRow | null>(null);
  const [ficha, setFicha] = useState<ImportacionListRow | null>(null);

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      setFilas(await fetchImportaciones());
    } catch (err) {
      toast.error(`No se pudieron cargar las importaciones: ${err instanceof Error ? err.message : String(err)}`);
      setFilas([]);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const stats = useMemo(() => {
    const activas = filas.filter((r) => r.estado !== "en_deposito");
    const demoradas = filas.filter(isImportacionDemorada);
    const etas = activas
      .map((r) => r.fecha_estimada_llegada)
      .filter((d): d is string => Boolean(d))
      .sort();
    return {
      activas: activas.length,
      demoradas: demoradas.length,
      proximaEta: etas[0] ?? null,
    };
  }, [filas]);

  const filtrados = useMemo(() => {
    let list = filas;
    if (filtroEstado === "activas") list = list.filter((r) => r.estado !== "en_deposito");
    else if (filtroEstado === "demoradas") list = list.filter(isImportacionDemorada);
    else if (filtroEstado !== "todos") list = list.filter((r) => r.estado === filtroEstado);
    const q = busqueda.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.descripcion.toLowerCase().includes(q) ||
          r.supplier_name.toLowerCase().includes(q) ||
          r.pais_origen.toLowerCase().includes(q) ||
          (r.nro_orden_compra ?? "").toLowerCase().includes(q) ||
          (r.nro_conocimiento ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [busqueda, filtroEstado, filas]);

  const onSaved = (row: ImportacionListRow) => {
    setFilas((prev) => {
      const sin = prev.filter((r) => r.id !== row.id);
      return [row, ...sin];
    });
    if (ficha?.id === row.id) setFicha(row);
  };

  if (ficha) {
    return (
      <ImportacionFicha
        importacion={ficha}
        onBack={() => setFicha(null)}
        onUpdated={onSaved}
        onDeleted={(id) => {
          setFilas((prev) => prev.filter((f) => f.id !== id));
          setFicha(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3" data-guia="comex-resumen">
        <button type="button" className="text-left" onClick={() => setFiltroEstado("activas")}>
          <Card className={`gap-0 py-0 ${filtroEstado === "activas" ? "border-primary" : ""}`}>
            <CardContent className="flex items-center gap-3 p-3">
              <Ship className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Activas</p>
                <p className="text-lg font-semibold tabular-nums">{stats.activas}</p>
              </div>
            </CardContent>
          </Card>
        </button>
        <button type="button" className="text-left" onClick={() => setFiltroEstado("demoradas")}>
          <Card className={`gap-0 py-0 ${filtroEstado === "demoradas" ? "border-destructive" : ""}`}>
            <CardContent className="flex items-center gap-3 p-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Demoradas</p>
                <p className="text-lg font-semibold tabular-nums">{stats.demoradas}</p>
              </div>
            </CardContent>
          </Card>
        </button>
        <Card className="gap-0 py-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Próxima llegada</p>
            <p className="text-lg font-semibold">{fmtFecha(stats.proximaEta)}</p>
            {stats.proximaEta && stats.proximaEta < hoyISO() && (
              <p className="text-xs text-destructive">Vencida</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative max-w-md flex-1" data-guia="buscar">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="Buscar por mercadería, proveedor, OC…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="h-9 w-48" data-guia="comex-estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="activas">Activas</SelectItem>
              <SelectItem value="demoradas">Demoradas</SelectItem>
              {IMPORTACION_ESTADOS.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          className="h-9 gap-1.5 shrink-0"
          data-guia="accion-principal"
          onClick={() => {
            setEditando(null);
            setDialogAbierto(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva importación
        </Button>
      </div>

      {!isSupabaseConfigured ? (
        <p className="text-sm text-muted-foreground">
          Configurá Supabase para ver y editar las importaciones.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white" data-guia="lista">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mercadería</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="hidden md:table-cell">País</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Llegada estimada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {filas.length === 0
                      ? "Todavía no hay importaciones. Creá la primera."
                      : "Ninguna importación coincide con el filtro."}
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((r) => {
                  const demorada = isImportacionDemorada(r);
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setFicha(r)}
                    >
                      <TableCell className="font-medium">
                        {r.descripcion}
                        {r.nro_orden_compra ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            OC {r.nro_orden_compra}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>{r.supplier_name}</TableCell>
                      <TableCell className="hidden md:table-cell">{r.pais_origen}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="secondary" className="text-[10px]">
                            {estadoLabel(r.estado)}
                          </Badge>
                          {demorada && (
                            <Badge variant="destructive" className="text-[10px]">Demorada</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{fmtFecha(r.fecha_estimada_llegada)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <ImportacionFormDialog
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
        importacion={editando}
        onSaved={onSaved}
      />
    </div>
  );
}
