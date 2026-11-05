"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { OtListRow } from "@/components/produccion/OtListRow";
import { OtsGruposAccordion } from "@/components/produccion/OtsGruposAccordion";
import { tabProduccionDesdeOt } from "@/lib/clients-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  avanzarEtapaOt,
  coalesceEtapaOt,
  getOtsAgrupadas,
  marcarOtEntregada,
  siguienteEtapaOt,
  type OtProduccionItem,
  type VentaGrupoOt,
} from "@/lib/produccion-api";
import { frenaAvancePorBacha } from "@/lib/bacha-reglas";
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
  activo: string;
}[] = [
  {
    key: "venta_retenida",
    className:
      "border-red-200 bg-red-50 hover:bg-red-100/80 dark:border-red-900 dark:bg-red-950/50 dark:hover:bg-red-950",
    numero: "text-red-600 dark:text-red-400",
    activo: "border-orange-400 ring-1 ring-orange-400 dark:border-orange-500 dark:ring-orange-500",
  },
  {
    key: "tecnica",
    className:
      "border-sky-200 bg-sky-50 hover:bg-sky-100/80 dark:border-sky-800 dark:bg-sky-950/50 dark:hover:bg-sky-950",
    numero: "text-sky-800 dark:text-sky-300",
    activo: "border-sky-500 ring-1 ring-sky-500 dark:border-sky-400 dark:ring-sky-400",
  },
  {
    key: "produccion",
    className:
      "border-amber-200/80 bg-amber-50 hover:bg-amber-100/70 dark:border-amber-900 dark:bg-amber-950/40 dark:hover:bg-amber-950",
    numero: "text-amber-900 dark:text-amber-200",
    activo: "border-amber-500 ring-1 ring-amber-500 dark:border-amber-400 dark:ring-amber-400",
  },
  {
    key: "logistica",
    className:
      "border-yellow-200 bg-yellow-50 hover:bg-yellow-100/80 dark:border-yellow-900 dark:bg-yellow-950/40 dark:hover:bg-yellow-950",
    numero: "text-yellow-800 dark:text-yellow-200",
    activo: "border-yellow-500 ring-1 ring-yellow-500 dark:border-yellow-400 dark:ring-yellow-400",
  },
  {
    key: "entregadas",
    className:
      "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80 dark:border-emerald-900 dark:bg-emerald-950/40 dark:hover:bg-emerald-950",
    numero: "text-emerald-700 dark:text-emerald-300",
    activo: "border-emerald-500 ring-1 ring-emerald-500 dark:border-emerald-400 dark:ring-emerald-400",
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
  const [busyId, setBusyId] = useState<string | null>(null);
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
      tecnica: 0,
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

  const hoyFmt = new Date().toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const onAvanzar = async (item: OtProduccionItem) => {
    setBusyId(item.orden.id);
    const res = await avanzarEtapaOt(item.orden.id);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Etapa avanzada.");
    await refresh();
  };

  const onEntregar = async (item: OtProduccionItem) => {
    setBusyId(item.orden.id);
    const res = await marcarOtEntregada(item.orden.id);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("OT marcada como entregada.");
    await refresh();
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white px-5 py-4 sm:px-6 dark:bg-background">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Órdenes de Trabajo · General</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Todas las ventas con OT, agrupadas (incluye entregadas)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="capitalize">{hoyFmt}</span>
            </div>
            <Badge variant="outline" className="text-sm font-medium">
              {grupos.length} ventas · {totalOts} OTs
            </Badge>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {FILTROS_GENERAL.map((f) => {
            const activo = filtro === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={activo}
                onClick={() => setFiltro((prev) => (prev === f.key ? null : f.key))}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-colors",
                  f.className,
                  activo && f.activo,
                )}
              >
                <p className="truncate text-xs font-medium text-foreground/80">
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
              : "No hay órdenes de trabajo. Se generan cuando registrás la primera seña sobre un presupuesto aprobado en Ventas."
          }
          onChanged={() => void refresh()}
          renderRow={(item, { onVer }) => (
            <OtListRow
              key={item.orden.id}
              item={item}
              onVer={onVer}
              primaryAction={
                item.orden.estado === "done"
                  ? undefined
                  : coalesceEtapaOt(item.orden.etapa) === "despacho"
                    ? {
                        label: "Entregar",
                        disabled:
                          busyId === item.orden.id ||
                          Boolean(item.orden.bloqueada) ||
                          Boolean(item.orden.pausada),
                        onClick: () => void onEntregar(item),
                      }
                    : {
                        label: "Avanzar",
                        disabled:
                          busyId === item.orden.id ||
                          Boolean(item.orden.bloqueada) ||
                          Boolean(item.orden.pausada) ||
                          frenaAvancePorBacha({
                            bachaRequerida: Boolean(item.orden.bacha_requerida),
                            bachaAsignada: Boolean(item.orden.bacha_id),
                            nextEtapa: siguienteEtapaOt(coalesceEtapaOt(item.orden.etapa)),
                          }),
                        onClick: () => void onAvanzar(item),
                      }
              }
            />
          )}
        />
      </main>
    </div>
  );
}
