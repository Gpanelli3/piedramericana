"use client";

import { Button } from "@/components/ui/button";
import { otTituloDisplay } from "@/components/produccion/ot-ui";
import { useTallerOtActions } from "@/components/produccion/useAccionesRotuloOt";
import type { OtProduccionItem } from "@/lib/produccion-api";
import { avisoBachaPendiente } from "@/lib/bacha-reglas";
import { ArrowRight, Eye, FileImage, Printer } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  item: OtProduccionItem;
  onVer: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  extra?: ReactNode;
  tallerActions?: {
    onRotulo: () => void;
    onPlano: () => void;
    planoBusy?: boolean;
  };
};

export function OtListRow({ item, onVer, primaryAction, extra, tallerActions }: Props) {
  const taller = useTallerOtActions();
  const actions = taller
    ? {
        onRotulo: () => taller.irARotulo(item.orden.id),
        onPlano: () => void taller.abrirPlano(item),
        planoBusy: taller.busyPlanoId === item.orden.id,
      }
    : tallerActions;
  const bachaPendiente = avisoBachaPendiente({
    bachaRequerida: Boolean(item.orden.bacha_requerida),
    bachaAsignada: Boolean(item.orden.bacha_id),
  });
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="truncate text-sm font-medium text-foreground">{otTituloDisplay(item)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.cliente}
          <span className="mx-1.5 text-border">·</span>
          {item.materialLabel}
        </p>
        {item.orden.bloqueada && item.orden.motivo_bloqueo ? (
          <p className="text-[11px] text-red-700 dark:text-red-300">
            Bloqueo: {item.orden.motivo_bloqueo}
          </p>
        ) : null}
        {bachaPendiente && !item.orden.bloqueada ? (
          <p className="text-[11px] text-amber-700 dark:text-amber-300">{bachaPendiente}</p>
        ) : null}
        {extra}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onVer}>
          <Eye className="mr-1 h-3.5 w-3.5" />
          Ver
        </Button>
        {actions ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={actions.onRotulo}>
              <Printer className="mr-1 h-3.5 w-3.5" />
              Rótulo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={actions.planoBusy}
              onClick={actions.onPlano}
            >
              <FileImage className="mr-1 h-3.5 w-3.5" />
              Plano
            </Button>
          </>
        ) : null}
        {primaryAction ? (
          <Button
            type="button"
            size="sm"
            disabled={primaryAction.disabled}
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
