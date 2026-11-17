"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { LiquidacionFormDialog } from "@/components/equipo/LiquidacionFormDialog";
import { nombreEmpleado } from "@/lib/empleados-api";
import {
  armarLiquidacionesDelMes,
  deleteLiquidacion,
  listLiquidaciones,
  type LiquidacionConDetalle,
} from "@/lib/sueldos-api";
import {
  formatPesos,
  MESES_LABEL,
  periodoActual,
} from "@/lib/sueldos-calculos";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function SueldosCatalogo() {
  const { user } = useAuth();
  const actual = periodoActual();
  const [mes, setMes] = useState(actual.mes);
  const [anio, setAnio] = useState(actual.anio);
  const [filas, setFilas] = useState<LiquidacionConDetalle[]>([]);
  const [cargando, setCargando] = useState(true);
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editando, setEditando] = useState<LiquidacionConDetalle | null>(null);
  const [aBorrar, setABorrar] = useState<LiquidacionConDetalle | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [armando, setArmando] = useState(false);

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const { data, error } = await listLiquidaciones({ mes, anio });
    if (error) {
      toast.error(`No se pudieron cargar las liquidaciones: ${error.message}`);
      setFilas([]);
    } else {
      setFilas(
        [...data].sort((a, b) => {
          const na = a.empleados ? nombreEmpleado(a.empleados) : "";
          const nb = b.empleados ? nombreEmpleado(b.empleados) : "";
          return na.localeCompare(nb, "es");
        }),
      );
    }
    setCargando(false);
  }, [mes, anio]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const kpis = useMemo(() => {
    const bruto = filas.reduce((s, r) => s + r.total_bruto, 0);
    const desc = filas.reduce((s, r) => s + r.total_descuentos, 0);
    const neto = filas.reduce((s, r) => s + r.total_neto, 0);
    const borradores = filas.filter((r) => r.estado === "borrador").length;
    return { bruto, desc, neto, borradores, n: filas.length };
  }, [filas]);

  const anios = useMemo(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1, y - 2];
  }, []);

  const onSaved = (row: LiquidacionConDetalle) => {
    if (row.periodo_mes !== mes || row.periodo_anio !== anio) {
      void recargar();
      return;
    }
    setFilas((prev) => {
      const sin = prev.filter((r) => r.id !== row.id);
      return [...sin, row].sort((a, b) => {
        const na = a.empleados ? nombreEmpleado(a.empleados) : "";
        const nb = b.empleados ? nombreEmpleado(b.empleados) : "";
        return na.localeCompare(nb, "es");
      });
    });
  };

  const armarMes = async () => {
    setArmando(true);
    try {
      const res = await armarLiquidacionesDelMes({
        mes,
        anio,
        created_by: user?.id ?? null,
      });
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        res.creadas === 0
          ? `Nada nuevo: ${res.omitidas} empleado(s) ya tenían liquidación o no tenían conceptos.`
          : `Se armaron ${res.creadas} borrador(es). ${res.omitidas} omitido(s).`,
      );
      await recargar();
    } finally {
      setArmando(false);
    }
  };

  const confirmarBorrar = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    const { error } = await deleteLiquidacion(aBorrar.id);
    setBorrando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFilas((prev) => prev.filter((r) => r.id !== aBorrar.id));
    setABorrar(null);
    toast.success("Liquidación eliminada");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <p className="text-xs text-muted-foreground">Nómina neta</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPesos(kpis.neto)}</p>
          <p className="text-[11px] text-muted-foreground">{kpis.n} liquidación(es)</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <p className="text-xs text-muted-foreground">Bruto</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPesos(kpis.bruto)}</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <p className="text-xs text-muted-foreground">Descuentos</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPesos(kpis.desc)}</p>
          <p className="text-[11px] text-muted-foreground">Adelantos, cargas, otros</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <p className="text-xs text-muted-foreground">Borradores</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{kpis.borradores}</p>
          <p className="text-[11px] text-muted-foreground">Pendientes de cierre</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES_LABEL.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
            <SelectTrigger className="h-9 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anios.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-1.5"
            disabled={armando || !isSupabaseConfigured}
            onClick={() => void armarMes()}
          >
            <Users className="h-4 w-4" />
            {armando ? "Armando…" : "Armar mes"}
          </Button>
          <Button
            type="button"
            className="h-9 gap-1.5"
            onClick={() => {
              setEditando(null);
              setDialogAbierto(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nueva liquidación
          </Button>
        </div>
      </div>

      {!isSupabaseConfigured ? (
        <p className="text-sm text-muted-foreground">
          Configurá Supabase para liquidar sueldos.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead className="hidden md:table-cell text-right">Bruto</TableHead>
                <TableHead className="hidden md:table-cell text-right">Desc.</TableHead>
                <TableHead className="text-right">Neto</TableHead>
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
              ) : filas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No hay liquidaciones en este mes. Usá Armar mes o creá una.
                  </TableCell>
                </TableRow>
              ) : (
                filas.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.empleados ? nombreEmpleado(r.empleados) : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {formatPesos(r.total_bruto)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {formatPesos(r.total_descuentos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatPesos(r.total_neto)}
                    </TableCell>
                    <TableCell>
                      {r.estado === "cerrada" ? (
                        <Badge variant="success">Cerrada</Badge>
                      ) : (
                        <Badge variant="warning">Borrador</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Abrir"
                          onClick={() => {
                            setEditando(r);
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
                          disabled={r.estado === "cerrada"}
                          onClick={() => setABorrar(r)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <LiquidacionFormDialog
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
        liquidacion={editando}
        mesDefault={mes}
        anioDefault={anio}
        onSaved={onSaved}
      />

      <AlertDialog open={Boolean(aBorrar)} onOpenChange={(o) => !o && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Los adelantos vinculados vuelven a quedar pendientes. No se puede borrar una
              liquidación cerrada.
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
