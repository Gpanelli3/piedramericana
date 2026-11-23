"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, addMonths, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  Minus,
  Plus,
  Ruler,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { isSupabaseConfigured } from "@/lib/supabase";
import { claveDia, TIPOS_ENTREGA } from "@/lib/planificacion-reglas";
import {
  agendarEntregas,
  agendarMedicion,
  asignarEmpleados,
  desagendarEvento,
  listarCola,
  listarEmpleadosAsignables,
  listarEntregasSinMarcar,
  listarEventos,
  marcarEventoHecho,
  moverEvento,
  reabrirTarea,
  type ColaPlanificacion,
  type EmpleadoAsignable,
  type PlanEvento,
} from "@/lib/planificacion-api";
import type { OtProduccionItem } from "@/lib/produccion-api";
import type { PlanificacionEventoTipo } from "@/types/database";
import { OtDetalleDialog } from "@/components/produccion/OtDetalleDialog";
import { PlanificacionCola } from "@/components/planificacion/PlanificacionCola";
import { PlanificacionDias } from "@/components/planificacion/PlanificacionDias";
import { PlanificacionEquipos } from "@/components/planificacion/PlanificacionEquipos";
import { PlanificacionMes, rangoGrillaMes } from "@/components/planificacion/PlanificacionMes";
import { EventoDialog } from "@/components/planificacion/EventoDialog";
import { SinMarcarDialog } from "@/components/planificacion/SinMarcarDialog";
import { COLOR_TIPO_ENTREGA, type PlanDragPayload } from "@/components/planificacion/plan-ui";

type Filtro = "todos" | PlanificacionEventoTipo;
type Modo = "equipos" | "dias" | "mes";

const FILTROS: { id: Filtro; label: string; icon: React.ReactNode }[] = [
  { id: "todos", label: "Todos", icon: <LayoutGrid className="h-4 w-4" /> },
  { id: "entrega", label: "Entregas", icon: <Truck className="h-4 w-4" /> },
  { id: "medicion", label: "Medición", icon: <Ruler className="h-4 w-4" /> },
  { id: "tarea", label: "Tareas", icon: <ClipboardList className="h-4 w-4" /> },
];

const MODOS: { id: Modo; label: string }[] = [
  { id: "equipos", label: "Equipos" },
  { id: "dias", label: "Días" },
  { id: "mes", label: "Mes" },
];

