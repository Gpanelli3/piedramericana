"use client";

import { Button } from "@/components/ui/button";
import { EstadoOtBadges, otTituloDisplay } from "@/components/produccion/ot-ui";
import type { OtProduccionItem } from "@/lib/produccion-api";
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
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{otTituloDisplay(item)}</p>
          <EstadoOtBadges item={item} />
        </div>
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
        {extra}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onVer}>
          <Eye className="mr-1 h-3.5 w-3.5" />
          Ver
        </Button>
        {tallerActions ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={tallerActions.onRotulo}>
              <Printer className="mr-1 h-3.5 w-3.5" />
              Rótulo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={tallerActions.planoBusy}
              onClick={tallerActions.onPlano}
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
