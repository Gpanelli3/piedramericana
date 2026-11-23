"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  Check,
  ChevronDown,
  Search,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FechaInput } from "@/components/ui/fecha-input";
import { rangoFechasInvertido } from "@/lib/fecha-rango";
import {
  chipsFiltros,
  CLIENTE_TODOS,
  contarFiltrosActivos,
  FILTRO_ESTADO_LABELS,
  FILTRO_ESTADO_VALORES,
  FILTROS_LISTA_VACIOS,
  hayFiltrosActivos,
  ORDEN_LISTA_LABELS,
  ORDEN_LISTA_VALORES,
  quitarChip,
  VENDEDOR_SIN,
  VENDEDOR_TODOS,
  type FiltroEstadoLista,
  type FiltrosLista,
  type OrdenLista,
} from "@/lib/lista-filtros";
import { cn } from "@/lib/utils";

type Props = {
  busqueda: string;
  onBusqueda: (v: string) => void;
  placeholder: string;
  ariaLabel?: string;
  filtros: FiltrosLista;
  onFiltrosChange: Dispatch<SetStateAction<FiltrosLista>>;
  orden: OrdenLista;
  onOrdenChange: (o: OrdenLista) => void;
  vendedores: { id: string; nombre: string }[];
  haySinVendedor?: boolean;
  clientes: { key: string; nombre: string }[];
  mostrarCliente?: boolean;
  idPrefix: string;
  trailing?: ReactNode;
};

function interactOutsideEsPortalAnidado(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("[data-slot='select-content']") ||
      target.closest("[data-slot='popover-content']") ||
      target.closest("[data-slot='calendar']"),
  );
}

export function BarraFiltrosLista({
  busqueda,
  onBusqueda,
  placeholder,
  ariaLabel,
  filtros,
  onFiltrosChange,
  orden,
  onOrdenChange,
  vendedores,
  haySinVendedor = false,
  clientes,
  mostrarCliente = true,
  idPrefix,
  trailing,
}: Props) {
  const count = contarFiltrosActivos(filtros);
  const vendedorNombre =
    filtros.vendedorId === VENDEDOR_SIN
      ? "Sin vendedor"
      : vendedores.find((v) => v.id === filtros.vendedorId)?.nombre;
  const clienteNombre = clientes.find((c) => c.key === filtros.clienteKey)?.nombre;
  const chips = chipsFiltros(filtros, { vendedorNombre, clienteNombre });
  const rangoInvertido = rangoFechasInvertido(filtros.fechaDesde, filtros.fechaHasta);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1" data-guia="buscar">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            className="h-9 pl-9 pr-9"
            placeholder={placeholder}
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            aria-label={ariaLabel ?? placeholder}
          />
          {busqueda.trim() ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => onBusqueda("")}
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 shrink-0 gap-1.5",
                count > 0 && "border-accent",
              )}
              aria-label={count > 0 ? `Filtros, ${count} activos` : "Filtros"}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Filtros
              {count > 0 ? (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                  {count}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[22rem] max-h-[min(36rem,var(--radix-popover-content-available-height))] overflow-y-auto p-4"
            onInteractOutside={(e) => {
              if (interactOutsideEsPortalAnidado(e.target)) e.preventDefault();
            }}
            onFocusOutside={(e) => {
              if (interactOutsideEsPortalAnidado(e.target)) e.preventDefault();
            }}
          >
            <div className="flex flex-col gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-estado`}>Estado</Label>
                <Select
                  value={filtros.estado}
                  onValueChange={(v) =>
                    onFiltrosChange((prev) => ({
                      ...prev,
                      estado: v as FiltroEstadoLista,
                    }))
                  }
                >
                  <SelectTrigger id={`${idPrefix}-estado`} className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTRO_ESTADO_VALORES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {FILTRO_ESTADO_LABELS[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-vendedor`} className="text-muted-foreground">
                  <User className="h-3.5 w-3.5" aria-hidden />
                  Vendedor
                </Label>
                <Select
                  value={filtros.vendedorId || VENDEDOR_TODOS}
                  onValueChange={(v) =>
                    onFiltrosChange((prev) => ({
                      ...prev,
                      vendedorId: v === VENDEDOR_TODOS ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger id={`${idPrefix}-vendedor`} className="h-10 w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VENDEDOR_TODOS}>Todos</SelectItem>
                    {haySinVendedor ? (
                      <SelectItem value={VENDEDOR_SIN}>Sin vendedor</SelectItem>
                    ) : null}
                    {vendedores.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {mostrarCliente ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`${idPrefix}-cliente`} className="text-muted-foreground">
                    Cliente
                  </Label>
                  <Select
                    value={filtros.clienteKey || CLIENTE_TODOS}
                    onValueChange={(v) =>
                      onFiltrosChange((prev) => ({
                        ...prev,
                        clienteKey: v === CLIENTE_TODOS ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger id={`${idPrefix}-cliente`} className="h-10 w-full">
                      <SelectValue placeholder="Cliente: todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CLIENTE_TODOS}>Cliente: todos</SelectItem>
                      {clientes.map((c) => (
                        <SelectItem key={c.key} value={c.key}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <p className="text-sm font-medium text-muted-foreground">Cobro</p>
                <button
                  type="button"
                  aria-pressed={filtros.soloSaldoPendiente}
                  onClick={() =>
                    onFiltrosChange((prev) => ({
                      ...prev,
                      soloSaldoPendiente: !prev.soloSaldoPendiente,
                    }))
                  }
                  className={cn(
                    "flex h-10 w-full items-center justify-center rounded-full border text-sm transition-colors",
                    filtros.soloSaldoPendiente
                      ? "border-accent bg-accent/15 font-medium text-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  Solo con saldo pendiente
                </button>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-medium">Rango de fechas</p>
                <div className="flex items-center gap-2">
                  <FechaInput
                    id={`${idPrefix}-desde`}
                    value={filtros.fechaDesde}
                    onChange={(v) =>
                      onFiltrosChange((prev) => ({ ...prev, fechaDesde: v }))
                    }
                    className="h-10"
                  />
                  <span className="shrink-0 text-muted-foreground" aria-hidden>
                    –
                  </span>
                  <FechaInput
                    id={`${idPrefix}-hasta`}
                    value={filtros.fechaHasta}
                    onChange={(v) =>
                      onFiltrosChange((prev) => ({ ...prev, fechaHasta: v }))
                    }
                    className="h-10"
                  />
                </div>
                {rangoInvertido ? (
                  <p className="text-xs text-destructive">
                    La fecha desde es posterior a hasta.
                  </p>
                ) : null}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 max-w-[14rem] shrink-0 gap-1.5"
              aria-label={`Ordenar: ${ORDEN_LISTA_LABELS[orden]}`}
            >
              <span className="truncate">Ordenar {ORDEN_LISTA_LABELS[orden]}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            {ORDEN_LISTA_VALORES.map((o) => (
              <DropdownMenuItem
                key={o}
                onSelect={() => onOrdenChange(o)}
                className="justify-between gap-4"
              >
                {ORDEN_LISTA_LABELS[o]}
                {orden === o ? <Check className="h-4 w-4" aria-hidden /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {trailing}
      </div>

      {hayFiltrosActivos(filtros) ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-foreground"
            >
              {chip.label}
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onFiltrosChange((prev) => quitarChip(prev, chip.id))}
                aria-label={`Quitar filtro ${chip.label}`}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={() => onFiltrosChange({ ...FILTROS_LISTA_VACIOS })}
          >
            Limpiar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
