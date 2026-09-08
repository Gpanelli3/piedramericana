"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdelantoFormDialog } from "@/components/equipo/AdelantoFormDialog";
import { listEmpleados, nombreEmpleado, type EmpleadoRow } from "@/lib/empleados-api";
import { deleteAdelanto, listAdelantos, type AdelantoConEmpleado } from "@/lib/sueldos-api";
import { formatFechaIso, formatPesos } from "@/lib/sueldos-calculos";
import { isSupabaseConfigured } from "@/lib/supabase";

function metodoLabel(m: string): string {
  return m === "transferencia" ? "Transferencia" : "Efectivo";
}

export function AdelantosCatalogo() {
  const [filas, setFilas] = useState<AdelantoConEmpleado[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEmpleado, setFiltroEmpleado] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState<"pendientes" | "todos">("pendientes");
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editando, setEditando] = useState<AdelantoConEmpleado | null>(null);
  const [aBorrar, setABorrar] = useState<AdelantoConEmpleado | null>(null);
  const [borrando, setBorrando] = useState(false);

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const [adel, emps] = await Promise.all([listAdelantos(), listEmpleados()]);
    if (adel.error) {
      toast.error(`No se pudieron cargar los adelantos: ${adel.error.message}`);
      setFilas([]);
    } else {
      setFilas(adel.data);
    }
    if (!emps.error) setEmpleados(emps.data);
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const filtrados = useMemo(() => {
    let list = filas;
    if (filtroEstado === "pendientes") {
      list = list.filter((a) => !a.liquidacion_id);
    }
    if (filtroEmpleado !== "todos") {
      list = list.filter((a) => a.empleado_id === filtroEmpleado);
    }
    const q = busqueda.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const nombre = a.empleados ? nombreEmpleado(a.empleados) : "";
        return (
          nombre.toLowerCase().includes(q) ||
          (a.notas ?? "").toLowerCase().includes(q) ||
          metodoLabel(a.metodo).toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [busqueda, filtroEmpleado, filtroEstado, filas]);

  const kpis = useMemo(() => {
    const pendientes = filas.filter((a) => !a.liquidacion_id);
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const anio = hoy.getFullYear();
    const delMes = filas.filter((a) => {
      const m = /^(\d{4})-(\d{2})/.exec(a.fecha);
      return m ? Number(m[1]) === anio && Number(m[2]) === mes : false;
    });
    return {
      pendientesN: pendientes.length,
      pendientesMonto: pendientes.reduce((s, a) => s + a.monto, 0),
      mesMonto: delMes.reduce((s, a) => s + a.monto, 0),
    };
  }, [filas]);

  const onSaved = (row: AdelantoConEmpleado) => {
    setFilas((prev) => {
      const sin = prev.filter((a) => a.id !== row.id);
      return [row, ...sin].sort((a, b) => {
        const f = b.fecha.localeCompare(a.fecha);
        if (f !== 0) return f;
        return b.created_at.localeCompare(a.created_at);
      });
    });
  };

  const confirmarBorrar = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    const { error } = await deleteAdelanto(aBorrar.id);
    setBorrando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFilas((prev) => prev.filter((a) => a.id !== aBorrar.id));
    setABorrar(null);
    toast.success("Adelanto eliminado");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <p className="text-xs text-muted-foreground">Pendientes de descontar</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatPesos(kpis.pendientesMonto)}
          </p>
          <p className="text-[11px] text-muted-foreground">{kpis.pendientesN} adelanto(s)</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <p className="text-xs text-muted-foreground">Registrados este mes</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPesos(kpis.mesMonto)}</p>
          <p className="text-[11px] text-muted-foreground">Suma de altas del mes calendario</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <p className="text-xs text-muted-foreground">Cómo se descuentan</p>
          <p className="mt-1 text-sm text-foreground">
            Al cerrar la liquidación del mes en Sueldos.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative min-w-[180px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="Buscar por empleado o nota…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <Select value={filtroEmpleado} onValueChange={setFiltroEmpleado}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Empleado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {empleados.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {nombreEmpleado(e)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filtroEstado}
            onValueChange={(v) => setFiltroEstado(v as "pendientes" | "todos")}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendientes">Pendientes</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          className="gap-1.5 shrink-0"
          onClick={() => {
            setEditando(null);
            setDialogAbierto(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nuevo adelanto
        </Button>
      </div>

      {!isSupabaseConfigured ? (
        <p className="text-sm text-muted-foreground">
          Configurá Supabase para registrar adelantos y viáticos.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="hidden md:table-cell">Método</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20" />
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
                      ? "Todavía no hay adelantos. Registrá el primero."
                      : "Ningún adelanto coincide con el filtro."}
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((a) => {
                  const bloqueado = Boolean(a.liquidacion_id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="tabular-nums">{formatFechaIso(a.fecha)}</TableCell>
                      <TableCell className="font-medium">
                        {a.empleados ? nombreEmpleado(a.empleados) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatPesos(a.monto)}</TableCell>
                      <TableCell className="hidden md:table-cell">{metodoLabel(a.metodo)}</TableCell>
                      <TableCell>
                        {bloqueado ? (
                          <Badge variant="soft">En liquidación</Badge>
                        ) : (
                          <Badge variant="warning">Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Editar"
                            disabled={bloqueado}
                            onClick={() => {
                              setEditando(a);
                              setDialogAbierto(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Eliminar"
                            disabled={bloqueado}
                            onClick={() => setABorrar(a)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AdelantoFormDialog
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
        adelanto={editando}
        onSaved={onSaved}
      />

      <AlertDialog open={Boolean(aBorrar)} onOpenChange={(o) => !o && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este adelanto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el registro interno. No se toca el movimiento de caja, si lo cargaste aparte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={borrando}
              onClick={(e) => {
                e.preventDefault();
                void confirmarBorrar();
              }}
            >
              {borrando ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
