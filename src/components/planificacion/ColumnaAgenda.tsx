"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanEvento } from "@/lib/planificacion-api";
import { PlanEventoCard } from "@/components/planificacion/PlanEventoCard";
import {
  HORA_FIN,
  HORA_INICIO,
  PX_POR_HORA,
  columnasSolapadas,
  esDragPlan,
  getDragPayload,
  horaDesdeOffset,
  posicionEvento,
  type PlanDragPayload,
} from "@/components/planificacion/plan-ui";

export type AccionesEvento = {
  busyId: string | null;
  onTildar: (ev: PlanEvento) => void;
  onReabrir: (ev: PlanEvento) => void;
  onDesagendar: (ev: PlanEvento) => void;
  onVer: (ev: PlanEvento) => void;
  onEditar: (ev: PlanEvento) => void;
};

const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);

/**
 * Una columna de agenda: carril "Sin hora" + grilla horaria.
 * La usan la vista Días (una por día) y la vista Equipos (una por empleado).
 */
export function ColumnaAgenda({
  ariaLabel,
  encabezado,
  resaltada,
  eventos,
  empleadoId,
  onSoltar,
  ...acciones
}: AccionesEvento & {
  ariaLabel: string;
  encabezado: ReactNode;
  resaltada?: boolean;
  eventos: PlanEvento[];
  /** En la vista Equipos: el empleado de la columna (null = sin asignar). */
  empleadoId?: string | null;
  onSoltar: (payload: PlanDragPayload, hora: string | null) => void;
}) {
  const sinHora = eventos.filter((e) => !e.hora_desde);
  const conHora = useMemo(() => eventos.filter((e) => e.hora_desde), [eventos]);
  const columnas = useMemo(() => columnasSolapadas(conHora), [conHora]);
  const [dropSinHora, setDropSinHora] = useState(false);
  const [dropHora, setDropHora] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Arranca mostrando las 8 de la mañana.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = (8 - HORA_INICIO) * PX_POR_HORA;
  }, []);

  const horaDesdeEvento = (e: DragEvent) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return horaDesdeOffset(e.clientY - rect.top);
  };

  const card = (ev: PlanEvento, extra?: { compacta?: boolean; className?: string; style?: React.CSSProperties }) => (
    <PlanEventoCard
      key={ev.id}
      evento={ev}
      busy={acciones.busyId === ev.id}
      empleadoColumnaId={empleadoId}
      {...acciones}
      {...extra}
    />
  );

  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card",
        resaltada ? "border-primary/60" : "border-border",
      )}
      aria-label={ariaLabel}
    >
      <header className="border-b border-border px-3 py-2">{encabezado}</header>

      <div
        className={cn("border-b border-border px-2 py-1.5 transition-colors", dropSinHora && "bg-primary/10")}
        onDragOver={(e) => {
          if (!esDragPlan(e)) return;
          e.preventDefault();
          setDropSinHora(true);
        }}
        onDragLeave={() => setDropSinHora(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropSinHora(false);
          const p = getDragPayload(e);
          if (p) onSoltar(p, null);
        }}
      >
        <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden />
          Sin hora
        </p>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {sinHora.map((ev) => card(ev))}
          {sinHora.length === 0 ? <div className="h-6" /> : null}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div
          ref={gridRef}
          className="relative"
          style={{ height: HORAS.length * PX_POR_HORA }}
          onDragOver={(e) => {
            if (!esDragPlan(e)) return;
            e.preventDefault();
            setDropHora(horaDesdeEvento(e));
          }}
          onDragLeave={() => setDropHora(null)}
          onDrop={(e) => {
            e.preventDefault();
            const hora = horaDesdeEvento(e);
            setDropHora(null);
            const p = getDragPayload(e);
            if (p && hora) onSoltar(p, hora);
          }}
        >
          {HORAS.map((h, i) => (
            <div key={h} className="absolute inset-x-0 border-t border-border/70" style={{ top: i * PX_POR_HORA }}>
              <span className="absolute left-1.5 top-0.5 text-[10px] tabular-nums text-muted-foreground">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}

          {dropHora ? (
            <div
              className="pointer-events-none absolute inset-x-1 z-20 rounded border-2 border-dashed border-primary bg-primary/10 px-1 text-[10px] font-semibold text-primary"
              style={posicionEvento(dropHora, null)}
            >
              {dropHora}
            </div>
          ) : null}

          {conHora.map((ev) => {
            const pos = posicionEvento(ev.hora_desde, ev.hora_hasta);
            const c = columnas.get(ev.id) ?? { col: 0, cols: 1 };
            const ancho = `calc((100% - 2.75rem) / ${c.cols})`;
            return card(ev, {
              compacta: pos.height < 72 || c.cols > 2,
              className: "absolute z-10",
              style: {
                top: pos.top + 1,
                height: pos.height - 2,
                left: `calc(2.5rem + ${c.col} * ${ancho})`,
                width: `calc(${ancho} - 2px)`,
              },
            });
          })}
        </div>
      </div>
    </section>
  );
}
