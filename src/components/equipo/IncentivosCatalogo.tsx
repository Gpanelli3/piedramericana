"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { IncentivoFormDialog } from "@/components/equipo/IncentivoFormDialog";
import { nombreEmpleado } from "@/lib/empleados-api";
import {
  deleteIncentivo,
  etiquetaIncentivoTipo,
  listIncentivos,
  type IncentivoConEmpleado,
} from "@/lib/incentivos-api";
import { formatFechaIso, formatPesos } from "@/lib/sueldos-calculos";
import { isSupabaseConfigured } from "@/lib/supabase";

function formatMonto(n: number, moneda: string): string {
  if (moneda === "usd") return `USD ${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
  return formatPesos(n);
}

export function IncentivosCatalogo() {
  const [filas, setFilas] = useState<IncentivoConEmpleado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [aBorrar, setABorrar] = useState<IncentivoConEmpleado | null>(null);
  const [borrando, setBorrando] = useState(false);

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const res = await listIncentivos();
    if (res.error) {
      toast.error(res.error.message);
      setFilas([]);
    } else {
      setFilas(res.data);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const totalMes = useMemo(() => {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const anio = hoy.getFullYear();
    return filas
      .filter((r) => {
        const m = /^(\d{4})-(\d{2})/.exec(r.fecha);
        return m ? Number(m[1]) === anio && Number(m[2]) === mes && r.moneda === "ars" : false;
      })
      .reduce((s, r) => s + r.monto, 0);
  }, [filas]);

  const confirmarBorrar = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    const { error } = await deleteIncentivo(aBorrar.id);
    setBorrando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFilas((prev) => prev.filter((r) => r.id !== aBorrar.id));
    setABorrar(null);
    toast.success("Incentivo eliminado.");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Comisiones, premios y bonos. Cada alta sale también en Finanzas como sueldo.
        </p>
        <Button type="button" className="h-9 gap-1.5" onClick={() => setDialogAbierto(true)}>
          <Plus className="h-4 w-4" />
          Nuevo
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-white px-4 py-3">
        <p className="text-xs text-muted-foreground">Pesos de este mes</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{formatPesos(totalMes)}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Empleado</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Todavía no hay incentivos.
                </TableCell>
              </TableRow>
            ) : (
              filas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular-nums">{formatFechaIso(r.fecha)}</TableCell>
                  <TableCell>{r.empleados ? nombreEmpleado(r.empleados) : "—"}</TableCell>
                  <TableCell>
                    {etiquetaIncentivoTipo(r.tipo)}
                    {r.descripcion ? (
                      <span className="block text-[11px] text-muted-foreground">{r.descripcion}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMonto(r.monto, r.moneda)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => setABorrar(r)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <IncentivoFormDialog
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
        onSaved={(row) => setFilas((prev) => [row, ...prev])}
      />
      <AlertDialog open={Boolean(aBorrar)} onOpenChange={(o) => !o && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este incentivo?</AlertDialogTitle>
            <AlertDialogDescription>
              También se saca el movimiento de finanzas si todavía está.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={borrando} onClick={() => void confirmarBorrar()}>
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