const COLA_VACIA: ColaPlanificacion = { grupos: [], mediciones: [] };

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function VistaPlanificacion() {
  const { user } = useAuth();
  const usuarioId = user?.id ?? null;
  const isMobile = useIsMobile();

  const hoy = claveDia(new Date());
  const [inicio, setInicio] = useState(hoy);
  const [cantDias, setCantDias] = useState(3);
  const [modo, setModo] = useState<Modo>("dias");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const [eventos, setEventos] = useState<PlanEvento[]>([]);
  const [cola, setCola] = useState<ColaPlanificacion>(COLA_VACIA);
  const [empleados, setEmpleados] = useState<EmpleadoAsignable[]>([]);
  const [sinMarcar, setSinMarcar] = useState<PlanEvento[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [otAbierta, setOtAbierta] = useState<OtProduccionItem | null>(null);
  const [dialogEvento, setDialogEvento] = useState<{ evento: PlanEvento | null } | null>(null);
  const [sinMarcarAbierto, setSinMarcarAbierto] = useState(false);

  const diasVisibles = isMobile ? 1 : cantDias;
  const dias = useMemo(
    () => Array.from({ length: diasVisibles }, (_, i) => claveDia(addDays(parseISO(inicio), i))),
    [inicio, diasVisibles],
  );

  const { desde, hasta } = useMemo(() => {
    if (modo === "mes") return rangoGrillaMes(inicio);
    if (modo === "equipos") return { desde: inicio, hasta: inicio };
    return { desde: dias[0]!, hasta: dias[dias.length - 1]! };
  }, [modo, inicio, dias]);

  // Si se navega rápido, una respuesta vieja puede llegar después de la nueva: se descarta.
  const pedido = useRef(0);
  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const id = ++pedido.current;
    setLoading(true);
    const [evRes, colaRes, smRes] = await Promise.all([
      listarEventos({ desde, hasta }),
      listarCola(),
      listarEntregasSinMarcar(claveDia(new Date())),
    ]);
    if (id !== pedido.current) return;
    setLoading(false);
    if (evRes.error) toast.error(evRes.error.message);
    else setEventos(evRes.data);
    if (colaRes.error) toast.error(colaRes.error.message);
    else setCola(colaRes.data);
    if (smRes.error) toast.error(smRes.error.message);
    else setSinMarcar(smRes.data);
  }, [desde, hasta]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void listarEmpleadosAsignables().then((r) => {
      if (r.error) toast.error(r.error.message);
      else setEmpleados(r.data);
    });
  }, []);

  const eventosVisibles = useMemo(
    () => (filtro === "todos" ? eventos : eventos.filter((e) => e.tipo === filtro)),
    [eventos, filtro],
  );

  /** Corre una acción, muestra el error si lo hay y recarga. */
  const correr = async (id: string, fn: () => Promise<{ error: Error | null }>, ok?: string) => {
    setBusyId(id);
    const res = await fn();
    setBusyId(null);
    if (res.error) toast.error(res.error.message);
    else if (ok) toast.success(ok);
    await refresh();
  };

  /** Agenda lo que viene de la cola o mueve un evento. `empleadoId` solo en la vista Equipos. */
  const soltar = (p: PlanDragPayload, fecha: string, hora: string | null, equipo?: { empleadoId: string | null }) => {
    const horario = { fecha, horaDesde: hora };
    const empleadoIds = equipo?.empleadoId ? [equipo.empleadoId] : [];
    if (p.kind === "ots") {
      void correr(
        p.otIds[0] ?? "ots",
        () => agendarEntregas({ ...horario, otIds: p.otIds, empleadoIds, usuarioId }),
        p.otIds.length > 1 ? `${p.otIds.length} OTs agendadas.` : "Entrega agendada.",
      );
      return;
    }
    if (p.kind === "medicion") {
      void correr(
        p.medicionId,
        () => agendarMedicion({ ...horario, medicionId: p.medicionId, empleadoIds, usuarioId }),
        "Medición agendada.",
      );
      return;
    }
    void correr(p.eventoId, async () => {
      // A "Sin hora" borra el horario; a una franja, conserva la duración.
      const mov = await moverEvento({ eventoId: p.eventoId, fecha, horaDesde: hora, horaHasta: hora ? undefined : null });
      if (mov.error || !equipo || p.desdeEmpleadoId === undefined || p.desdeEmpleadoId === equipo.empleadoId) {
        return mov;
      }
      // Pasó de la columna de un empleado a la de otro: se cambia esa persona y quedan los demás.
      const ev = eventos.find((e) => e.id === p.eventoId);
      const ids = new Set(ev?.empleados.map((e) => e.id) ?? []);
      if (p.desdeEmpleadoId) ids.delete(p.desdeEmpleadoId);
      if (equipo.empleadoId) ids.add(equipo.empleadoId);
      else ids.clear();
      return asignarEmpleados(p.eventoId, [...ids]);
    });
  };

  const acciones = {
    busyId,
    onTildar: (ev: PlanEvento) =>
      void correr(
        ev.id,
        () => marcarEventoHecho({ eventoId: ev.id, usuarioId }),
        ev.tipo === "entrega" ? "OT marcada como entregada." : "Tarea hecha.",
      ),
    onReabrir: (ev: PlanEvento) => void correr(ev.id, () => reabrirTarea(ev.id)),
    onDesagendar: (ev: PlanEvento) => void correr(ev.id, () => desagendarEvento(ev.id), "Sacado del calendario."),
    onVer: (ev: PlanEvento) => {
      if (ev.tipo === "entrega" && ev.ot) setOtAbierta(ev.ot);
      else if (ev.tipo === "medicion") toast.info("Abrí Medición para confirmar las medidas de esta obra.");
    },
    onEditar: (ev: PlanEvento) => setDialogEvento({ evento: ev }),
  };

  const onSoltarEnCola = (eventoId: string) =>
    void correr(eventoId, () => desagendarEvento(eventoId), "Sacado del calendario.");

  const abrirDia = (fecha: string) => {
    setInicio(fecha);
    setModo("dias");
  };

  const mover = (n: number) =>
    setInicio((d) => {
      const base = parseISO(d);
      if (modo === "mes") return claveDia(addMonths(base, n));
      if (modo === "equipos") return claveDia(addDays(base, n));
      return claveDia(addDays(base, n * diasVisibles));
    });

  const rango = useMemo(() => {
    const ini = parseISO(inicio);
    if (modo === "mes") return capitalizar(format(ini, "MMMM yyyy", { locale: es }));
    if (modo === "equipos" || dias.length === 1) return capitalizar(format(ini, "EEEE d 'de' MMMM", { locale: es }));
    return `${format(parseISO(dias[0]!), "d MMM", { locale: es })} – ${format(parseISO(dias[dias.length - 1]!), "d MMM", { locale: es })}`;
  }, [modo, inicio, dias]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="space-y-3 border-b border-border bg-white px-4 py-3 sm:px-6 dark:bg-background">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 flex items-center gap-2 text-lg font-semibold" data-guia="modulo-titulo">
            <CalendarDays className="h-5 w-5" aria-hidden />
            Planificación
          </h1>
          <Segmentos
            ariaLabel="Qué mostrar"
            opciones={FILTROS.map((f) => ({ id: f.id, contenido: <>{f.icon}<span className="hidden sm:inline">{f.label}</span></> }))}
            valor={filtro}
            onChange={setFiltro}
          />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogEvento({ evento: null })} data-guia="accion-principal">
              <Plus className="mr-1 h-4 w-4" />
              Nueva tarea
            </Button>
            <Segmentos
              ariaLabel="Vista"
              opciones={MODOS.map((m) => ({ id: m.id, contenido: m.label }))}
              valor={modo}
              onChange={setModo}
            />
            {modo === "dias" && !isMobile ? (
              <div className="flex items-center rounded-lg border border-border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCantDias((n) => Math.max(1, n - 1))}
                  disabled={cantDias <= 1}
                  aria-label="Menos días"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-14 text-center text-sm tabular-nums">
                  {cantDias} día{cantDias === 1 ? "" : "s"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCantDias((n) => Math.min(7, n + 1))}
                  disabled={cantDias >= 7}
                  aria-label="Más días"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setInicio(hoy)} disabled={inicio === hoy}>
              Hoy
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => mover(-1)} aria-label="Anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[8.5rem] text-center text-sm font-semibold">{rango}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => mover(1)} aria-label="Siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {TIPOS_ENTREGA.map((t) => (
            <span key={t.value} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-sm", COLOR_TIPO_ENTREGA[t.value].punto)} aria-hidden />
              {t.label}
            </span>
          ))}
          {sinMarcar.length > 0 ? (
            <button
              type="button"
              onClick={() => setSinMarcarAbierto(true)}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1 text-sm font-medium text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
            >
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {sinMarcar.length} entrega{sinMarcar.length === 1 ? "" : "s"} sin marcar
            </button>
          ) : null}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4 md:flex-row md:overflow-hidden">
        <div className="h-80 shrink-0 md:h-auto md:w-80" data-guia="planificacion-cola">
          <PlanificacionCola
            cola={cola}
            loading={loading}
            hoy={hoy}
            mostrarEntregas={filtro === "todos" || filtro === "entrega"}
            mostrarMediciones={filtro === "todos" || filtro === "medicion"}
            onSoltarEvento={onSoltarEnCola}
            onVerOt={setOtAbierta}
          />
        </div>
        <div className="flex min-h-[32rem] min-w-0 flex-1 md:min-h-0">
          {modo === "dias" ? (
            <PlanificacionDias
              dias={dias}
              eventos={eventosVisibles}
              hoy={hoy}
              onSoltar={(p, fecha, hora) => soltar(p, fecha, hora)}
              {...acciones}
            />
          ) : modo === "equipos" ? (
            <PlanificacionEquipos
              eventos={eventosVisibles}
              empleados={empleados}
              onSoltar={(p, empleadoId, hora) => soltar(p, inicio, hora, { empleadoId })}
              {...acciones}
            />
          ) : (
            <PlanificacionMes
              mes={inicio}
              eventos={eventosVisibles}
              hoy={hoy}
              onAbrirDia={abrirDia}
              onEditar={acciones.onEditar}
              onSoltar={(p, fecha) => soltar(p, fecha, null)}
            />
          )}
        </div>
      </main>

      {otAbierta ? (
        <OtDetalleDialog
          item={otAbierta}
          open
          onOpenChange={(o) => {
            if (!o) setOtAbierta(null);
          }}
          onChanged={() => void refresh()}
        />
      ) : null}

      <EventoDialog
        open={dialogEvento !== null}
        onOpenChange={(o) => {
          if (!o) setDialogEvento(null);
        }}
        evento={dialogEvento?.evento ?? null}
        fechaInicial={inicio}
        empleados={empleados}
        usuarioId={usuarioId}
        onGuardado={() => void refresh()}
      />

      <SinMarcarDialog
        open={sinMarcarAbierto}
        onOpenChange={setSinMarcarAbierto}
        eventos={sinMarcar}
        busyId={busyId}
        onTildar={acciones.onTildar}
        onIrAlDia={(fecha) => {
          setSinMarcarAbierto(false);
          abrirDia(fecha);
        }}
      />
    </div>
  );
}

function Segmentos<T extends string>({
  ariaLabel,
  opciones,
  valor,
  onChange,
}: {
  ariaLabel: string;
  opciones: { id: T; contenido: React.ReactNode }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label={ariaLabel}>
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={valor === o.id}
          className={cn(
            "flex items-center gap-1.5 border-r border-border px-3 py-1.5 text-sm last:border-r-0",
            valor === o.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {o.contenido}
        </button>
      ))}
    </div>
  );
}
