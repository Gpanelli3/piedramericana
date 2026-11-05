"use client";

import { Button } from "@/components/ui/button";
import { otTituloDisplay } from "@/components/produccion/ot-ui";
import type { OtProduccionItem } from "@/lib/produccion-api";
import { avisoBachaPendiente } from "@/lib/bacha-reglas";
import { ArrowRight } from "lucide-react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

type Props = {
  item: OtProduccionItem;
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

export function OtListRow({ item, onVer, primaryAction, extra }: Props) {
  const bachaPendiente = avisoBachaPendiente({
    bachaRequerida: Boolean(item.orden.bacha_requerida),
    bachaAsignada: Boolean(item.orden.bacha_id),
  });

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
      className="flex cursor-pointer flex-col gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
    >
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
      {primaryAction ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={primaryAction.disabled}
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
