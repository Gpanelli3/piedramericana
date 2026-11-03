"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  Layers,
  ListChecks,
  Package,
  Wallet,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase";
import { fetchDashboardResumen, type DashboardResumen } from "@/lib/dashboard-api";
import type { WorkspaceTab } from "@/types/workspace";

function saludoSegunHora(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buen día";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

type KpiCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ReactNode;
  accent?: "default" | "warn" | "ok";
  onClick?: () => void;
};

function KpiCard({ label, value, hint, icon, accent = "default", onClick }: KpiCardProps) {
  const inner = (
    <CardContent className="flex gap-4 p-5">
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          accent === "warn" && "bg-warning-soft text-warning-strong",
          accent === "ok" && "bg-success-soft text-success-strong",
          accent === "default" && "bg-muted text-foreground/70",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {onClick ? <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40" /> : null}
    </CardContent>
  );

  if (onClick) {
    return (
      <Card
        className="cursor-pointer transition-shadow hover:shadow-md"
        onClick={onClick}
      >
        {inner}
      </Card>
    );
  }

  return <Card>{inner}</Card>;
}

export function VistaDashboard() {
  const [, setSearchParams] = useSearchParams();
  const [data, setData] = useState<DashboardResumen | null>(null);
  const [cargando, setCargando] = useState(true);

  const ir = useCallback(
    (tab: WorkspaceTab, extra?: Record<string, string>) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("ws", tab);
          if (tab !== "ventas") {
            n.delete("pv");
            n.delete("ft");
            n.delete("rid");
          }
          if (extra) {
            for (const [k, v] of Object.entries(extra)) n.set(k, v);
          }
          return n;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setData(null);
      setCargando(false);
      return;
    }
    setCargando(true);
    const res = await fetchDashboardResumen();
    if (res.error) {
      toast.error(res.error.message);
      setData(null);
    } else {
      setData(res.data);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const fechaHoy = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <header className="px-5 pt-6 pb-2 sm:px-6 sm:pt-6 sm:pb-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {saludoSegunHora()}
        </h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{fechaHoy}</p>
      </header>

      <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
        {!isSupabaseConfigured ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Configurá Supabase para ver el resumen del día.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Accesos rápidos</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-4">
                <Button variant="accent" className="h-12 justify-start gap-3" onClick={() => ir("ventas", { pv: "nuevo" })}>
                  <FilePlus2 className="h-4 w-4" />
                  Nuevo presupuesto
                </Button>
                <Button variant="outline" className="h-12 justify-start gap-3" onClick={() => ir("ventas", { pv: "list", ft: "pendientes" })}>
                  <ListChecks className="h-4 w-4" />
                  Ver pendientes
                </Button>
                <Button variant="outline" className="h-12 justify-start gap-3" onClick={() => ir("administracion")}>
                  <Wallet className="h-4 w-4" />
                  Cobros y ventas
                </Button>
                <Button variant="outline" className="h-12 justify-start gap-3" onClick={() => ir("stock")}>
                  <Package className="h-4 w-4" />
                  Stock
                </Button>
              </CardContent>
            </Card>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Operación</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="Presupuestos pendientes"
                  value={cargando ? "…" : String(data?.presupuestosPendientes ?? 0)}
                  hint="Esperando aprobación"
                  icon={<ClipboardList className="h-5 w-5" aria-hidden />}
                  onClick={() => ir("ventas", { pv: "list", ft: "pendientes" })}
                />
                <KpiCard
                  label="OTs activas"
                  value={cargando ? "…" : String(data?.otsActivas ?? 0)}
                  hint={
                    !cargando && data
                      ? `${data.otsEnMedicion} para medir · ${data.otsEnProduccion} en producción`
                      : undefined
                  }
                  icon={<Wrench className="h-5 w-5" aria-hidden />}
                  onClick={() => ir("produccion")}
                />
                <KpiCard
                  label="Ventas aprobadas"
                  value={cargando ? "…" : String(data?.presupuestosAprobados ?? 0)}
                  hint="Obras en curso comercial"
                  icon={<Layers className="h-5 w-5" aria-hidden />}
                  accent="ok"
                  onClick={() => ir("administracion")}
                />
                <KpiCard
                  label="Sin seña"
                  value={cargando ? "…" : String(data?.ventasSinSena ?? 0)}
                  hint="Aprobados sin cobro registrado"
                  icon={<AlertCircle className="h-5 w-5" aria-hidden />}
                  accent={!cargando && (data?.ventasSinSena ?? 0) > 0 ? "warn" : "default"}
                  onClick={() => ir("administracion")}
                />
              </div>
            </section>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    Próximas entregas (7 días)
                  </CardTitle>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => ir("produccion")}>
                    Ver producción
                  </Button>
                </CardHeader>
                <CardContent>
                  {cargando ? (
                    <p className="text-sm text-muted-foreground">Cargando…</p>
                  ) : !data?.proximasEntregas.length ? (
                    <p className="text-sm text-muted-foreground">
                      No hay OTs con fecha programada en los próximos 7 días.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {data.proximasEntregas.map((e) => (
                        <li
                          key={e.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{e.titulo}</p>
                            <p className="truncate text-xs text-muted-foreground">{e.cliente}</p>
                          </div>
                          <div className="shrink-0 text-right text-xs">
                            <p className="font-medium tabular-nums">{e.fecha}</p>
                            <p className="text-muted-foreground">{e.etapa}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
