"use client";

import { useMemo, useState, type DragEvent } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, GripVertical, Inbox, MapPin, Phone, Ruler, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { chipClaseEtapaOt, etiquetaEtapaOt } from "@/lib/etiquetas-ot";
import { avisoPromesa, coalesceTipoEntrega, diaDesdeIso, etiquetaTipoEntrega } from "@/lib/planificacion-reglas";
import type { ColaPlanificacion } from "@/lib/planificacion-api";
import type { OtProduccionItem, VentaGrupoOt } from "@/lib/produccion-api";
import type { MedicionColaItem } from "@/lib/medicion-api";
import { otTituloDisplay } from "@/components/produccion/ot-ui";
import {
  COLOR_MEDICION,
  COLOR_TIPO_ENTREGA,
  esDragPlan,
  getDragPayload,
  setDragPayload,
  type PlanDragPayload,
} from "@/components/planificacion/plan-ui";

type Orden = "antiguedad" | "promesa";

type Props = {
  cola: ColaPlanificacion;
  loading: boolean;
  hoy: string;
  mostrarEntregas: boolean;
  mostrarMediciones: boolean;
  /** Soltar un evento agendado sobre la cola lo desagenda. */
  onSoltarEvento: (eventoId: string) => void;
  onVerOt: (item: OtProduccionItem) => void;
};

function textoBusqueda(item: OtProduccionItem): string {
  return [
    item.cliente,
    item.presupuestoNumero,
    item.orden.titulo,
    item.materialLabel,
    item.direccionObra,
  ]
    .join(" ")
    .toLowerCase();
}

function promesaDeGrupo(g: VentaGrupoOt): string {
  const fechas = g.ots
    .map((o) => diaDesdeIso(o.orden.fecha_programada))
    .filter((f): f is string => Boolean(f))
    .sort();
  return fechas[0] ?? "9999-99-99";
}

