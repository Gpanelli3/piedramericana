"use client";

import { useMemo } from "react";
import { Printer, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { PresupuestoEstado, VentaEstado } from "@/types/database";
import type { PresupuestoRowList } from "@/lib/presupuestos-api";
import { cn } from "@/lib/utils";
import type { NavigateFunction } from "react-router-dom";

export type PresupuestoFiltroTab = "pendientes" | "aprobados" | "rechazados" | "todos";

function tituloFiltro(tab: PresupuestoFiltroTab): string {
  switch (tab) {
    case "pendientes":
      return "Pendientes";
    case "aprobados":
      return "Aprobados";
    case "rechazados":
      return "Rechazados";
    case "todos":
      return "Todos";
    default:
      return "Presupuestos";
  }
}

function formatUsd(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatArs(n: number): string {
  try {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(n));
  } catch {
    return String(Math.round(n));
  }
}

function formatoTotal(row: Pick<PresupuestoRowList, "total" | "moneda">): string {
  return row.moneda === "usd" ? `${formatUsd(row.total)} USD` : `$ ${formatArs(row.total)}`;
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

function statusLabel(s: PresupuestoEstado): string {
  switch (s) {
    case "pendiente":
      return "Pendiente";
    case "aprobado":
      return "Aprobado";
    case "rechazado":
      return "Rechazado";
    default:
      return s;
  }
}

function estadoDesdeTab(tab: PresupuestoFiltroTab): PresupuestoEstado | undefined {
  if (tab === "pendientes") return "pendiente";
  if (tab === "aprobados") return "aprobado";
  if (tab === "rechazados") return "rechazado";
  return undefined;
}

function badgeTone(s: PresupuestoEstado) {
  if (s === "pendiente") return "border-amber-300 bg-amber-50 text-amber-900";
  if (s === "aprobado") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  return "border-rose-300 bg-rose-50 text-rose-900";
}

function estadoVentaBadge(e: VentaEstado): { label: string; className: string } {
  switch (e) {
    case "aprobado_sin_sena":
      return { label: "Sin seña", className: "border-sky-300 bg-sky-50 text-sky-950" };
    case "senado":
      return { label: "Seña", className: "border-violet-300 bg-violet-50 text-violet-950" };
    case "en_produccion":
      return { label: "En producción", className: "border-amber-300 bg-amber-50 text-amber-950" };
    case "finalizado":
      return { label: "Finalizado", className: "border-emerald-300 bg-emerald-50 text-emerald-950" };
    case "entregado":
      return { label: "Entregado", className: "border-slate-300 bg-slate-50 text-slate-900" };
    default:
      return { label: e, className: "border-border bg-muted text-foreground" };
  }
}

function pctLabel(pct: number | null): string | null {
  if (pct === null || Number.isNaN(pct)) return null;
  return `${pct.toFixed(1)} % cobrado (misma moneda)`;
}

type Props = {
  loading: boolean;
  rows: PresupuestoRowList[];
  tab: PresupuestoFiltroTab;
  navigate: NavigateFunction;
  onVerResumen: (id: string) => void;
  statusBusyId: string | null;
  onAprobar: (id: string) => Promise<void>;
  onRechazar: (id: string) => Promise<void>;
  onVentasGestión?: (id: string) => void;
};

export function PresupuestosLista({
  loading,
  rows,
  tab,
  navigate,
  onVerResumen,
  statusBusyId,
  onAprobar,
  onRechazar,
  onVentasGestión,
}: Props) {
  const estadoFiltro = estadoDesdeTab(tab);
  const visibles = useMemo(
    () =>
      estadoFiltro === undefined ? rows : rows.filter((r) => r.status === estadoFiltro),
    [rows, estadoFiltro],
  );

  const estadoVacioMsj = (): string => {
    if (tab === "pendientes") return "No hay presupuestos pendientes de revisión.";
    if (tab === "aprobados") return "Todavía no hay presupuestos aprobados.";
    if (tab === "rechazados") return "No hay presupuestos rechazados.";
    return "No hay presupuestos cargados.";
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{tituloFiltro(tab)}</h2>

      {loading ? (
        <div className="rounded-lg border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Cargando presupuestos…
        </div>
      ) : visibles.length === 0 ? (
        <div className="rounded-lg border bg-card px-6 py-10 text-center text-sm text-muted-foreground leading-relaxed max-w-xl">
          {estadoVacioMsj()}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-muted/40">
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="whitespace-nowrap">Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="whitespace-nowrap">Estado</TableHead>
                <TableHead className="whitespace-nowrap">Venta / seña</TableHead>
                <TableHead className="text-right w-[300px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium tabular-nums">{r.numero}</TableCell>
                  <TableCell className="max-w-[10rem] sm:max-w-none truncate">{r.cliente}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap text-sm tabular-nums">
                    {formatoFecha(r.created_at)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-sm">
                    {formatoTotal(r)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className={cn("font-medium text-[11px] sm:text-xs", badgeTone(r.status))}>
                        {statusLabel(r.status)}
                      </Badge>
                      {r.status === "aprobado" && r.venta_estado ?
                        <Badge variant="outline" className={cn("font-medium text-[11px] sm:text-xs", estadoVentaBadge(r.venta_estado).className)}>
                          {estadoVentaBadge(r.venta_estado).label}
                        </Badge>
                      : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[12rem]">
                    {r.status === "aprobado" ?
                      <>
                        {pctLabel(r.pct_sena_sobre_presupuesto) ?? "—"}
                        {r.total_pagado_misma_moneda != null ?
                          <span className="block tabular-nums text-foreground mt-0.5">
                            Pagado: {formatoTotal({
                              total: r.total_pagado_misma_moneda,
                              moneda: r.moneda,
                            })}{" "}
                            · Saldo est.:{" "}
                            <span className="font-medium">
                              {typeof r.saldo_misma_moneda === "number"
                                ? formatoTotal({ total: Math.max(r.saldo_misma_moneda, 0), moneda: r.moneda })
                                : "—"}
                            </span>
                          </span>
                        : null}
                      </>
                    : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => onVerResumen(r.id)}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                        Ver resumen
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => navigate(`/presupuestos/${r.id}/imprimir`)}
                      >
                        <Printer className="h-3.5 w-3.5" aria-hidden />
                        Imprimir
                      </Button>
                      {r.status === "aprobado" && onVentasGestión ?
                        <Button type="button" variant="secondary" size="sm" className="h-8 gap-1 text-xs" onClick={() => onVentasGestión(r.id)}>
                          Ventas / seña
                        </Button>
                      : null}
                      {r.status === "pendiente" ?
                        <>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 text-xs bg-emerald-700 text-white hover:bg-emerald-800"
                            disabled={statusBusyId === r.id}
                            onClick={() => void onAprobar(r.id)}
                          >
                            Aprobar
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-8 text-xs"
                            disabled={statusBusyId === r.id}
                            onClick={() => void onRechazar(r.id)}
                          >
                            Rechazar
                          </Button>
                        </>
                      : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
