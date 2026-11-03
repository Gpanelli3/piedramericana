"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, Radio, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportesKpiCard, ReportesWidgetShell } from "@/components/reportes/ReportesKpiCard";
import { ReportesConversionDonut } from "@/components/reportes/ReportesConversionDonut";
import { ReportesVelocidadEtapas } from "@/components/reportes/ReportesVelocidadEtapas";
import { ReportesPresupuestosPorDia } from "@/components/reportes/ReportesPresupuestosPorDia";
import { ReportesTopMateriales } from "@/components/reportes/ReportesTopMateriales";
import { useReportesLive } from "@/hooks/useReportesLive";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  REPORTES_PERIODO_LABELS,
  type ReportesPeriodo,
  type ReportesSearchHit,
} from "@/lib/reportes-api";
import { cn } from "@/lib/utils";

function formatUsd(n: number): string {
  return `U$D ${n.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatArs(n: number): string {
  return `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function formatM2(n: number): string {
  return `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })} m²`;
}

function fechaLargaHoy(): string {
  const s = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function segundosRelativos(ts: number | null): string {
  if (!ts) return "";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "ahora";
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  return `hace ${m} min`;
}

export function VistaReportes() {
  const [, setSearchParams] = useSearchParams();
  const [periodo, setPeriodo] = useState<ReportesPeriodo>("mes");
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);
  const { data, cargando, error, live, lastUpdatedAt } = useReportesLive(periodo);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || !data?.busquedaIndex) return [];
    return data.busquedaIndex
      .filter(
        (h) =>
          h.label.toLowerCase().includes(needle) ||
          h.sublabel.toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [q, data?.busquedaIndex]);

  const irAHit = (hit: ReportesSearchHit) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (hit.tipo === "ot") {
          n.set("ws", "produccion");
          n.set("ot", "general");
          n.delete("pv");
          n.delete("ft");
          n.delete("rid");
          n.delete("id");
        } else {
          n.set("ws", "ventas");
          n.set("pv", "list");
          n.set("ft", "todos");
          if (hit.presupuestoId) n.set("id", hit.presupuestoId);
          n.delete("ot");
        }
        return n;
      },
      { replace: false },
    );
    setQ("");
  };

  const resumen = data?.resumen;
  const periodoLabelCorto =
    periodo === "30d" ? "30d" : periodo === "90d" ? "90d" : REPORTES_PERIODO_LABELS[periodo];

  void tick;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#FBF7F2]">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-white/95 backdrop-blur">
        <div className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-3.5">
          <p className="shrink-0 text-sm font-medium capitalize text-foreground/80">
            {fechaLargaHoy()}
          </p>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar número, obra o cliente..."
              className="h-10 rounded-full border-border/70 bg-muted/40 pl-9 shadow-none"
            />
            {hits.length > 0 ? (
              <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-white py-1 shadow-lg">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted/60"
                      onClick={() => irAHit(h)}
                    >
                      <span className="font-medium">{h.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {h.tipo === "ot" ? "OT" : "Presupuesto"}
                        {h.sublabel ? ` · ${h.sublabel}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
              live ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground",
            )}
            title={live ? "Escuchando cambios en vivo" : "Reconectando…"}
          >
            <Radio className={cn("h-3.5 w-3.5", live && "animate-pulse")} />
            En vivo
            {lastUpdatedAt ? (
              <span className="font-normal opacity-70">· {segundosRelativos(lastUpdatedAt)}</span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="space-y-7 px-5 py-5 sm:px-6 sm:py-6">
        {!isSupabaseConfigured ? (
          <p className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
            Configurá Supabase para ver el reporte en vivo.
          </p>
        ) : (
          <>
            <section>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Resumen de hoy
                </h2>
              </div>
              {cargando && !data ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-[96px] rounded-2xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ReportesKpiCard
                    label="Cobrado este mes"
                    value={
                      resumen
                        ? resumen.cobradoMesUsd > 0 || resumen.cobradoMesArs === 0
                          ? formatUsd(resumen.cobradoMesUsd)
                          : formatArs(resumen.cobradoMesArs)
                        : "…"
                    }
                    hint={
                      resumen && resumen.cobradoMesArs > 0 && resumen.cobradoMesUsd > 0
                        ? `+ ${formatArs(resumen.cobradoMesArs)} ARS · ingresos del mes`
                        : "ingresos del mes"
                    }
                  />
                  <ReportesKpiCard
                    label="Por cobrar"
                    value={resumen ? formatUsd(resumen.porCobrarUsd) : "…"}
                    hint={
                      resumen
                        ? `${resumen.clientesConSaldo} cliente${resumen.clientesConSaldo === 1 ? "" : "s"}${
                            resumen.porCobrarArs > 0
                              ? ` · + ${formatArs(resumen.porCobrarArs)} ARS`
                              : ""
                          }`
                        : "…"
                    }
                  />
                  <ReportesKpiCard
                    label="Vencen en 7 días"
                    value={resumen ? String(resumen.vencen7d) : "…"}
                    hint="OTs con entrega cerca"
                  />
                  <ReportesKpiCard
                    label="Desperdicio del mes"
                    value={resumen ? `${resumen.desperdicioPct}%` : "…"}
                    hint={
                      resumen
                        ? `${formatM2(resumen.desperdicioM2Consumidos)} consumidos`
                        : "…"
                    }
                  />
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                  <BarChart3 className="h-4 w-4 text-[#C47A3A]" aria-hidden />
                  Análisis del negocio: ventas y estado del pipeline
                </h2>
                <Select value={periodo} onValueChange={(v) => setPeriodo(v as ReportesPeriodo)}>
                  <SelectTrigger className="h-9 w-[140px] rounded-full border-border/70 bg-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(REPORTES_PERIODO_LABELS) as ReportesPeriodo[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {REPORTES_PERIODO_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {cargando && !data ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-[220px] rounded-2xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <ReportesConversionDonut
                    data={data?.conversion ?? { pct: 0, aprobados: 0, total: 0 }}
                    periodoLabel={periodoLabelCorto}
                  />
                  <ReportesVelocidadEtapas data={data?.velocidadEtapas ?? []} />
                  <ReportesPresupuestosPorDia data={data?.presupuestosPorDia ?? []} />
                  <ReportesWidgetShell title="Ticket promedio">
                    <p className="pt-2 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
                      {data ? formatUsd(data.ticketPromedioUsd) : "…"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">por venta</p>
                  </ReportesWidgetShell>
                  <ReportesWidgetShell title="m² entregados">
                    <p className="pt-2 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
                      {data ? formatM2(data.m2Entregados) : "…"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      OTs entregadas / finalizadas en el período
                    </p>
                  </ReportesWidgetShell>
                  <ReportesTopMateriales data={data?.topMateriales ?? []} />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
