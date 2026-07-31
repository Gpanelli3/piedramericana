"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Wallet,
  TrendingUp,
  Clock,
  ChevronRight,
  Search,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listPresupuestosResumen,
  type PresupuestoRowList,
} from "@/lib/presupuestos-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { VentaEstado } from "@/types/database";
import { VentaCobrosDialog } from "@/components/venta/VentaCobrosDialog";
import { exportPagosVentasCsv, exportVentasCsv } from "@/lib/reportes-export-api";

function formatMonto(n: number, moneda: "ars" | "usd") {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: moneda === "usd" ? 2 : 0,
  };
  if (moneda === "usd") {
    return `USD ${n.toLocaleString("es-AR", opts)}`;
  }
  return `$ ${n.toLocaleString("es-AR", opts)}`;
}

function etiquetaEstadoVenta(e: VentaEstado | null): string {
  switch (e) {
    case null:
      return "Sin seña";
    case "senado":
      return "Señado";
    case "en_medicion":
      return "En medición";
    case "en_produccion":
      return "En producción";
    case "finalizado":
      return "Finalizado";
    case "entregado":
      return "Entregado";
    default:
      return "Sin venta";
  }
}

function badgeEstadoVenta(e: VentaEstado | null) {
  const label = etiquetaEstadoVenta(e);
  const base =
    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium";
  if (e === null) {
    return (
      <Badge variant="outline" className={cn(base, "border-border text-muted-foreground")}>
        {label}
      </Badge>
    );
  }
  if (e === "entregado" || e === "finalizado") {
    return (
      <Badge
        variant="secondary"
        className={cn(base, "border-green-200 bg-green-50 text-green-900")}
      >
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={cn(base, "border-border")}>
      {label}
    </Badge>
  );
}

export function VistaAdministracion() {
  const [filas, setFilas] = useState<PresupuestoRowList[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [cobrosAbierto, setCobrosAbierto] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [filaCobros, setFilaCobros] = useState<PresupuestoRowList | null>(null);

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const { data, error } = await listPresupuestosResumen();
    if (error) {
      toast.error(error.message);
      setFilas([]);
    } else {
      const aprob = (data ?? []).filter((r) => r.status === "aprobado");
      setFilas(aprob);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(
      (r) =>
        r.numero.toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q),
    );
  }, [filas, busqueda]);

  const kpis = useMemo(() => {
    let saldoUsd = 0;
    let saldoArs = 0;
    let sinSena = 0;
    for (const r of filas) {
      const sal = r.saldo_misma_moneda;
      if (r.moneda === "usd") {
        if (typeof sal === "number" && sal > 0) saldoUsd += sal;
      } else {
        if (typeof sal === "number" && sal > 0) saldoArs += sal;
      }
      if (r.venta_estado === null) sinSena += 1;
    }
    const conSaldo =
      filas.filter((r) => {
        const s = r.saldo_misma_moneda;
        return typeof s === "number" && s > 0.005;
      }).length;
    return {
      saldoUsd,
      saldoArs,
      sinSena,
      conSaldo,
      totalAprob: filas.length,
    };
  }, [filas]);

  function abrirCobros(f: PresupuestoRowList) {
    setFilaCobros(f);
    setCobrosAbierto(true);
  }

  async function onExportVentas() {
    setExportBusy(true);
    const res = await exportVentasCsv();
    setExportBusy(false);
    if (res.error) toast.error(res.error.message);
    else toast.success("Export de ventas descargado.");
  }

  async function onExportPagos() {
    setExportBusy(true);
    const res = await exportPagosVentasCsv();
    setExportBusy(false);
    if (res.error) toast.error(res.error.message);
    else toast.success("Export de cobros descargado.");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <header className="border-b border-border bg-card px-4 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Ventas — Caja y cuentas corrientes
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportBusy || cargando}
              onClick={() => void onExportVentas()}
            >
              <Download className="mr-1 h-4 w-4" />
              Export ventas
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportBusy || cargando}
              onClick={() => void onExportPagos()}
            >
              <Download className="mr-1 h-4 w-4" />
              Export cobros
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border shadow-sm">
            <CardContent className="flex gap-4 p-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Wallet className="h-5 w-5 text-foreground/80" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Ventas aprobadas</p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {cargando ? "…" : kpis.totalAprob}
                </p>
                <p className="text-xs text-muted-foreground">Presupuestos en estado aprobado</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="flex gap-4 p-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <TrendingUp className="h-5 w-5 text-foreground/80" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Saldo por cobrar</p>
                <p className="text-sm font-semibold tabular-nums leading-snug text-foreground">
                  {cargando ?
                    "…"
                  : <>
                      <span className="block">{formatMonto(kpis.saldoUsd, "usd")}</span>
                      <span className="block text-muted-foreground">{formatMonto(kpis.saldoArs, "ars")}</span>
                    </>
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  {!cargando && kpis.conSaldo > 0 ?
                    `${kpis.conSaldo} con saldo pendiente`
                  : !cargando ?
                    "Al día"
                  : null}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm sm:col-span-2 lg:col-span-1">
            <CardContent className="flex gap-4 p-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-5 w-5 text-foreground/80" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Sin seña registrada</p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {cargando ? "…" : kpis.sinSena}
                </p>
                <p className="text-xs text-muted-foreground">Aún sin pagos en la venta asociada</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-4 border-b border-border pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Obras y cobros
                </CardTitle>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por presupuesto o cliente…"
                  className="h-9 w-full pl-9 sm:w-[260px]"
                  aria-label="Filtrar ventas"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="whitespace-nowrap pl-4 text-xs font-medium text-muted-foreground sm:pl-6">
                      Presupuesto
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Total
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Avance
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Saldo
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Venta
                    </TableHead>
                    <TableHead className="whitespace-nowrap pr-4 text-right text-xs font-medium text-muted-foreground sm:pr-6">
                      Acción
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargando ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        Cargando…
                      </TableCell>
                    </TableRow>
                  ) : filtradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        {busqueda.trim() ?
                          `No hay resultados para «${busqueda}».`
                        : "No hay presupuestos aprobados."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtradas.map((r) => {
                      const pct =
                        typeof r.pct_sena_sobre_presupuesto === "number" ?
                          Math.round(r.pct_sena_sobre_presupuesto)
                        : 0;
                      const pagado = r.total_pagado_misma_moneda ?? 0;
                      const saldo = r.saldo_misma_moneda ?? r.total;
                      return (
                        <TableRow
                          key={r.id}
                          className="cursor-pointer transition-colors hover:bg-muted/50"
                          onClick={() => abrirCobros(r)}
                        >
                          <TableCell className="max-w-[220px] py-3 pl-4 sm:max-w-[280px] sm:pl-6">
                            <p className="text-sm font-medium text-accent">{r.numero}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.cliente}</p>
                          </TableCell>
                          <TableCell className="py-3 tabular-nums text-sm font-medium">
                            {formatMonto(r.total, r.moneda)}
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex w-[7rem] flex-col gap-1">
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    pct === 0 ?
                                      "bg-red-400"
                                    : pct === 100 ?
                                      "bg-green-600"
                                    : "bg-amber-500",
                                  )}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                {formatMonto(pagado, r.moneda)} · {pct}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 tabular-nums text-sm font-semibold">
                            {saldo <= 0.009 ?
                              <span className="font-medium text-green-700 dark:text-green-400">Al día</span>
                            : (
                              <span className="text-destructive">{formatMonto(saldo, r.moneda)}</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3">{badgeEstadoVenta(r.venta_estado)}</TableCell>
                          <TableCell className="py-3 pr-4 text-right sm:pr-6">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirCobros(r);
                              }}
                            >
                              Cobros
                              <ChevronRight className="h-3 w-3 opacity-70" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <VentaCobrosDialog
        open={cobrosAbierto}
        onOpenChange={(open) => {
          setCobrosAbierto(open);
          if (!open) setFilaCobros(null);
        }}
        presupuestoId={filaCobros?.id ?? null}
        rowResumen={filaCobros}
        onDatosCambiaron={recargar}
      />
    </div>
  );
}
