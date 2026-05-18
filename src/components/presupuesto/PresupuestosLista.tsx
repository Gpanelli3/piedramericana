"use client";

import { useMemo } from "react";
import { ClipboardList, Eye, MoreHorizontal, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { PresupuestoEstado } from "@/types/database";
import type { PresupuestoRowLista } from "@/lib/presupuestos-api";
import { cn } from "@/lib/utils";
import type { NavigateFunction } from "react-router-dom";

export type PresupuestoFiltroTab = "pendientes" | "aprobados" | "rechazados" | "todos";

function tituloFiltro(tab: PresupuestoFiltroTab): string {
  switch (tab) {
    case "pendientes": return "Pendientes";
    case "aprobados": return "Aprobados";
    case "rechazados": return "Rechazados";
    case "todos": return "Todos los presupuestos";
    default: return "Presupuestos";
  }
}

function mensajeVacio(tab: PresupuestoFiltroTab): string {
  if (tab === "pendientes") return "No hay presupuestos pendientes de revisión.";
  if (tab === "aprobados") return "Todavía no hay presupuestos aprobados.";
  if (tab === "rechazados") return "No hay presupuestos rechazados.";
  return "No hay presupuestos cargados.";
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

function formatoTotal(row: Pick<PresupuestoRowLista, "total" | "moneda">): string {
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
    case "pendiente": return "Pendiente";
    case "aprobado": return "Aprobado";
    case "rechazado": return "Rechazado";
    default: return s;
  }
}

function estadoDesdeTab(tab: PresupuestoFiltroTab): PresupuestoEstado | undefined {
  if (tab === "pendientes") return "pendiente";
  if (tab === "aprobados") return "aprobado";
  if (tab === "rechazados") return "rechazado";
  return undefined;
}

function badgeTone(s: PresupuestoEstado) {
  if (s === "pendiente") return "border-amber-300 bg-amber-50 text-amber-800";
  if (s === "aprobado") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  return "border-rose-300 bg-rose-50 text-rose-800";
}

type Props = {
  loading: boolean;
  rows: PresupuestoRowLista[];
  tab: PresupuestoFiltroTab;
  navigate: NavigateFunction;
  onVerResumen: (id: string) => void;
  statusBusyId: string | null;
  onAprobar: (id: string) => Promise<void>;
  onRechazar: (id: string) => Promise<void>;
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
}: Props) {
  const estadoFiltro = estadoDesdeTab(tab);
  const visibles = useMemo(
    () => (estadoFiltro === undefined ? rows : rows.filter((r) => r.status === estadoFiltro)),
    [rows, estadoFiltro],
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-14 text-center text-sm text-muted-foreground">
        Cargando presupuestos…
      </div>
    );
  }

  if (visibles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <ClipboardList className="h-6 w-6 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium text-foreground">{tituloFiltro(tab)}</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs leading-relaxed">
          {mensajeVacio(tab)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{tituloFiltro(tab)}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {visibles.length} {visibles.length === 1 ? "registro" : "registros"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="text-xs font-semibold text-muted-foreground/80 pl-5">Número</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground/80">Cliente</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground/80 whitespace-nowrap">Fecha</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground/80 text-right">Total</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground/80">Estado</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground/80 text-right pr-5">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((r, idx) => (
              <TableRow
                key={r.id}
                className={cn(
                  "transition-colors hover:bg-muted/30",
                  idx !== visibles.length - 1 && "border-b border-border/60",
                )}
              >
                <TableCell className="font-mono text-sm font-medium pl-5">{r.numero}</TableCell>
                <TableCell className="max-w-[12rem] truncate text-sm">{r.cliente}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap text-sm tabular-nums">
                  {formatoFecha(r.created_at)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-sm">
                  {formatoTotal(r)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", badgeTone(r.status))}
                  >
                    {statusLabel(r.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right pr-5">
                  <div className="flex items-center justify-end gap-1.5">
                    {r.status === "pendiente" && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700"
                          disabled={statusBusyId === r.id}
                          onClick={() => void onAprobar(r.id)}
                        >
                          Aprobar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="h-7 rounded-md px-3 text-xs font-medium"
                          disabled={statusBusyId === r.id}
                          onClick={() => void onRechazar(r.id)}
                        >
                          Rechazar
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
                      onClick={() => onVerResumen(r.id)}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      Ver
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 rounded-md p-0"
                          aria-label="Más acciones"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => navigate(`/presupuestos/${r.id}/imprimir`)}
                          className="gap-2 text-sm"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Vista de impresión
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
