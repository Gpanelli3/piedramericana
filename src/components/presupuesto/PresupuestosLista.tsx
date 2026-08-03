"use client";

import { useMemo, useState } from "react";
import {
  Printer,
  Eye,
  Pencil,
  Download,
  MoreHorizontal,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PresupuestoEstado } from "@/types/database";
import type { PresupuestoRowLista } from "@/lib/presupuestos-api";
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

type Props = {
  loading: boolean;
  rows: PresupuestoRowLista[];
  tab: PresupuestoFiltroTab;
  navigate: NavigateFunction;
  onVerResumen: (id: string) => void;
  onEditar: (id: string) => void;
  onDescargarPdf: (id: string) => void;
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
  onEditar,
  onDescargarPdf,
  statusBusyId,
  onAprobar,
  onRechazar,
}: Props) {
  const [q, setQ] = useState("");
  const estadoFiltro = estadoDesdeTab(tab);

  const visibles = useMemo(() => {
    const porEstado =
      estadoFiltro === undefined ? rows : rows.filter((r) => r.status === estadoFiltro);
    const needle = q.trim().toLowerCase();
    if (!needle) return porEstado;
    return porEstado.filter(
      (r) =>
        r.numero.toLowerCase().includes(needle) ||
        r.cliente.toLowerCase().includes(needle),
    );
  }, [rows, estadoFiltro, q]);

  const estadoVacioMsj = (): string => {
    if (q.trim()) return "Ningún presupuesto coincide con la búsqueda.";
    if (tab === "pendientes") return "No hay presupuestos pendientes de revisión.";
    if (tab === "aprobados") return "Todavía no hay presupuestos aprobados.";
    if (tab === "rechazados") return "No hay presupuestos rechazados.";
    return "No hay presupuestos cargados.";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {tituloFiltro(tab)}
        </h2>
        <div className="w-full sm:max-w-xs">
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por número o cliente…"
            className="h-9"
            aria-label="Buscar presupuestos"
          />
        </div>
      </div>

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
                <TableHead className="pl-4">Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="whitespace-nowrap">Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="whitespace-nowrap">Estado</TableHead>
                <TableHead className="pr-4 text-right w-[1%] whitespace-nowrap">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((r) => {
                const busy = statusBusyId === r.id;
                const pendiente = r.status === "pendiente";
                return (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="pl-4 font-medium tabular-nums">
                      {r.numero}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate">{r.cliente}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-sm tabular-nums">
                      {formatoFecha(r.created_at)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-sm whitespace-nowrap">
                      {formatoTotal(r)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium text-[11px] sm:text-xs",
                          badgeTone(r.status),
                        )}
                      >
                        {statusLabel(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 px-2.5 text-xs"
                          onClick={() => onVerResumen(r.id)}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          Ver
                        </Button>

                        {pendiente ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 px-2.5 text-xs bg-emerald-700 text-white hover:bg-emerald-800"
                              disabled={busy}
                              onClick={() => void onAprobar(r.id)}
                            >
                              Aprobar
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="h-8 px-2.5 text-xs"
                              disabled={busy}
                              onClick={() => void onRechazar(r.id)}
                            >
                              Rechazar
                            </Button>
                          </>
                        ) : null}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              aria-label="Más acciones"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {pendiente ? (
                              <DropdownMenuItem onClick={() => onEditar(r.id)}>
                                <Pencil className="h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(`/presupuestos/${r.id}/imprimir`)
                              }
                            >
                              <Printer className="h-4 w-4" />
                              Imprimir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDescargarPdf(r.id)}>
                              <Download className="h-4 w-4" />
                              Descargar PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
