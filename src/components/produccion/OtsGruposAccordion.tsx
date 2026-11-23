"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { OtDetalleDialog } from "@/components/produccion/OtDetalleDialog";
import { chipClaseEtapaOt, etiquetaEtapaOt } from "@/lib/etiquetas-ot";
import { leerRetornoOt } from "@/lib/retorno-ot-dialog";
import type { OtProduccionItem, VentaGrupoOt } from "@/lib/produccion-api";
import type { JobStatus } from "@/types/database";
import { cn } from "@/lib/utils";
import { ChevronDown, MapPin, Phone, User } from "lucide-react";
import { OtTablaCabecera } from "@/components/produccion/OtListRow";

function chipEtapa(etapa: string | null, estado: JobStatus | null) {
  const key =
    estado === "done" ? "done" : estado === "cancelled" ? "cancelled" : etapa || "sin";
  return { key, className: chipClaseEtapaOt(etapa, estado) };
}

type Props = {
  grupos: VentaGrupoOt[];
  loading: boolean;
  emptyText: string;
  renderRow: (item: OtProduccionItem, ctx: { onVer: () => void; numero: number }) => ReactNode;
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
  const location = useLocation();
  const navigate = useNavigate();
  /** Ventas plegadas (por defecto todas abiertas, como una planilla). */
  const [cerradas, setCerradas] = useState<Set<string>>(new Set());
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [navIndex, setNavIndex] = useState(0);
  const allOts = grupos.flatMap((g) => g.ots);
  const reabrirOtId = leerRetornoOt(location.state)?.reabrirOtId ?? null;

  useEffect(() => {
    if (!reabrirOtId || allOts.length === 0) return;
    const idx = allOts.findIndex((o) => o.orden.id === reabrirOtId);
    if (idx < 0) return;
    setNavIndex(idx);
    setDetalleOpen(true);
    const grupo = grupos.find((g) => g.ots.some((o) => o.orden.id === reabrirOtId));
    if (grupo) {
      setCerradas((prev) => {
        if (!prev.has(grupo.ventaId)) return prev;
        const next = new Set(prev);
        next.delete(grupo.ventaId);
        return next;
      });
    }
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [reabrirOtId, grupos, navigate, location.pathname, location.search]);

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
          const open = !cerradas.has(g.ventaId);
          const cant = `${g.ots.length} ${g.ots.length === 1 ? "OT" : "OTs"}`;
          // Etapas con su cantidad de OTs (p. ej. "Producción 3 · Logística 1").
          const etapas = [
            ...g.ots
              .reduce((map, item) => {
                const estado = item.orden.estado as JobStatus;
                const chip = chipEtapa(item.orden.etapa, estado);
                const prev = map.get(chip.key);
                map.set(chip.key, {
                  key: chip.key,
                  label: etiquetaEtapaOt(String(item.orden.etapa), estado),
                  className: chip.className,
                  n: (prev?.n ?? 0) + 1,
                });
                return map;
              }, new Map<string, { key: string; label: string; className: string; n: number }>())
              .values(),
          ];
          const real = (s: string | null | undefined) => {
            const t = (s ?? "").trim();
            return t && t !== "—" && t !== "-" ? t : "";
          };
          const direccion = g.ots.map((o) => real(o.direccionObra)).find(Boolean) ?? "";
          const telefono = g.ots.map((o) => real(o.telefono)).find(Boolean) ?? "";
          const vendedor = g.ots.map((o) => real(o.vendedorLabel)).find(Boolean) ?? "";
          const m2Obra = g.ots.reduce((s, o) => s + (o.m2Obra > 0 ? o.m2Obra : o.m2Venta), 0);
          const hayAlerta = g.ots.some(
            (o) => o.orden.bloqueada || (o.orden.bacha_requerida && !o.orden.bacha_id),
          );
          return (
            <Collapsible
              key={g.ventaId}
              open={open}
              onOpenChange={(next) => {
                setCerradas((prev) => {
                  const s = new Set(prev);
                  if (next) s.delete(g.ventaId);
                  else s.add(g.ventaId);
                  return s;
                });
              }}
            >
              <div
                className={cn(
                  "overflow-hidden rounded-xl border border-border border-l-4 bg-card shadow-sm",
                  hayAlerta ? "border-l-rose-400" : "border-l-amber-500",
                )}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border/70 px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        !open && "-rotate-90",
                      )}
                    />
                    <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                      {g.presupuestoNumero}
                    </span>
                    <span className="min-w-0 max-w-[16rem] truncate text-sm font-semibold text-foreground">
                      {g.cliente}
                    </span>
                    {direccion ? (
                      <span className="flex min-w-0 max-w-[18rem] items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{direccion}</span>
                      </span>
                    ) : null}
                    {telefono ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" aria-hidden />
                        {telefono}
                      </span>
                    ) : null}
                    {vendedor ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3.5 w-3.5" aria-hidden />
                        {vendedor}
                      </span>
                    ) : null}
                    <span className="ml-auto flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground">
                        {cant}
                      </span>
                      {etapas.map((etapa) => (
                        <span
                          key={etapa.key}
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            etapa.className,
                          )}
                        >
                          {etapa.label}
                          {g.ots.length > 1 ? <span className="ml-1 tabular-nums">{etapa.n}</span> : null}
                        </span>
                      ))}
                      {m2Obra > 0 ? (
                        <span className="pl-1 text-xs tabular-nums text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {m2Obra.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>{" "}
                          m²
                        </span>
                      ) : null}
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="overflow-x-auto">
                    <div className="min-w-[60rem]">
                      <OtTablaCabecera />
                      {g.ots.map((item, i) =>
                        renderRow(item, {
                          numero: i + 1,
                          onVer: () => {
                            const idx = allOts.findIndex((o) => o.orden.id === item.orden.id);
                            setNavIndex(idx >= 0 ? idx : 0);
                            setDetalleOpen(true);
                          },
                        }),
                      )}
                    </div>
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
