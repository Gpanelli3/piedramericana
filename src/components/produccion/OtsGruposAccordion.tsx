"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { OtDetalleDialog } from "@/components/produccion/OtDetalleDialog";
import { etiquetaVentaEstado, resumenMetrosGrupo } from "@/components/produccion/ot-ui";
import type { OtProduccionItem, VentaGrupoOt } from "@/lib/produccion-api";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

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
                        {etiquetaVentaEstado(g.ventaEstado)} · {cant}
                        <span className="mx-1.5 text-border">·</span>
                        <span className="tabular-nums">{resumenMetrosGrupo(g.m2Venta, g.m2Obra)}</span>
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
        navItems={allOts}
        navIndex={navIndex}
        onNavChange={setNavIndex}
      />
    </>
  );
}
