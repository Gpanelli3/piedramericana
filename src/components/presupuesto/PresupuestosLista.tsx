"use client";

import { useMemo, useState } from "react";
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
import type { PresupuestoEstado } from "@/types/database";
import type { PresupuestoRowLista } from "@/lib/presupuestos-api";
import type { MedicionEstado } from "@/lib/medicion-reglas";
import { etiquetaMedicionEstado } from "@/lib/medicion-reglas";
import { cn } from "@/lib/utils";

export type PresupuestoFiltroTab = "pendientes" | "aprobados" | "todos";

function tituloFiltro(tab: PresupuestoFiltroTab): string {
  switch (tab) {
    case "pendientes":
      return "Pendientes";
    case "aprobados":
      return "Aprobados";
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
  onVerResumen: (id: string) => void;
  medicionPorId?: Record<string, MedicionEstado>;
};

export function PresupuestosLista({
  loading,
  rows,
  tab,
  onVerResumen,
  medicionPorId,
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
    return "No hay presupuestos cargados.";
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
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
        <p className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
          Cargando presupuestos…
        </p>
      ) : visibles.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
          {estadoVacioMsj()}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-muted/40">
                <TableHead className="pl-4">Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="whitespace-nowrap">Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="pr-4 whitespace-nowrap">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((r) => {
                const medEstado = medicionPorId?.[r.id] ?? "sin_solicitar";
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/30"
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver presupuesto ${r.numero}`}
                    onClick={() => onVerResumen(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onVerResumen(r.id);
                      }
                    }}
                  >
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
                    <TableCell className="pr-4">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium text-[11px] sm:text-xs",
                            badgeTone(r.status),
                          )}
                        >
                          {statusLabel(r.status)}
                        </Badge>
                        {medicionPorId && medEstado !== "sin_solicitar" ? (
                          <Badge variant="outline" className="text-[10px] font-medium">
                            {etiquetaMedicionEstado(medEstado)}
                          </Badge>
                        ) : null}
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
