"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { OtDetalleDialog } from "@/components/produccion/OtDetalleDialog";
import { etiquetaEtapaOt } from "@/lib/etiquetas-ot";
import type { OtProduccionItem, VentaGrupoOt } from "@/lib/produccion-api";
import type { JobStatus } from "@/types/database";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const ETAPA_CHIP: Record<string, string> = {
  medicion:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
  corte:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  produccion:
    "border-accent/50 bg-accent/20 text-foreground",
  despacho:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  done: "border-border bg-muted text-foreground",
  cancelled:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  sin: "border-border bg-muted text-muted-foreground",
};

function chipEtapa(etapa: string | null, estado: JobStatus | null) {
  if (estado === "done") return { key: "done", className: ETAPA_CHIP.done };
  if (estado === "cancelled") return { key: "cancelled", className: ETAPA_CHIP.cancelled };
  const key = etapa && etapa in ETAPA_CHIP ? etapa : "sin";
  return { key, className: ETAPA_CHIP[key] ?? ETAPA_CHIP.sin };
}

type Props = {
  grupos: VentaGrupoOt[];
  loading: boolean;
  emptyText: string;
  renderRow: (item: OtProduccionItem, ctx: { onVer: () => void }) => ReactNode;
  onChanged: () => void;
  permitirEntregar?: boolean;
};

export function OtsGruposAccordion({
  grupos,
  loading,
  emptyText,
  renderRow,
  onChanged,
  permitirEntregar = true,
}: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [navIndex, setNavIndex] = useState(0);
  const allOts = grupos.flatMap((g) => g.ots);

  if (loading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>;
  }
  if (grupos.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {grupos.map((g) => {
          const open = openIds.has(g.ventaId);
          const cant = `${g.ots.length} ${g.ots.length === 1 ? "OT" : "OTs"}`;
          const etapas = [
            ...new Map(
              g.ots.map((item) => {
                const estado = item.orden.estado as JobStatus;
                const label = etiquetaEtapaOt(String(item.orden.etapa), estado);
                const chip = chipEtapa(item.orden.etapa, estado);
                return [chip.key, { key: chip.key, label, className: chip.className }] as const;
              }),
            ).values(),
          ];
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
                      <p className="mt-1 flex flex-wrap items-center gap-1.5">
                        {etapas.map((etapa) => (
                          <Badge
                            key={etapa.key}
                            variant="outline"
                            className={cn(
                              "h-5 px-2 text-[11px] font-semibold",
                              etapa.className,
                            )}
                          >
                            {etapa.label}
                          </Badge>
                        ))}
                        <span className="text-xs text-muted-foreground">{cant}</span>
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {g.ots.length}
                    </Badge>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div>
                    {g.ots.map((item) =>
                      renderRow(item, {
                        onVer: () => {
                          const idx = allOts.findIndex((o) => o.orden.id === item.orden.id);
                          setNavIndex(idx >= 0 ? idx : 0);
                          setDetalleOpen(true);
                        },
                      }),
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
      <OtDetalleDialog
        item={allOts[navIndex] ?? null}
        open={detalleOpen}
        onOpenChange={setDetalleOpen}
        onChanged={onChanged}
        permitirEntregar={permitirEntregar}
        mostrarRotulo
        navItems={allOts}
        navIndex={navIndex}
        onNavChange={setNavIndex}
      />
    </>
  );
}