export function PlanificacionCola({
  cola,
  loading,
  hoy,
  mostrarEntregas,
  mostrarMediciones,
  onSoltarEvento,
  onVerOt,
}: Props) {
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState<Orden>("antiguedad");
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [dropActivo, setDropActivo] = useState(false);

  const busq = q.trim().toLowerCase();

  const grupos = useMemo(() => {
    if (!mostrarEntregas) return [];
    const filtrados = cola.grupos
      .map((g) => ({ ...g, ots: busq ? g.ots.filter((o) => textoBusqueda(o).includes(busq)) : g.ots }))
      .filter((g) => g.ots.length > 0);
    const conClave = filtrados.map((g) => ({
      g,
      antig: g.ots.reduce((min, o) => (o.orden.creado_en < min ? o.orden.creado_en : min), g.ots[0]!.orden.creado_en),
      prom: promesaDeGrupo(g),
    }));
    conClave.sort((a, b) => (orden === "promesa" ? a.prom.localeCompare(b.prom) : a.antig.localeCompare(b.antig)));
    return conClave.map((x) => x.g);
  }, [cola.grupos, busq, orden, mostrarEntregas]);

  const mediciones = useMemo(() => {
    if (!mostrarMediciones) return [];
    if (!busq) return cola.mediciones;
    return cola.mediciones.filter((m) =>
      [m.cliente, m.numero, m.direccionObra].join(" ").toLowerCase().includes(busq),
    );
  }, [cola.mediciones, busq, mostrarMediciones]);

  const total = grupos.reduce((acc, g) => acc + g.ots.length, 0) + mediciones.length;

  const toggle = (id: string) =>
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const onDragOver = (e: DragEvent) => {
    if (!esDragPlan(e)) return;
    e.preventDefault();
    setDropActivo(true);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDropActivo(false);
    const p = getDragPayload(e);
    if (p?.kind === "evento") onSoltarEvento(p.eventoId);
  };

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card transition-colors",
        dropActivo && "border-primary bg-primary/5",
      )}
      onDragOver={onDragOver}
      onDragLeave={() => setDropActivo(false)}
      onDrop={onDrop}
      aria-label="Trabajos por agendar"
    >
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
            <Inbox className="h-4 w-4" aria-hidden />
            Por agendar
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">{total}</span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar obra, OT o cliente…"
            className="h-9 pl-8 text-sm"
            aria-label="Buscar en la cola"
          />
        </div>
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Ordenar la cola"
        >
          <option value="antiguedad">Antigüedad en la cola</option>
          <option value="promesa">Fecha prometida</option>
        </select>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Arrastrá la cabecera para agendar toda la venta. Soltá acá un trabajo agendado para sacarlo del calendario.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {loading && total === 0 ? (
          <p className="p-3 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : null}
        {!loading && total === 0 ? (
          <p className="p-3 text-center text-sm text-muted-foreground">
            {busq ? "No hay resultados." : "No queda nada por agendar."}
          </p>
        ) : null}

        {mediciones.map((m) => (
          <TarjetaMedicion key={m.medicion.id} item={m} />
        ))}

        {grupos.map((g) => {
          const abierto = abiertos.has(g.ventaId) || busq.length > 0;
          return (
            <div key={g.ventaId} className="overflow-hidden rounded-lg border border-border bg-background">
              <div
                draggable
                onDragStart={(e) => setDragPayload(e, { kind: "ots", otIds: g.ots.map((o) => o.orden.id) })}
                className="flex cursor-grab items-center gap-1.5 bg-muted/60 px-2 py-1.5 active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <button
                  type="button"
                  onClick={() => toggle(g.ventaId)}
                  className="flex min-w-0 flex-1 items-center gap-1 text-left"
                  aria-expanded={abierto}
                >
                  {abierto ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="truncate text-sm font-semibold">{g.cliente}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {g.presupuestoNumero} · {g.ots.length} OT{g.ots.length === 1 ? "" : "s"}
                  </span>
                </button>
              </div>
              {abierto ? (
                <div className="divide-y divide-border">
                  {g.ots.map((o) => (
                    <TarjetaOt key={o.orden.id} item={o} hoy={hoy} onVer={() => onVerOt(o)} />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function TarjetaOt({ item, hoy, onVer }: { item: OtProduccionItem; hoy: string; onVer: () => void }) {
  const tipo = coalesceTipoEntrega(item.orden.tipo_entrega);
  const aviso = avisoPromesa({ fechaPrometida: item.orden.fecha_programada, etapa: item.orden.etapa, hoy });
  const payload: PlanDragPayload = { kind: "ots", otIds: [item.orden.id] };
  return (
    <div
      draggable
      onDragStart={(e) => setDragPayload(e, payload)}
      className={cn("cursor-grab border-l-4 px-2.5 py-2 active:cursor-grabbing", COLOR_TIPO_ENTREGA[tipo].borde)}
    >
      {aviso ? (
        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-rose-700 dark:text-rose-300">
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
          {aviso}
        </p>
      ) : null}
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px] font-semibold",
            chipClaseEtapaOt(item.orden.etapa, item.orden.estado),
          )}
        >
          {etiquetaEtapaOt(item.orden.etapa, item.orden.estado)}
        </span>
        <button
          type="button"
          onClick={onVer}
          className="min-w-0 truncate text-left text-sm font-semibold hover:underline"
        >
          {otTituloDisplay(item)}
        </button>
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">{item.m2Display}</span>
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.materialLabel}</p>
      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", COLOR_TIPO_ENTREGA[tipo].punto)} aria-hidden />
        {etiquetaTipoEntrega(tipo)}
      </p>
      {item.direccionObra !== "—" ? (
        <p className="mt-0.5 flex items-start gap-1 text-[11px] text-muted-foreground">
          <MapPin className="mt-px h-3 w-3 shrink-0" aria-hidden />
          <span className="line-clamp-2">{item.direccionObra}</span>
        </p>
      ) : null}
      {item.telefono ? (
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" aria-hidden />
          {item.telefono}
        </p>
      ) : null}
    </div>
  );
}

function TarjetaMedicion({ item }: { item: MedicionColaItem }) {
  return (
    <div
      draggable
      onDragStart={(e) => setDragPayload(e, { kind: "medicion", medicionId: item.medicion.id })}
      className={cn(
        "cursor-grab rounded-lg border border-l-4 border-border bg-background px-2.5 py-2 active:cursor-grabbing",
        COLOR_MEDICION.borde,
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold", COLOR_MEDICION.chip)}>
          <Ruler className="h-3 w-3" aria-hidden />
          Medición
        </span>
        <span className="min-w-0 truncate text-sm font-semibold">{item.cliente}</span>
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{item.numero}</span>
      </div>
      {item.direccionObra !== "—" ? (
        <p className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
          <MapPin className="mt-px h-3 w-3 shrink-0" aria-hidden />
          <span className="line-clamp-2">{item.direccionObra}</span>
        </p>
      ) : null}
    </div>
  );
}
