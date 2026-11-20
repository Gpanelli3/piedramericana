"use client";

import { useMemo, useState } from "react";
import { addDays, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { claveDia } from "@/lib/planificacion-reglas";
import type { PlanEvento } from "@/lib/planificacion-api";
import { datosEvento } from "@/components/planificacion/PlanEventoCard";
import { esDragPlan, getDragPayload, horaCorta, type PlanDragPayload } from "@/components/planificacion/plan-ui";

const MAX_POR_DIA = 3;
const DIAS_SEMANA = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

/** Días (lunes a domingo) que cubre la grilla del mes que contiene `fecha`. */
export function rangoGrillaMes(fecha: string): { desde: string; hasta: string; dias: string[] } {
  const base = parseISO(fecha);
  const ini = startOfWeek(startOfMonth(base), { weekStartsOn: 1 });
  const fin = endOfWeek(endOfMonth(base), { weekStartsOn: 1 });
  const dias: string[] = [];
  for (let d = ini; d <= fin; d = addDays(d, 1)) dias.push(claveDia(d));
  return { desde: dias[0]!, hasta: dias[dias.length - 1]!, dias };
}

type Props = {
  mes: string;
  eventos: PlanEvento[];
  hoy: string;
  onAbrirDia: (fecha: string) => void;
  onEditar: (ev: PlanEvento) => void;
  /** Soltar en un día del mes lo agenda "Sin hora". */
  onSoltar: (payload: PlanDragPayload, fecha: string) => void;
};

export function PlanificacionMes({ mes, eventos, hoy, onAbrirDia, onEditar, onSoltar }: Props) {
  const { dias } = useMemo(() => rangoGrillaMes(mes), [mes]);
  const base = parseISO(mes);
  const [dropDia, setDropDia] = useState<string | null>(null);

  const porDia = useMemo(() => {
    const m = new Map<string, PlanEvento[]>();
    for (const ev of eventos) {
      const list = m.get(ev.fecha) ?? [];
      list.push(ev);
      m.set(ev.fecha, list);
    }
    return m;
  }, [eventos]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center text-[11px] font-bold uppercase text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-7 overflow-y-auto"
        style={{ gridAutoRows: "minmax(6.5rem, 1fr)" }}
      >
        {dias.map((dia) => {
          const fecha = parseISO(dia);
          const evs = porDia.get(dia) ?? [];
          const fuera = !isSameMonth(fecha, base);
          const esHoy = dia === hoy;
          return (
            <div
              key={dia}
              className={cn(
                "flex min-w-0 flex-col gap-0.5 border-b border-r border-border p-1 transition-colors [&:nth-child(7n)]:border-r-0",
                fuera && "bg-muted/40",
                dropDia === dia && "bg-primary/10",
              )}
              onDragOver={(e) => {
                if (!esDragPlan(e)) return;
                e.preventDefault();
                setDropDia(dia);
              }}
              onDragLeave={() => setDropDia(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDropDia(null);
                const p = getDragPayload(e);
                if (p) onSoltar(p, dia);
              }}
            >
              <button
                type="button"
                onClick={() => onAbrirDia(dia)}
                className={cn(
                  "ml-auto flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums hover:bg-muted",
                  fuera && "text-muted-foreground",
                  esHoy && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
                aria-label={`Abrir ${format(fecha, "EEEE d 'de' MMMM", { locale: es })}`}
              >
                {format(fecha, "d")}
              </button>
              {evs.slice(0, MAX_POR_DIA).map((ev) => {
                const d = datosEvento(ev);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onEditar(ev)}
                    className={cn(
                      "truncate rounded border-l-[3px] bg-muted/60 px-1 py-px text-left text-[11px] hover:bg-muted",
                      d.color.borde,
                      ev.estado === "hecho" && "line-through opacity-60",
                    )}
                    title={d.titulo}
                  >
                    {ev.hora_desde ? <span className="font-semibold tabular-nums">{horaCorta(ev.hora_desde)} </span> : null}
                    {d.titulo}
                  </button>
                );
              })}
              {evs.length > MAX_POR_DIA ? (
                <button
                  type="button"
                  onClick={() => onAbrirDia(dia)}
                  className="text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  +{evs.length - MAX_POR_DIA} más
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
