"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { PlanEvento } from "@/lib/planificacion-api";
import { ColumnaAgenda, type AccionesEvento } from "@/components/planificacion/ColumnaAgenda";
import type { PlanDragPayload } from "@/components/planificacion/plan-ui";

type Props = AccionesEvento & {
  dias: string[];
  eventos: PlanEvento[];
  hoy: string;
  onSoltar: (payload: PlanDragPayload, fecha: string, hora: string | null) => void;
};

export function PlanificacionDias({ dias, eventos, hoy, onSoltar, ...acciones }: Props) {
  const porDia = useMemo(() => {
    const m = new Map<string, PlanEvento[]>();
    for (const d of dias) m.set(d, []);
    for (const ev of eventos) m.get(ev.fecha)?.push(ev);
    return m;
  }, [dias, eventos]);

  return (
    <div
      className="grid min-h-0 min-w-0 flex-1 gap-2"
      style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))` }}
    >
      {dias.map((dia) => {
        const fecha = parseISO(dia);
        const esHoy = dia === hoy;
        const evs = porDia.get(dia) ?? [];
        return (
          <ColumnaAgenda
            key={dia}
            ariaLabel={format(fecha, "EEEE d 'de' MMMM", { locale: es })}
            resaltada={esHoy}
            eventos={evs}
            onSoltar={(p, hora) => onSoltar(p, dia, hora)}
            encabezado={
              <div className="flex items-start justify-between">
                <div>
                  <p className={cn("text-xs font-bold uppercase", esHoy && "text-primary")}>
                    {format(fecha, "EEE", { locale: es }).replace(".", "")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {evs.length} trabajo{evs.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className={cn("text-lg font-bold tabular-nums", esHoy && "text-primary")}>
                  {format(fecha, "d")}
                </span>
              </div>
            }
            {...acciones}
          />
        );
      })}
    </div>
  );
}
