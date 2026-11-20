"use client";

import { useMemo } from "react";
import { UserRound, UserX } from "lucide-react";
import type { EmpleadoAsignable, PlanEvento } from "@/lib/planificacion-api";
import { ColumnaAgenda, type AccionesEvento } from "@/components/planificacion/ColumnaAgenda";
import type { PlanDragPayload } from "@/components/planificacion/plan-ui";

type Props = AccionesEvento & {
  /** Eventos del día elegido. */
  eventos: PlanEvento[];
  empleados: EmpleadoAsignable[];
  /** Soltar en la columna de un empleado lo asigna a él (null = sin asignar). */
  onSoltar: (payload: PlanDragPayload, empleadoId: string | null, hora: string | null) => void;
};

/** Un día, una columna por empleado: sirve para ver quién está libre y repartir el trabajo. */
export function PlanificacionEquipos({ eventos, empleados, onSoltar, ...acciones }: Props) {
  const columnas = useMemo(() => {
    const sinAsignar = eventos.filter((e) => e.empleados.length === 0);
    const porEmpleado = new Map<string, PlanEvento[]>();
    for (const ev of eventos) {
      for (const emp of ev.empleados) {
        const list = porEmpleado.get(emp.id) ?? [];
        list.push(ev);
        porEmpleado.set(emp.id, list);
      }
    }
    // Primero los que tienen trabajo ese día, después el resto.
    const ordenados = [...empleados].sort((a, b) => {
      const ca = porEmpleado.get(a.id)?.length ?? 0;
      const cb = porEmpleado.get(b.id)?.length ?? 0;
      if ((ca > 0) !== (cb > 0)) return ca > 0 ? -1 : 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
    return [
      { id: null as string | null, nombre: "Sin asignar", puesto: null as string | null, eventos: sinAsignar },
      ...ordenados.map((e) => ({ id: e.id as string | null, nombre: e.nombre, puesto: e.puesto, eventos: porEmpleado.get(e.id) ?? [] })),
    ];
  }, [eventos, empleados]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {empleados.length === 0 ? (
        <p className="mb-2 text-xs text-muted-foreground">
          No hay empleados activos. Cargalos en Equipo para repartir el trabajo por persona.
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto pb-1">
        {columnas.map((c) => (
          <div key={c.id ?? "sin-asignar"} className="flex min-h-0 w-60 shrink-0 flex-col">
            <ColumnaAgenda
              ariaLabel={c.nombre}
              eventos={c.eventos}
              empleadoId={c.id}
              onSoltar={(p, hora) => onSoltar(p, c.id, hora)}
              encabezado={
                <div className="flex items-center gap-2">
                  {c.id ? (
                    <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <UserX className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.nombre}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {c.eventos.length} trabajo{c.eventos.length === 1 ? "" : "s"}
                      {c.puesto ? ` · ${c.puesto}` : ""}
                    </p>
                  </div>
                </div>
              }
              {...acciones}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
