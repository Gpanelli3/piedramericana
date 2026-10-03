"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  coalesceEtapaOt,
  diasHastaEntrega,
  urgenciaOt,
  type EtapaOtId,
  type OtProduccionItem,
  type UrgenciaOt,
} from "@/lib/produccion-api";
import { etiquetaEtapaOt } from "@/lib/etiquetas-ot";
import { formatDifMetraje, formatMetraje } from "@/lib/presupuesto-calculos";
import type { JobStatus, VentaEstado } from "@/types/database";
import { AlertTriangle, Lock, Pause, RotateCcw } from "lucide-react";

const ETAPA_BADGE: Record<EtapaOtId, string> = {
  medicion: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200",
  corte: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200",
  produccion:
    "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200",
  despacho: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200",
};

const URGENCIA_BADGE: Record<Exclude<UrgenciaOt, "ok" | "sin_fecha">, string> = {
  vencida: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200",
  urgente: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100",
};

export function EtapaBadge({ etapa, estado }: { etapa: string; estado?: JobStatus | null }) {
  const e = coalesceEtapaOt(etapa);
  if (estado === "done") {
    return (
      <Badge variant="secondary" className="text-[10px] font-medium">
        Entregada
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium border", ETAPA_BADGE[e])}>
      {etiquetaEtapaOt(e, estado ?? null)}
    </Badge>
  );
}

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

export function EstadoOtBadges({ item }: { item: OtProduccionItem }) {
  const { orden } = item;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <EtapaBadge etapa={String(orden.etapa)} estado={orden.estado as JobStatus} />
      <UrgenciaBadge fechaProgramada={orden.fecha_programada} />
      {orden.bloqueada ? (
        <Badge
          variant="outline"
          className="gap-1 border-red-200 bg-red-50 text-[10px] text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
          title={orden.motivo_bloqueo ?? undefined}
        >
          <Lock className="h-3 w-3" />
          Bloqueada
        </Badge>
      ) : null}
      {orden.pausada ? (
        <Badge
          variant="outline"
          className="gap-1 border-gray-200 bg-gray-100 text-[10px] text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          <Pause className="h-3 w-3" />
          Pausada
        </Badge>
      ) : null}
      {item.esReposicion ? (
        <Badge
          variant="outline"
          className="gap-1 border-violet-200 bg-violet-50 text-[10px] text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200"
          title={item.otOrigenTitulo ? `De ${item.otOrigenTitulo}` : undefined}
        >
          <RotateCcw className="h-3 w-3" />
          Reposición
        </Badge>
      ) : null}
      {item.m2Significativo ? (
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 text-[10px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          Revisar $
        </Badge>
      ) : null}
      {!orden.medidas_confirmadas && coalesceEtapaOt(orden.etapa) === "medicion" ? (
        <Badge variant="outline" className="text-[10px]">
          En medición
        </Badge>
      ) : null}
    </div>
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

export function M2TrioTexto({ item }: { item: OtProduccionItem }) {
  return (
    <span className="tabular-nums">
      Cot. {formatMetraje(item.m2Venta)}
      <span className="mx-1 text-border">·</span>
      Obra {formatMetraje(item.m2Obra)}
      <span className="mx-1 text-border">·</span>
      {formatDifMetraje(item.m2Dif)}
    </span>
  );
}
