"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Banknote,
  Wallet,
  TrendingUp,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
} from "lucide-react";
import {
  listPresupuestosResumen,
  type PresupuestoRowList,
} from "@/lib/presupuestos-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { VentaCobrosDialog } from "@/components/venta/VentaCobrosDialog";
import { exportVentasCsv } from "@/lib/reportes-export-api";
import { etiquetaEtapaOt } from "@/lib/etiquetas-ot";
import { BarraFiltrosLista } from "@/components/lista/BarraFiltrosLista";
import {
  FILTROS_LISTA_VACIOS,
  filaPasaFiltros,
  hayFiltrosActivos,
  opcionesClientes,
  opcionesVendedores,
  ORDEN_LISTA_DEFAULT,
  ordenarFilas,
  type FiltrosLista,
  type OrdenLista,
} from "@/lib/lista-filtros";

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

function formatoFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function VistaAdministracion() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filas, setFilas] = useState<PresupuestoRowList[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FiltrosLista>(FILTROS_LISTA_VACIOS);
  const [orden, setOrden] = useState<OrdenLista>(ORDEN_LISTA_DEFAULT);
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

  const limpiarPid = useCallback(() => {
    setSearchParams(
      (prev) => {
        if (!prev.get("pid")) return prev;
        const n = new URLSearchParams(prev);
        n.delete("pid");
        return n;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  useEffect(() => {
    const pid = searchParams.get("pid");
    if (!pid || cargando) return;
    const fila = filas.find((r) => r.id === pid);
    if (!fila) {
      toast.error("No hay una venta abierta para ese presupuesto.");
      limpiarPid();
      return;
    }
    setFilaCobros(fila);
    setCobrosAbierto(true);
    limpiarPid();
  }, [cargando, filas, searchParams, limpiarPid]);

  const vendedoresOpciones = useMemo(() => opcionesVendedores(filas), [filas]);
  const clientesOpciones = useMemo(() => opcionesClientes(filas), [filas]);

  const hayRecorte =
    Boolean(busqueda.trim()) || hayFiltrosActivos(filtros);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const porFiltro = filas.filter((r) => filaPasaFiltros(r, filtros));
    const buscadas = !q
      ? porFiltro
      : porFiltro.filter((r) => {
          const etapa = etiquetaEtapaOt(r.ot_etapa, r.ot_estado).toLowerCase();
          return (
            r.numero.toLowerCase().includes(q) ||
            r.cliente.toLowerCase().includes(q) ||
            etapa.includes(q)
          );
        });
    return ordenarFilas(buscadas, orden);
  }, [filas, busqueda, filtros, orden]);

  const kpis = useMemo(() => {
    let saldoUsd = 0;
    let saldoArs = 0;
    let totalUsd = 0;
    let totalArs = 0;
    for (const r of filtradas) {
      const sal = r.saldo_misma_moneda;
      const tot = r.total;
      if (r.moneda === "usd") {
        if (typeof sal === "number" && sal > 0) saldoUsd += sal;
        if (typeof tot === "number" && Number.isFinite(tot)) totalUsd += tot;
      } else {
        if (typeof sal === "number" && sal > 0) saldoArs += sal;
        if (typeof tot === "number" && Number.isFinite(tot)) totalArs += tot;
      }
    }
    const conSaldo = filtradas.filter((r) => {
      const s = r.saldo_misma_moneda;
      return typeof s === "number" && s > 0.005;
    }).length;
    return {
      saldoUsd,
      saldoArs,
      totalUsd,
      totalArs,
      conSaldo,
      totalAprob: filtradas.length,
    };
  }, [filtradas]);

  function paramsRango(): URLSearchParams {
    const p = new URLSearchParams();
    if (filtros.fechaDesde) p.set("desde", filtros.fechaDesde);
    if (filtros.fechaHasta) p.set("hasta", filtros.fechaHasta);
    return p;
  }

  function abrirCobros(f: PresupuestoRowList) {
    setFilaCobros(f);
    setCobrosAbierto(true);
  }

  async function onExportExcel() {
    setExportBusy(true);
    const res = await exportVentasCsv({
      desde: filtros.fechaDesde,
      hasta: filtros.fechaHasta,
    });
    setExportBusy(false);
    if (res.error) toast.error(res.error.message);
    else toast.success("Excel descargado.");
  }

  function onExportPdf() {
    const p = paramsRango();
    p.set("descargar", "1");
    navigate(`/obras-cobros/imprimir?${p.toString()}`);
  }

  function onExportImprimir() {
    const q = paramsRango().toString();
    navigate(q ? `/obras-cobros/imprimir?${q}` : "/obras-cobros/imprimir");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <header className="border-b border-border bg-card px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl" data-guia="modulo-titulo">
            Ventas — Caja y cuentas corrientes
          </h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exportBusy || cargando}
                className="h-9 shrink-0 gap-1.5 self-start sm:self-auto"
                data-guia="exportar"
              >
                <Download className="h-4 w-4" aria-hidden />
                Exportar
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10.5rem]">
              <DropdownMenuItem
                disabled={exportBusy}
                onSelect={() => void onExportExcel()}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={exportBusy}
                onSelect={onExportPdf}
                className="gap-2"
              >
                <FileText className="h-4 w-4" aria-hidden />
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={exportBusy}
                onSelect={onExportImprimir}
                className="gap-2"
              >
                <Printer className="h-4 w-4" aria-hidden />
                Imprimir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                <p className="text-xs text-muted-foreground">
                  {hayRecorte ? "Según filtros activos" : "Presupuestos en estado aprobado"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="flex gap-4 p-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Banknote className="h-5 w-5 text-foreground/80" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Ventas totales</p>
                <p className="text-sm font-semibold tabular-nums leading-snug text-foreground">
                  {cargando ?
                    "…"
                  : <>
                      <span className="block">{formatMonto(kpis.totalUsd, "usd")}</span>
                      <span className="block text-muted-foreground">{formatMonto(kpis.totalArs, "ars")}</span>
                    </>
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  {hayRecorte ? "Según filtros activos" : "Suma de los totales aprobados"}
                </p>
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
        </div>

        <BarraFiltrosLista
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar por obra, cliente o etapa…"
          ariaLabel="Buscar en obras y cobros"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          orden={orden}
          onOrdenChange={setOrden}
          vendedores={vendedoresOpciones.lista}
          haySinVendedor={vendedoresOpciones.haySinVendedor}
          clientes={clientesOpciones}
          idPrefix="ventas"
        />

        <Card className="border-border shadow-sm" data-guia="lista">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="whitespace-nowrap pl-4 text-xs font-medium text-muted-foreground sm:pl-6">
                      Presupuesto
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Cliente / Arquitecto
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Etapa
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Total
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Cobrado
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Saldo
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Vendedor
                    </TableHead>
                    <TableHead className="whitespace-nowrap pr-4 text-xs font-medium text-muted-foreground sm:pr-6">
                      Fecha
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargando ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        Cargando…
                      </TableCell>
                    </TableRow>
                  ) : filtradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        {hayRecorte ?
                          "Ninguna venta coincide con los filtros."
                        : "No hay presupuestos aprobados."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtradas.map((r) => {
                      const pagado = r.total_pagado_misma_moneda ?? 0;
                      const saldo = r.saldo_misma_moneda ?? r.total;
                      return (
                        <TableRow
                          key={r.id}
                          className="cursor-pointer transition-colors hover:bg-muted/50"
                          onClick={() => abrirCobros(r)}
                        >
                          <TableCell className="max-w-[140px] py-3 pl-4 sm:pl-6">
                            <p className="text-sm font-medium text-accent">{r.numero}</p>
                          </TableCell>
                          <TableCell className="max-w-[200px] py-3">
                            <p className="truncate text-sm text-foreground">{r.cliente || "—"}</p>
                          </TableCell>
                          <TableCell className="py-3 text-sm text-muted-foreground">
                            {etiquetaEtapaOt(r.ot_etapa, r.ot_estado)}
                          </TableCell>
                          <TableCell className="py-3 tabular-nums text-sm font-medium">
                            {formatMonto(r.total, r.moneda)}
                          </TableCell>
                          <TableCell className="py-3 tabular-nums text-sm font-medium">
                            {formatMonto(pagado, r.moneda)}
                          </TableCell>
                          <TableCell className="py-3 tabular-nums text-sm font-semibold">
                            {saldo <= 0.009 ?
                              <span className="font-medium text-green-700 dark:text-green-400">Pagado</span>
                            : (
                              <span className="text-destructive">{formatMonto(saldo, r.moneda)}</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[140px] py-3">
                            <p className="truncate text-sm text-muted-foreground">
                              {r.vendedor_nombre?.trim() || "—"}
                            </p>
                          </TableCell>
                          <TableCell className="py-3 whitespace-nowrap pr-4 text-sm tabular-nums text-muted-foreground sm:pr-6">
                            {formatoFecha(r.created_at)}
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
