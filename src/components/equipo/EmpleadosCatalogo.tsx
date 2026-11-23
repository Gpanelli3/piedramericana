"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
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
import { EmpleadoFormDialog } from "@/components/equipo/EmpleadoFormDialog";
import { EmpleadoFichaSheet } from "@/components/equipo/EmpleadoFichaSheet";
import {
  listEmpleados,
  puestoLabel,
  type EmpleadoRow,
} from "@/lib/empleados-api";
import { isSupabaseConfigured } from "@/lib/supabase";

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatSueldo(n: number | string | null): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  return `$ ${v.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function nombreCompleto(e: EmpleadoRow): string {
  return `${e.apellido}, ${e.nombre}`;
}

export function EmpleadosCatalogo() {
  const [filas, setFilas] = useState<EmpleadoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"activos" | "todos">("activos");
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editando, setEditando] = useState<EmpleadoRow | null>(null);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const fichaEmpleado = fichaId ? filas.find((e) => e.id === fichaId) ?? null : null;

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const { data, error } = await listEmpleados();
    if (error) {
      toast.error(`No se pudieron cargar los empleados: ${error.message}`);
      setFilas([]);
    } else {
      setFilas(data);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const filtrados = useMemo(() => {
    let list = filas;
    if (filtroEstado === "activos") {
      list = list.filter((e) => e.activo);
    }
    const q = busqueda.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.nombre.toLowerCase().includes(q) ||
          e.apellido.toLowerCase().includes(q) ||
          (e.dni ?? "").toLowerCase().includes(q) ||
          (e.cuil ?? "").toLowerCase().includes(q) ||
          (e.telefono ?? "").toLowerCase().includes(q) ||
          (e.email ?? "").toLowerCase().includes(q) ||
          puestoLabel(e.puesto).toLowerCase().includes(q),
      );
    }
    return list;
  }, [busqueda, filtroEstado, filas]);

  const abrirNuevo = () => {
    setEditando(null);
    setDialogAbierto(true);
  };

  const abrirEditar = (e: EmpleadoRow) => {
    setFichaAbierta(false);
    setEditando(e);
    setDialogAbierto(true);
  };

  const abrirFicha = (e: EmpleadoRow) => {
    setFichaId(e.id);
    setFichaAbierta(true);
  };

  const onSaved = (empleado: EmpleadoRow) => {
    setFilas((prev) => {
      const sin = prev.filter((e) => e.id !== empleado.id);
      return [...sin, empleado].sort((a, b) => {
        if (a.activo !== b.activo) return a.activo ? -1 : 1;
        const ap = a.apellido.localeCompare(b.apellido, "es");
        if (ap !== 0) return ap;
        return a.nombre.localeCompare(b.nombre, "es");
      });
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative max-w-md flex-1" data-guia="equipo-buscar">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="Buscar por nombre, DNI, puesto…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <Select
            value={filtroEstado}
            onValueChange={(v) => setFiltroEstado(v as "activos" | "todos")}
          >
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activos">Activos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" className="h-9 gap-1.5 shrink-0" onClick={abrirNuevo} data-guia="equipo-nuevo">
          <Plus className="h-4 w-4" />
          Nuevo empleado
        </Button>
      </div>

      {!isSupabaseConfigured ? (
        <p className="text-sm text-muted-foreground">
          Configurá Supabase para ver y editar el maestro de empleados.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white" data-guia="equipo-tabla">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead className="hidden md:table-cell">Ingreso</TableHead>
                <TableHead className="hidden md:table-cell">Sueldo base</TableHead>
                <TableHead>Estado</TableHead>
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
                      ? "Todavía no hay empleados. Cargá el primero."
                      : "Ningún empleado coincide con la búsqueda."}
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((e) => (
                  <TableRow
                    key={e.id}
                    className={`cursor-pointer ${!e.activo ? "opacity-50" : ""}`}
                    onClick={() => abrirFicha(e)}
                  >
                    <TableCell className="font-medium">{nombreCompleto(e)}</TableCell>
                    <TableCell>{puestoLabel(e.puesto)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatFecha(e.fecha_ingreso)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell tabular-nums">
                      {formatSueldo(e.sueldo_base)}
                    </TableCell>
                    <TableCell>
                      {e.activo ? (
                        <Badge variant="success">Activo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Inactivo
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <EmpleadoFichaSheet
        empleado={fichaEmpleado}
        open={fichaAbierta}
        onOpenChange={setFichaAbierta}
        onEdit={abrirEditar}
      />

      <EmpleadoFormDialog
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
        empleado={editando}
        onSaved={onSaved}
      />
    </div>
  );
}
