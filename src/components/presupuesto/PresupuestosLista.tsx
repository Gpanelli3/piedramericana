"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarraFiltrosLista } from "@/components/lista/BarraFiltrosLista";
import type { PresupuestoEstado } from "@/types/database";
import { presupuestoEstaDormido, type PresupuestoRowLista } from "@/lib/presupuestos-api";
import type { MedicionEstado } from "@/lib/medicion-reglas";
import { etiquetaMedicionEstado } from "@/lib/medicion-reglas";
import {
  FILTROS_LISTA_VACIOS,
  filaPasaFiltros,
  filaPasaTab,
  hayFiltrosActivos,
  opcionesClientes,
  opcionesVendedores,
  ORDEN_LISTA_DEFAULT,
  ordenarFilas,
  type FiltrosLista,
  type OrdenLista,
} from "@/lib/lista-filtros";
import { cn } from "@/lib/utils";
import { urlWhatsapp } from "@/lib/whatsapp";

export type PresupuestoFiltroTab = "dormidos" | "aprobados" | "todos";

function tituloFiltro(tab: PresupuestoFiltroTab): string {
  switch (tab) {
    case "dormidos":
      return "Dormidos";
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

function etiquetaEstado(row: PresupuestoRowLista): string {
  if (presupuestoEstaDormido(row)) return "Dormido";
  return statusLabel(row.status);
}

function badgeTone(row: PresupuestoRowLista) {
  if (presupuestoEstaDormido(row)) return "border-stone-300 bg-stone-100 text-stone-700";
  if (row.status === "pendiente") return "border-amber-300 bg-amber-50 text-amber-900";
  if (row.status === "aprobado") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  return "border-rose-300 bg-rose-50 text-rose-900";
}

function nombreContactoVisible(cliente: string, contacto: string): string {
  const nombre = contacto.trim();
  if (!nombre) return "";
  if (nombre.localeCompare(cliente.trim(), "es", { sensitivity: "accent" }) === 0) return "";
  return nombre;
}

function IconoWhatsapp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M20.5 3.5A11 11 0 0 0 2.1 16.8L1 22.5l5.9-1.1A11 11 0 0 0 20.5 3.5zM12 20.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.5.6.7-3.4-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.2 0-.4.1-.5l.4-.4.2-.3a.5.5 0 0 0 0-.5c0-.1-.5-1.3-.7-1.7s-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1.1 2.7 11.4 11.4 0 0 0 4.4 3.9 15 15 0 0 0 1.5.5 3.6 3.6 0 0 0 1.6.1 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.1-.4-.2z" />
    </svg>
  );
}

function CeldaContacto({ cliente, contacto, tel }: { cliente: string; contacto: string; tel: string }) {
  const nombre = nombreContactoVisible(cliente, contacto);
  const numero = tel.trim();
  const href = numero ? urlWhatsapp(numero) : null;
  if (!nombre && !numero) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {nombre ? <span className="truncate text-sm">{nombre}</span> : null}
      {numero ? (
        href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir WhatsApp"
            aria-label={`Abrir WhatsApp de ${numero}`}
            className="inline-flex max-w-full items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <IconoWhatsapp className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{numero}</span>
          </a>
        ) : (
          <span className="truncate text-xs text-muted-foreground">{numero}</span>
        )
      ) : null}
    </div>
  );
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
  const [filtros, setFiltros] = useState<FiltrosLista>(FILTROS_LISTA_VACIOS);
  const [orden, setOrden] = useState<OrdenLista>(ORDEN_LISTA_DEFAULT);

  const vendedoresOpciones = useMemo(() => opcionesVendedores(rows), [rows]);
  const clientesOpciones = useMemo(() => opcionesClientes(rows), [rows]);

  const visibles = useMemo(() => {
    const filtradas = rows.filter(
      (r) => filaPasaTab(r, tab) && filaPasaFiltros(r, filtros),
    );
    const needle = q.trim().toLowerCase();
    const buscadas = !needle
      ? filtradas
      : filtradas.filter(
          (r) =>
            r.numero.toLowerCase().includes(needle) ||
            r.cliente.toLowerCase().includes(needle) ||
            r.contacto.toLowerCase().includes(needle) ||
            r.tel.toLowerCase().includes(needle),
        );
    return ordenarFilas(buscadas, orden);
  }, [rows, tab, filtros, q, orden]);

  const estadoVacioMsj = (): string => {
    if (q.trim() || hayFiltrosActivos(filtros)) {
      return "Ningún presupuesto coincide con los filtros.";
    }
    if (tab === "dormidos") return "No hay presupuestos dormidos. Entran acá si pasan 7 días sin confirmarse.";
    if (tab === "aprobados") return "Todavía no hay presupuestos aprobados.";
    return "No hay presupuestos cargados.";
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {tituloFiltro(tab)}
        </h2>
        <BarraFiltrosLista
          busqueda={q}
          onBusqueda={setQ}
          placeholder="Buscar por número, cliente o teléfono…"
          ariaLabel="Buscar presupuestos"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          orden={orden}
          onOrdenChange={setOrden}
          vendedores={vendedoresOpciones.lista}
          haySinVendedor={vendedoresOpciones.haySinVendedor}
          clientes={clientesOpciones}
          idPrefix="presupuestos"
        />
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
        <div className="overflow-x-auto rounded-lg border border-border bg-card" data-guia="lista">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-muted/40">
                <TableHead className="pl-4">Presupuesto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contacto</TableHead>
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
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a")) return;
                      onVerResumen(r.id);
                    }}
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
                    <TableCell className="max-w-[14rem]">
                      <CeldaContacto cliente={r.cliente} contacto={r.contacto} tel={r.tel} />
                    </TableCell>
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
                            badgeTone(r),
                          )}
                        >
                          {etiquetaEstado(r)}
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
