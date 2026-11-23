"use client";

import { Button } from "@/components/ui/button";
import { formatFechaCorta, otTituloDisplay } from "@/components/produccion/ot-ui";
import { diasHastaEntrega, type OtProduccionItem } from "@/lib/produccion-api";
import { avisoBachaPendiente } from "@/lib/bacha-reglas";
import { chipClaseEtapaOt, etiquetaEtapaOt } from "@/lib/etiquetas-ot";
import type { JobStatus } from "@/types/database";
import { cn } from "@/lib/utils";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

/** Columnas compartidas por la cabecera y las filas de la tabla de OTs. */
export const OT_GRID_COLS =
  "grid grid-cols-[minmax(13rem,2fr)_7.5rem_minmax(8rem,1.3fr)_4rem_4rem_5.5rem_5.5rem_3.5rem_minmax(5.5rem,auto)] items-center gap-x-3";

export function OtTablaCabecera() {
  return (
    <div
      className={cn(
        OT_GRID_COLS,
        "border-b border-border/70 bg-muted/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
      )}
    >
      <span>OT / Trabajo</span>
      <span>Etapa</span>
      <span>Material</span>
      <span className="text-right">m² vta</span>
      <span className="text-right">m² obra</span>
      <span>Ingreso</span>
      <span>Entrega</span>
      <span className="text-right">Días</span>
      <span />
    </div>
  );
}

type Props = {
  item: OtProduccionItem;
  /** Posición de la OT dentro de su venta (1, 2, 3…). */
  numero?: number;
  onVer: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  extra?: ReactNode;
};

function esControl(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button, a, input, textarea, select"));
}

function fmtM2(n: number): string {
  if (!(n > 0)) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Aviso({ children, tono }: { children: ReactNode; tono: "rojo" | "ambar" | "azul" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-wide",
        tono === "rojo" && "border-rose-200 bg-rose-50 text-rose-700",
        tono === "ambar" && "border-amber-200 bg-amber-50 text-amber-800",
        tono === "azul" && "border-sky-200 bg-sky-50 text-sky-800",
      )}
    >
      {children}
    </span>
  );
}

export function OtListRow({ item, numero, onVer, primaryAction, extra }: Props) {
  const o = item.orden;
  const estado = o.estado as JobStatus;
  const bachaPendiente = avisoBachaPendiente({
    bachaRequerida: Boolean(o.bacha_requerida),
    bachaAsignada: Boolean(o.bacha_id),
  });
  const entregada = estado === "done";
  const dias = entregada ? null : diasHastaEntrega(o.fecha_programada);
  const m2Distinto = item.m2Obra > 0 && Math.abs(item.m2Dif) >= 0.005;

  const onRowClick = (e: MouseEvent<HTMLDivElement>) => {
    if (esControl(e.target)) return;
    onVer();
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (esControl(e.target)) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onVer();
    }
  };

  return (
    <div
      tabIndex={0}
      onClick={onRowClick}
      onKeyDown={onRowKeyDown}
      className={cn(
        OT_GRID_COLS,
        "group cursor-pointer border-b border-border/50 px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {/* OT / Trabajo */}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {numero ? (
            <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">OT {numero}</span>
          ) : null}
          <span className="truncate font-medium text-foreground underline-offset-2 group-hover:underline">
            {otTituloDisplay(item)}
          </span>
        </div>
        {o.bloqueada || bachaPendiente || item.esReposicion || o.pausada ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {o.bloqueada ? (
              <Aviso tono="rojo">{o.motivo_bloqueo ? `Bloqueada · ${o.motivo_bloqueo}` : "Bloqueada"}</Aviso>
            ) : null}
            {bachaPendiente && !o.bloqueada ? <Aviso tono="rojo">Falta bacha</Aviso> : null}
            {item.esReposicion ? <Aviso tono="azul">Reposición</Aviso> : null}
            {o.pausada ? <Aviso tono="ambar">Pausada</Aviso> : null}
          </div>
        ) : null}
      </div>

      {/* Etapa */}
      <span>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            chipClaseEtapaOt(o.etapa, estado),
          )}
        >
          {etiquetaEtapaOt(String(o.etapa), estado)}
        </span>
      </span>

      {/* Material */}
      <span className="truncate text-muted-foreground" title={item.materialLabel}>
        {item.materialLabel || "—"}
      </span>

      {/* m² */}
      <span className="text-right tabular-nums text-muted-foreground">{fmtM2(item.m2Venta)}</span>
      <span
        className={cn(
          "text-right tabular-nums",
          m2Distinto ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {fmtM2(item.m2Obra)}
      </span>

      {/* Fechas */}
      <span className="tabular-nums text-muted-foreground">{formatFechaCorta(o.creado_en)}</span>
      <span className="tabular-nums text-foreground">
        {entregada ? formatFechaCorta(o.entregada_en) : formatFechaCorta(o.fecha_programada)}
      </span>

      {/* Días hasta la entrega */}
      <span
        className={cn(
          "text-right text-xs font-semibold tabular-nums",
          dias === null && "text-muted-foreground",
          dias !== null && dias < 0 && "text-rose-700",
          dias !== null && dias >= 0 && dias <= 5 && "text-amber-700",
          dias !== null && dias > 5 && "text-foreground",
        )}
        title={dias === null ? undefined : dias < 0 ? `Vencida hace ${-dias} días` : `Faltan ${dias} días`}
      >
        {dias === null ? "—" : dias < 0 ? `${dias}d` : `${dias}d`}
      </span>

      {/* Acción */}
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {extra}
        {primaryAction ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={primaryAction.disabled}
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
