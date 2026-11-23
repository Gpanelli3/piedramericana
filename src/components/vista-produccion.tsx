"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { OtListRow } from "@/components/produccion/OtListRow";
import { OtsGruposAccordion } from "@/components/produccion/OtsGruposAccordion";
import { tabProduccionDesdeOt } from "@/lib/clients-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getOtsAgrupadas,
  type OtProduccionItem,
  type VentaGrupoOt,
} from "@/lib/produccion-api";
import { cn } from "@/lib/utils";
import {
  PRODUCCION_OT_LABELS,
  type ProduccionOtFiltro,
} from "@/types/workspace";
import { Clock } from "lucide-react";
import type { JobStatus } from "@/types/database";

type FiltroGeneral = Exclude<ProduccionOtFiltro, "general">;

const FILTROS_GENERAL: {
  key: FiltroGeneral;
  className: string;
  numero: string;
  barra: string;
  activo: string;
}[] = [
  {
    key: "corte",
    className:
      "border-sky-300 bg-sky-50 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/50 dark:hover:bg-sky-950",
    numero: "text-sky-700 dark:text-sky-300",
    barra: "bg-sky-500",
    activo: "border-sky-500 ring-2 ring-sky-400/70 dark:border-sky-400 dark:ring-sky-500/60",
  },
  {
    key: "produccion",
    className:
      "border-orange-300 bg-orange-50 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/50 dark:hover:bg-orange-950",
    numero: "text-orange-700 dark:text-orange-300",
    barra: "bg-orange-500",
    activo: "border-orange-500 ring-2 ring-orange-400/70 dark:border-orange-400 dark:ring-orange-500/60",
  },
  {
    key: "logistica",
    className:
      "border-violet-300 bg-violet-50 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:hover:bg-violet-950",
    numero: "text-violet-700 dark:text-violet-300",
    barra: "bg-violet-500",
    activo: "border-violet-500 ring-2 ring-violet-400/70 dark:border-violet-400 dark:ring-violet-500/60",
  },
  {
    key: "entregadas",
    className:
      "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-950",
    numero: "text-emerald-700 dark:text-emerald-300",
    barra: "bg-emerald-500",
    activo: "border-emerald-500 ring-2 ring-emerald-400/70 dark:border-emerald-400 dark:ring-emerald-500/60",
  },
  {
    key: "venta_retenida",
    className:
      "border-rose-300 bg-rose-50 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:hover:bg-rose-950",
    numero: "text-rose-700 dark:text-rose-400",
    barra: "bg-rose-500",
    activo: "border-rose-500 ring-2 ring-rose-400/70 dark:border-rose-400 dark:ring-rose-500/60",
  },
];

function bucketOt(item: OtProduccionItem): ProduccionOtFiltro {
  return tabProduccionDesdeOt({
    estado: item.orden.estado as JobStatus,
    etapa: String(item.orden.etapa),
    bloqueada: Boolean(item.orden.bloqueada),
    pausada: Boolean(item.orden.pausada),
  });
}

export function VistaProduccion() {
  const [grupos, setGrupos] = useState<VentaGrupoOt[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<FiltroGeneral | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setGrupos([]);
      return;
    }
    setLoading(true);
    const { data, error } = await getOtsAgrupadas();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      setGrupos([]);
      return;
    }
    setGrupos(data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalOts = grupos.reduce((acc, g) => acc + g.ots.length, 0);

  const conteos = useMemo(() => {
    const acc: Record<FiltroGeneral, number> = {
      venta_retenida: 0,
      corte: 0,
      produccion: 0,
      logistica: 0,
      entregadas: 0,
    };
    for (const g of grupos) {
      for (const item of g.ots) {
        const bucket = bucketOt(item);
        if (bucket in acc) acc[bucket as FiltroGeneral] += 1;
      }
    }
    return acc;
  }, [grupos]);

  const gruposFiltrados = useMemo(() => {
    if (!filtro) return grupos;
    return grupos
      .map((g) => ({ ...g, ots: g.ots.filter((item) => bucketOt(item) === filtro) }))
      .filter((g) => g.ots.length > 0);
  }, [grupos, filtro]);

  const ventasVisibles = gruposFiltrados.length;
  const otsVisibles = gruposFiltrados.reduce((acc, g) => acc + g.ots.length, 0);

  const hoyFmt = new Date().toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white px-5 py-4 sm:px-6 dark:bg-background">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-bold text-foreground" data-guia="modulo-titulo">Órdenes de Trabajo</h1>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="capitalize">{hoyFmt}</span>
            </div>
            <Badge variant="outline" className="text-sm font-medium">
              {ventasVisibles} ventas · {otsVisibles} OTs
            </Badge>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-guia="produccion-etapas">
          <button
            type="button"
            aria-pressed={filtro === null}
            onClick={() => setFiltro(null)}
            className={cn(
              "relative overflow-hidden rounded-xl border border-border bg-white px-3 py-2.5 pl-4 text-left transition-colors hover:bg-muted/40 dark:bg-background",
              filtro === null && "border-foreground/40 ring-2 ring-foreground/15",
            )}
          >
            <span className="absolute inset-y-0 left-0 w-1.5 bg-foreground/45" aria-hidden />
            <p className="truncate text-xs font-semibold text-foreground">General</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-foreground">
              {totalOts}
            </p>
          </button>
          {FILTROS_GENERAL.map((f) => {
            const activo = filtro === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={activo}
                onClick={() => setFiltro(f.key)}
                className={cn(
                  "relative overflow-hidden rounded-xl border px-3 py-2.5 pl-4 text-left transition-colors",
                  f.className,
                  activo && f.activo,
                )}
              >
                <span className={cn("absolute inset-y-0 left-0 w-1.5", f.barra)} aria-hidden />
                <p className="truncate text-xs font-semibold text-foreground">
                  {PRODUCCION_OT_LABELS[f.key]}
                </p>
                <p className={cn("mt-0.5 text-2xl font-bold tabular-nums leading-none", f.numero)}>
                  {conteos[f.key]}
                </p>
              </button>
            );
          })}
        </div>
        <OtsGruposAccordion
          grupos={gruposFiltrados}
          loading={loading}
          emptyText={
            filtro
              ? `No hay OTs en ${PRODUCCION_OT_LABELS[filtro].toLowerCase()}.`
              : "No hay órdenes de trabajo confirmadas. Aparecen acá cuando se confirman las medidas en Medición."
          }
          onChanged={() => void refresh()}
          renderRow={(item, { onVer }) => (
            <OtListRow
              key={item.orden.id}
              item={item}
              onVer={onVer}
              primaryAction={{
                label: "Abrir",
                onClick: onVer,
              }}
            />
          )}
        />
      </main>
    </div>
  );
}
