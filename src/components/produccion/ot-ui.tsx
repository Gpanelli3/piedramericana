"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  diasHastaEntrega,
  urgenciaOt,
  type OtProduccionItem,
  type UrgenciaOt,
} from "@/lib/produccion-api";
import { formatDifMetraje, formatMetraje } from "@/lib/presupuesto-calculos";
import type { VentaEstado } from "@/types/database";
import { AlertTriangle } from "lucide-react";

const URGENCIA_BADGE: Record<Exclude<UrgenciaOt, "ok" | "sin_fecha">, string> = {
  vencida: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200",
  urgente: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100",
};

export function UrgenciaBadge({ fechaProgramada }: { fechaProgramada: string | null }) {
  const u = urgenciaOt(fechaProgramada);
  if (u === "ok" || u === "sin_fecha") return null;
  const dias = diasHastaEntrega(fechaProgramada);
  const label =
    u === "vencida"
      ? dias === null
        ? "Vencida"
        : `Vencida ${Math.abs(dias)}d`
      : dias === 0
        ? "Hoy"
        : `${dias}d`;
  return (
    <Badge variant="outline" className={cn("gap-1 text-[10px] font-medium border", URGENCIA_BADGE[u])}>
      <AlertTriangle className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export function etiquetaVentaEstado(estado: VentaEstado | null | undefined): string {
  switch (estado) {
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
      return estado ?? "—";
  }
}

export function formatFechaCorta(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

export function otTituloDisplay(item: OtProduccionItem): string {
  return item.orden.titulo?.trim() || `OT · ${item.presupuestoNumero}`;
}

export function M2Comparacion({ item }: { item: OtProduccionItem }) {
  const sinDatos = item.m2Venta <= 0 && item.m2Obra <= 0;
  const igual = Math.abs(item.m2Dif) < 0.005;
  const destaca = !igual && item.m2Significativo;

  if (sinDatos) {
    return (
      <p className="text-xs text-muted-foreground">Todavía no hay metros cargados.</p>
    );
  }

  return (
    <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-xs">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Metros cuadrados
      </p>
      <div className="mt-1.5 grid grid-cols-3 gap-3">
        <div>
          <p className="text-muted-foreground">Cotizado</p>
          <p className="font-medium tabular-nums text-foreground">
            {formatMetraje(item.m2Venta)} m²
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Medido en obra</p>
          <p className="font-medium tabular-nums text-foreground">
            {formatMetraje(item.m2Obra)} m²
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Diferencia</p>
          <p
            className={cn(
              "font-medium tabular-nums",
              destaca
                ? "text-amber-800 dark:text-amber-200"
                : igual
                  ? "text-muted-foreground"
                  : "text-foreground",
            )}
          >
            {igual ? "Igual" : `${formatDifMetraje(item.m2Dif)} m²`}
          </p>
        </div>
      </div>
    </div>
  );
}
