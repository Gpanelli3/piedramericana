"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PlanEvento } from "@/lib/planificacion-api";
import { datosEvento, motivoNoTildar } from "@/components/planificacion/PlanEventoCard";
import { horaCorta } from "@/components/planificacion/plan-ui";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventos: PlanEvento[];
  busyId: string | null;
  onTildar: (ev: PlanEvento) => void;
  /** Abre ese día en el calendario para reagendar. */
  onIrAlDia: (fecha: string) => void;
};

/** Entregas agendadas en días que ya pasaron y siguen sin tildar. */
export function SinMarcarDialog({ open, onOpenChange, eventos, busyId, onTildar, onIrAlDia }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Entregas sin marcar</DialogTitle>
          <DialogDescription>
            Estaban agendadas para días que ya pasaron. Tildá las que se entregaron o abrí el día para reagendarlas.
          </DialogDescription>
        </DialogHeader>
        {eventos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No hay entregas atrasadas.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {eventos.map((ev) => {
              const d = datosEvento(ev);
              const motivo = motivoNoTildar(ev);
              return (
                <li key={ev.id} className={cn("flex flex-wrap items-center gap-3 border-l-4 px-3 py-2.5", d.color.borde)}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                      {format(parseISO(ev.fecha), "EEE d/M", { locale: es })}
                      {ev.hora_desde ? ` · ${horaCorta(ev.hora_desde)}` : ""}
                    </p>
                    <p className="truncate text-sm font-semibold">{d.titulo}</p>
                    <p className="truncate text-xs text-muted-foreground">{d.linea}</p>
                    {motivo ? <p className="text-xs text-amber-700 dark:text-amber-300">{motivo}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => onIrAlDia(ev.fecha)}>
                      <CalendarClock className="mr-1 h-4 w-4" />
                      Reagendar
                    </Button>
                    <Button size="sm" onClick={() => onTildar(ev)} disabled={busyId === ev.id || motivo !== null}>
                      <CircleCheck className="mr-1 h-4 w-4" />
                      Entregada
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
