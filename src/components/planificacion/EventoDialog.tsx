"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  coalesceTipoEntrega,
  horaHastaPorDefecto,
  TIPOS_ENTREGA,
  validarHorario,
} from "@/lib/planificacion-reglas";
import {
  crearTarea,
  editarEvento,
  moverEvento,
  setTipoEntregaOt,
  type EmpleadoAsignable,
  type PlanEvento,
} from "@/lib/planificacion-api";
import type { TipoEntregaOt } from "@/types/database";
import { datosEvento } from "@/components/planificacion/PlanEventoCard";
import { horaCorta } from "@/components/planificacion/plan-ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = Nueva tarea. */
  evento: PlanEvento | null;
  /** Fecha sugerida para una tarea nueva. */
  fechaInicial: string;
  empleados: EmpleadoAsignable[];
  usuarioId: string | null;
  onGuardado: () => void;
};

export function EventoDialog({ open, onOpenChange, evento, fechaInicial, empleados, usuarioId, onGuardado }: Props) {
  const esNueva = evento === null;
  const esTarea = esNueva || evento.tipo === "tarea";
  const editable = esNueva || evento.estado === "pendiente";

  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [asignados, setAsignados] = useState<Set<string>>(new Set());
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntregaOt>("retira");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitulo(evento?.titulo ?? "");
    setFecha(evento?.fecha ?? fechaInicial);
    setDesde(horaCorta(evento?.hora_desde));
    setHasta(horaCorta(evento?.hora_hasta));
    setDireccion(evento?.direccion ?? "");
    setNotas(evento?.notas ?? "");
    setAsignados(new Set(evento?.empleados.map((e) => e.id) ?? []));
    setTipoEntrega(coalesceTipoEntrega(evento?.ot?.orden.tipo_entrega));
  }, [open, evento, fechaInicial]);

  const toggleEmpleado = (id: string) =>
    setAsignados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const onCambiarDesde = (v: string) => {
    setDesde(v);
    // Si no había fin, propone la duración por defecto.
    if (v && !hasta) setHasta(horaHastaPorDefecto(v, evento?.tipo ?? "tarea") ?? "");
  };

  const guardar = async () => {
    const h = validarHorario(desde, hasta);
    if (!h.ok) {
      toast.error(h.error);
      return;
    }
    if (!fecha) {
      toast.error("Elegí una fecha.");
      return;
    }
    if (esTarea && !titulo.trim()) {
      toast.error("Poné un título a la tarea.");
      return;
    }
    setGuardando(true);
    const empleadoIds = [...asignados];
    let error: Error | null = null;

    if (esNueva) {
      ({ error } = await crearTarea({
        titulo,
        fecha,
        horaDesde: h.horaDesde,
        horaHasta: h.horaHasta,
        direccion,
        notas,
        empleadoIds,
        usuarioId,
      }));
    } else {
      const cambioHorario =
        fecha !== evento.fecha ||
        h.horaDesde !== (horaCorta(evento.hora_desde) || null) ||
        h.horaHasta !== (horaCorta(evento.hora_hasta) || null);
      if (editable && cambioHorario) {
        ({ error } = await moverEvento({
          eventoId: evento.id,
          fecha,
          horaDesde: h.horaDesde,
          horaHasta: h.horaHasta,
        }));
      }
      if (!error) {
        ({ error } = await editarEvento({
          eventoId: evento.id,
          ...(esTarea ? { titulo, direccion } : {}),
          notas,
          empleadoIds,
        }));
      }
      if (!error && evento.tipo === "entrega" && evento.ot && tipoEntrega !== coalesceTipoEntrega(evento.ot.orden.tipo_entrega)) {
        ({ error } = await setTipoEntregaOt(evento.ot.orden.id, tipoEntrega));
      }
    }

    setGuardando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(esNueva ? "Tarea creada." : "Cambios guardados.");
    onOpenChange(false);
    onGuardado();
  };

  const d = evento ? datosEvento(evento) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{esNueva ? "Nueva tarea" : d?.titulo}</DialogTitle>
          <DialogDescription>
            {esNueva
              ? "Algo que no es una OT: una visita, una reparación, un retiro de material."
              : [d?.etiqueta, d?.linea].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {esTarea ? (
            <div className="space-y-1.5">
              <Label htmlFor="plan-titulo">Título</Label>
              <Input
                id="plan-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej.: Visita para ver terminación"
                autoFocus
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-fecha">Fecha</Label>
              <Input
                id="plan-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                disabled={!editable}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-desde">Desde</Label>
              <Input
                id="plan-desde"
                type="time"
                step={900}
                value={desde}
                onChange={(e) => onCambiarDesde(e.target.value)}
                disabled={!editable}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-hasta">Hasta</Label>
              <Input
                id="plan-hasta"
                type="time"
                step={900}
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                disabled={!editable || !desde}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">Sin hora de inicio queda en el carril «Sin hora».</p>

          {evento?.tipo === "entrega" && evento.ot ? (
            <div className="space-y-1.5">
              <Label htmlFor="plan-tipo">Tipo de entrega</Label>
              <select
                id="plan-tipo"
                value={tipoEntrega}
                onChange={(e) => setTipoEntrega(e.target.value as TipoEntregaOt)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {TIPOS_ENTREGA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Quiénes van</legend>
            {empleados.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay empleados activos cargados en Equipo.</p>
            ) : (
              <div className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
                {empleados.map((e) => (
                  <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <Checkbox
                      checked={asignados.has(e.id)}
                      onCheckedChange={() => toggleEmpleado(e.id)}
                      aria-label={e.nombre}
                    />
                    <span className="min-w-0 truncate">{e.nombre}</span>
                    {e.puesto ? <span className="ml-auto truncate text-[11px] text-muted-foreground">{e.puesto}</span> : null}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          {esTarea ? (
            <div className="space-y-1.5">
              <Label htmlFor="plan-dir">Dirección</Label>
              <Input id="plan-dir" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </div>
          ) : d?.direccion ? (
            <p className="text-sm text-muted-foreground">{d.direccion}</p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="plan-notas">Notas</Label>
            <Textarea id="plan-notas" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={guardando}>
            {guardando ? "Guardando…" : esNueva ? "Crear tarea" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
