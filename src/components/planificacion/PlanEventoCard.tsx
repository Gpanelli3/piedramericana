"use client";

import { CircleCheck, Eye, MapPin, Phone, Ruler, Truck, Undo2, Users, X, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { coalesceTipoEntrega, etiquetaTipoEntrega, motivoNoTildarEntrega } from "@/lib/planificacion-reglas";
import type { PlanEvento } from "@/lib/planificacion-api";
import { otTituloDisplay } from "@/components/produccion/ot-ui";
import {
  COLOR_MEDICION,
  COLOR_TAREA,
  COLOR_TIPO_ENTREGA,
  horaCorta,
  setDragPayload,
} from "@/components/planificacion/plan-ui";

type Props = {
  evento: PlanEvento;
  /** Versión corta para eventos de poca altura en la grilla. */
  compacta?: boolean;
  busy?: boolean;
  onTildar: (ev: PlanEvento) => void;
  onReabrir: (ev: PlanEvento) => void;
  onDesagendar: (ev: PlanEvento) => void;
  onVer: (ev: PlanEvento) => void;
  onEditar: (ev: PlanEvento) => void;
  /** Vista Equipos: empleado de la columna donde se dibuja la tarjeta. */
  empleadoColumnaId?: string | null;
  className?: string;
  style?: React.CSSProperties;
};

export function datosEvento(ev: PlanEvento) {
  if (ev.tipo === "entrega") {
    const tipo = coalesceTipoEntrega(ev.ot?.orden.tipo_entrega);
    return {
      etiqueta: etiquetaTipoEntrega(tipo),
      icono: <Truck className="h-3 w-3" aria-hidden />,
      color: COLOR_TIPO_ENTREGA[tipo],
      titulo: ev.ot?.cliente ?? "OT",
      linea: ev.ot ? `${ev.ot.presupuestoNumero} · ${otTituloDisplay(ev.ot)}` : "",
      sub: ev.ot?.materialLabel ?? "",
      direccion: ev.ot?.direccionObra && ev.ot.direccionObra !== "—" ? ev.ot.direccionObra : "",
      telefono: ev.ot?.telefono ?? "",
    };
  }
  if (ev.tipo === "medicion") {
    return {
      etiqueta: "Medición",
      icono: <Ruler className="h-3 w-3" aria-hidden />,
      color: COLOR_MEDICION,
      titulo: ev.medicion?.cliente ?? "Medición",
      linea: ev.medicion?.numero ?? "",
      sub: "",
      direccion:
        ev.medicion?.direccionObra && ev.medicion.direccionObra !== "—" ? ev.medicion.direccionObra : "",
      telefono: "",
    };
  }
  return {
    etiqueta: "Tarea",
    icono: <ClipboardList className="h-3 w-3" aria-hidden />,
    color: COLOR_TAREA,
    titulo: ev.titulo ?? "Tarea",
    linea: ev.notas ?? "",
    sub: "",
    direccion: ev.direccion ?? "",
    telefono: "",
  };
}

export function motivoNoTildar(ev: PlanEvento): string | null {
  if (ev.estado !== "pendiente") return null;
  if (ev.tipo === "medicion") return "Se marca hecha al confirmar las medidas en Medición.";
  if (ev.tipo === "entrega") {
    if (!ev.ot) return "No se encontró la OT.";
    return motivoNoTildarEntrega(ev.ot.orden);
  }
  return null;
}

export function PlanEventoCard({
  evento: ev,
  compacta,
  busy,
  onTildar,
  onReabrir,
  onDesagendar,
  onVer,
  onEditar,
  empleadoColumnaId,
  className,
  style,
}: Props) {
  const d = datosEvento(ev);
  const hecho = ev.estado === "hecho";
  const motivo = motivoNoTildar(ev);
  const horario = ev.hora_desde
    ? `${horaCorta(ev.hora_desde)}${ev.hora_hasta ? `–${horaCorta(ev.hora_hasta)}` : ""}`
    : "";

  return (
    <div
      draggable={!hecho}
      onDragStart={(e) =>
        setDragPayload(e, {
          kind: "evento",
          eventoId: ev.id,
          ...(empleadoColumnaId !== undefined ? { desdeEmpleadoId: empleadoColumnaId } : {}),
        })
      }
      onClick={() => onEditar(ev)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onEditar(ev);
      }}
      role="button"
      tabIndex={0}
      aria-label={`${d.etiqueta}: ${d.titulo}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-md border border-l-4 border-border bg-card px-2 py-1.5 text-left shadow-sm",
        d.color.borde,
        !hecho && "cursor-grab active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        hecho && "opacity-60",
        className,
      )}
      style={style}
    >
      <div className="flex items-center gap-1">
        <span className={cn("flex shrink-0 items-center gap-1 rounded border px-1 py-px text-[10px] font-semibold", d.color.chip)}>
          {d.icono}
          {compacta ? null : d.etiqueta}
        </span>
        {horario ? <span className="truncate text-[10px] font-semibold tabular-nums">{horario}</span> : null}
        <div className="ml-auto flex shrink-0 items-center">
          {hecho ? (
            ev.tipo === "tarea" ? (
              <BotonIcono label="Volver a pendiente" onClick={() => onReabrir(ev)} disabled={busy}>
                <Undo2 className="h-3.5 w-3.5" />
              </BotonIcono>
            ) : (
              <CircleCheck className="h-4 w-4 text-emerald-600" aria-label="Hecho" />
            )
          ) : (
            <>
              <BotonIcono
                label={motivo ?? "Marcar hecho"}
                onClick={() => onTildar(ev)}
                disabled={busy || motivo !== null}
              >
                <CircleCheck className="h-4 w-4" />
              </BotonIcono>
              {ev.tipo !== "tarea" ? (
                <BotonIcono label="Ver detalle" onClick={() => onVer(ev)} disabled={busy}>
                  <Eye className="h-3.5 w-3.5" />
                </BotonIcono>
              ) : null}
              <BotonIcono label="Sacar del calendario" onClick={() => onDesagendar(ev)} disabled={busy}>
                <X className="h-3.5 w-3.5" />
              </BotonIcono>
            </>
          )}
        </div>
      </div>
      <p className={cn("mt-0.5 truncate text-sm font-semibold leading-tight", hecho && "line-through")}>{d.titulo}</p>
      {!compacta ? (
        <>
          {d.linea ? <p className="truncate text-xs text-muted-foreground">{d.linea}</p> : null}
          {d.sub ? <p className="truncate text-xs text-muted-foreground">{d.sub}</p> : null}
          {d.direccion ? (
            <p className="mt-0.5 flex items-start gap-1 text-[11px] text-muted-foreground">
              <MapPin className="mt-px h-3 w-3 shrink-0" aria-hidden />
              <span className="line-clamp-2">{d.direccion}</span>
            </p>
          ) : null}
          {d.telefono ? (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" aria-hidden />
              {d.telefono}
            </p>
          ) : null}
          {ev.empleados.length > 0 ? (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Users className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{ev.empleados.map((e) => e.nombre).join(", ")}</span>
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function BotonIcono({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
