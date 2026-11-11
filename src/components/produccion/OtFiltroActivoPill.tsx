"use client";

import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OT_TAB_CHIP } from "@/lib/etiquetas-ot";
import { PRODUCCION_OT_LABELS, type ProduccionOtFiltro } from "@/types/workspace";

export type FiltroOtSeccion = Exclude<ProduccionOtFiltro, "general">;

export function OtFiltroActivoPill({
  filtro,
  onClear,
}: {
  filtro: FiltroOtSeccion;
  onClear: () => void;
}) {
  const label = PRODUCCION_OT_LABELS[filtro];
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={`Cerrar ${label} y ver todas las OTs`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-semibold transition-opacity hover:opacity-80",
        OT_TAB_CHIP[filtro],
      )}
    >
      {label}
      <X className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

export function OtSeccionHeader({
  filtro,
  count,
}: {
  filtro: FiltroOtSeccion;
  count: string;
}) {
  const [, setSearchParams] = useSearchParams();

  const irAGeneral = () => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("ws", "produccion");
        n.set("ot", "general");
        return n;
      },
      { replace: true },
    );
  };

  return (
    <header className="border-b border-border bg-white px-5 py-4 sm:px-6 dark:bg-background">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-bold text-foreground">Órdenes de Trabajo</h1>
          <OtFiltroActivoPill filtro={filtro} onClear={irAGeneral} />
        </div>
        <Badge variant="outline" className="w-fit text-sm font-medium">
          {count}
        </Badge>
      </div>
    </header>
  );
}
