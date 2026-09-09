"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { OtDetalleDialog } from "@/components/produccion/OtDetalleDialog";
import { OtListRow } from "@/components/produccion/OtListRow";
import { etiquetaVentaEstado } from "@/components/produccion/ot-ui";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  avanzarEtapaOt,
  getOtsAgrupadas,
  type OtProduccionItem,
  type VentaGrupoOt,
} from "@/lib/produccion-api";
import { cn } from "@/lib/utils";
import { ChevronDown, Clock } from "lucide-react";

export function VistaProduccion() {
  const [grupos, setGrupos] = useState<VentaGrupoOt[]>([]);
  const [loading, setLoading] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [navIndex, setNavIndex] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    setOpenIds((prev) => {
      if (prev.size > 0) return prev;
      return new Set(data.slice(0, 5).map((g) => g.ventaId));
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalOts = grupos.reduce((acc, g) => acc + g.ots.length, 0);

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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white px-6 py-4 sm:px-8 dark:bg-background">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Producción · General</h1>
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

      <main className="space-y-3 p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Cargando órdenes de trabajo…
          </div>
        ) : grupos.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm leading-relaxed text-muted-foreground">
            No hay órdenes de trabajo. Se generan cuando registrás la primera seña sobre un
            presupuesto aprobado en Ventas.
          </div>
        ) : (
          grupos.map((g) => {
            const open = openIds.has(g.ventaId);
            return (
              <Collapsible
                key={g.ventaId}
                open={open}
                onOpenChange={(next) => {
                  setOpenIds((prev) => {
                    const s = new Set(prev);
                    if (next) s.add(g.ventaId);
                    else s.delete(g.ventaId);
                    return s;
                  });
                }}
              >
                <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 border-b border-border/80 bg-muted/30 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          open && "rotate-180",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          Venta · {g.presupuestoNumero}
                          <span className="mx-1.5 font-normal text-muted-foreground">·</span>
                          {g.cliente}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {etiquetaVentaEstado(g.ventaEstado)} · {g.ots.length} OT
                          {g.ots.length === 1 ? "" : "s"}
                          <span className="mx-1.5 text-border">·</span>
                          <span className="tabular-nums">
                            Cot. {g.m2Venta.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} · Obra{" "}
                            {g.m2Obra.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                          </span>
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {g.ots.length}
                      </Badge>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div>
                      {g.ots.map((item) => {
                        const allOts = grupos.flatMap((gr) => gr.ots);
                        const idx = allOts.findIndex((o) => o.orden.id === item.orden.id);
                        return (
                          <OtListRow
                            key={item.orden.id}
                            item={item}
                            onVer={() => {
                              setNavIndex(idx);
                              setDetalleOpen(true);
                            }}
                            primaryAction={
                              item.orden.estado === "done"
                                ? undefined
                                : {
                                    label: "Avanzar",
                                    disabled:
                                      busyId === item.orden.id ||
                                      Boolean(item.orden.bloqueada) ||
                                      Boolean(item.orden.pausada) ||
                                      item.orden.etapa === "despacho",
                                    onClick: () => void onAvanzar(item),
                                  }
                            }
                          />
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })
        )}
      </main>

      {(() => {
        const allOts = grupos.flatMap((g) => g.ots);
        return (
          <OtDetalleDialog
            item={allOts[navIndex] ?? null}
            open={detalleOpen}
            onOpenChange={setDetalleOpen}
            onChanged={() => void refresh()}
            navItems={allOts}
            navIndex={navIndex}
            onNavChange={setNavIndex}
          />
        );
      })()}
    </div>
  );
}
