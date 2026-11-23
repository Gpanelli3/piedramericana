"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { LiquidacionFormDialog } from "@/components/equipo/LiquidacionFormDialog";
import { nombreEmpleado } from "@/lib/empleados-api";
import {
  sincronizarSueldosDelMes,
  listLiquidaciones,
  type LiquidacionConDetalle,
} from "@/lib/sueldos-api";
import {
  formatPesos,
  MESES_LABEL,
  periodoActual,
  saldoLiquidacion,
  sumaPagos,
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

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    // Sueldos automáticos: el mes en curso se arma solo (y se actualiza con adelantos nuevos).
    if (mes === actual.mes && anio === actual.anio) {
      const sync = await sincronizarSueldosDelMes({ mes, anio, created_by: user?.id ?? null });
      if (sync.error) toast.error(`No se pudieron armar los sueldos del mes: ${sync.error.message}`);
    }
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
  }, [mes, anio, actual.mes, actual.anio, user?.id]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const kpis = useMemo(() => {
    const bruto = filas.reduce((s, r) => s + r.total_bruto, 0);
    const desc = filas.reduce((s, r) => s + r.total_descuentos, 0);
    const neto = filas.reduce((s, r) => s + r.total_neto, 0);
    const pagado = filas.reduce((s, r) => s + sumaPagos(r.liquidacion_pagos), 0);
    const saldo = filas.reduce((s, r) => s + saldoLiquidacion(r.total_neto, r.liquidacion_pagos), 0);
    return { bruto, desc, neto, pagado, saldo, n: filas.length };
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

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <p className="text-xs text-muted-foreground">Nómina neta</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPesos(kpis.neto)}</p>
          <p className="text-[11px] text-muted-foreground">{kpis.n} liquidación(es)</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <p className="text-xs text-muted-foreground">Pagado</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPesos(kpis.pagado)}</p>
          <p className="text-[11px] text-muted-foreground">Pagos registrados del mes</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <p className="text-xs text-muted-foreground">Descuentos</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPesos(kpis.desc)}</p>
          <p className="text-[11px] text-muted-foreground">Adelantos, cargas, otros</p>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <p className="text-xs text-muted-foreground">Saldo por pagar</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPesos(kpis.saldo)}</p>
          <p className="text-[11px] text-muted-foreground">Neto menos lo pagado</p>
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
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No hay sueldos en este mes.
                  </TableCell>
                </TableRow>
              ) : (
                filas.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setEditando(r);
                      setDialogAbierto(true);
                    }}
                  >
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
                    <TableCell className="text-right tabular-nums">
                      {formatPesos(sumaPagos(r.liquidacion_pagos))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatPesos(saldoLiquidacion(r.total_neto, r.liquidacion_pagos))}
                    </TableCell>
                    <TableCell>
                      {saldoLiquidacion(r.total_neto, r.liquidacion_pagos) <= 0 ? (
                        <Badge variant="success">Pagado</Badge>
                      ) : r.liquidacion_pagos.length > 0 ? (
                        <Badge variant="warning">Pago parcial</Badge>
                      ) : (
                        <Badge variant="outline">Sin pagar</Badge>
                      )}
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
        onSaved={onSaved}
      />
    </div>
  );
}
