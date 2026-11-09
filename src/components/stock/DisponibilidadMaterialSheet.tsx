"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OtDetalleDialog } from "@/components/produccion/OtDetalleDialog";
import {
  esChapaRetazo,
  fetchOtTitulosByIds,
  fetchScrapsByMaterialLabel,
  fetchSlabsByMaterialLabel,
  type StockScrapRow,
} from "@/lib/stock-api";
import { fetchPlanCortePorOtIds } from "@/lib/plan-corte-stock";
import { getOtProduccionById, type OtProduccionItem } from "@/lib/produccion-api";
import type { ChapaRow } from "@/contexts/StockContext";
import type { PlanCorte } from "@/lib/plan-corte";
import { PlanCorteCroquis } from "@/components/presupuesto/PlanCorteCroquis";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

function m2(largoCm: number, anchoCm: number): number {
  return (largoCm / 100) * (anchoCm / 100);
}

function formatM2(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function estadoBadgeClass(estado: ChapaRow["estado"]): string {
  if (estado === "Disponible") {
    return "border border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800";
  }
  if (estado === "Reservada") {
    return "border border-amber-200 bg-amber-50 text-[10px] text-amber-900";
  }
  if (estado === "Prevista") {
    return "border border-sky-200 bg-sky-50 text-[10px] text-sky-800";
  }
  if (estado === "Usada") {
    return "border border-slate-200 bg-slate-100 text-[10px] text-slate-700";
  }
  if (estado === "Bloqueada") {
    return "border border-amber-200 bg-amber-50 text-[10px] text-amber-900";
  }
  return "border border-red-200 bg-red-50 text-[10px] text-red-800";
}

type FiltroPlancha = "todas" | "disponibles" | "reservadas" | "con_sobrante";

type NodoPlancha = {
  chapa: ChapaRow;
  hijos: ChapaRow[];
};

type DisponibilidadMaterialSheetProps = {
  materialLabel: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapasLocales: ChapaRow[];
};

function armarArbol(slabs: ChapaRow[]): { raices: NodoPlancha[]; sueltos: ChapaRow[] } {
  const byId = new Map(slabs.filter((c) => c.id).map((c) => [c.id!, c]));
  const hijosPorOrigen = new Map<string, ChapaRow[]>();
  const sueltos: ChapaRow[] = [];
  for (const c of slabs) {
    const origen = c.chapaOrigenId;
    if (!origen) continue;
    if (!byId.has(origen)) {
      sueltos.push(c);
      continue;
    }
    const arr = hijosPorOrigen.get(origen) ?? [];
    arr.push(c);
    hijosPorOrigen.set(origen, arr);
  }
  const raices: NodoPlancha[] = slabs
    .filter((c) => !c.chapaOrigenId)
    .map((c) => ({
      chapa: c,
      hijos: hijosPorOrigen.get(c.id ?? "") ?? [],
    }));
  return { raices, sueltos };
}

export function DisponibilidadMaterialSheet({
  materialLabel,
  open,
  onOpenChange,
  chapasLocales,
}: DisponibilidadMaterialSheetProps) {
  const [slabs, setSlabs] = useState<ChapaRow[]>([]);
  const [scraps, setScraps] = useState<StockScrapRow[]>([]);
  const [otTitulos, setOtTitulos] = useState<Map<string, string>>(new Map());
  const [planes, setPlanes] = useState<Map<string, PlanCorte>>(new Map());
  const [loading, setLoading] = useState(false);
  const [otDetalle, setOtDetalle] = useState<OtProduccionItem | null>(null);
  const [otDetalleOpen, setOtDetalleOpen] = useState(false);
  const [abriendoOtId, setAbriendoOtId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroPlancha>("todas");

  const recargarChapas = useCallback(async () => {
    if (!materialLabel) return;
    try {
      const s = await fetchSlabsByMaterialLabel(materialLabel);
      const remote = s.length > 0 ? s : chapasLocales.filter((c) => c.material === materialLabel);
      const titulos = await fetchOtTitulosByIds(
        remote.map((c) => c.otReservaId).filter((id): id is string => Boolean(id)),
      );
      const planesOt = await fetchPlanCortePorOtIds(
        remote.map((c) => c.otReservaId).filter((id): id is string => Boolean(id)),
      );
      setSlabs(remote);
      setOtTitulos(titulos);
      setPlanes(planesOt);
    } catch {
      setSlabs(chapasLocales.filter((c) => c.material === materialLabel));
    }
  }, [materialLabel, chapasLocales]);

  const abrirOt = async (otId: string) => {
    if (abriendoOtId) return;
    setAbriendoOtId(otId);
    const { data, error } = await getOtProduccionById(otId);
    setAbriendoOtId(null);
    if (error || !data) {
      toast.error(error?.message ?? "No se pudo abrir la OT.");
      return;
    }
    setOtDetalle(data);
    setOtDetalleOpen(true);
  };

  useEffect(() => {
    if (!open || !materialLabel) return;
    let cancel = false;
    setLoading(true);
    void (async () => {
      try {
        const s = await fetchSlabsByMaterialLabel(materialLabel);
        const sc = await fetchScrapsByMaterialLabel(materialLabel);
        const remote = s.length > 0 ? s : chapasLocales.filter((c) => c.material === materialLabel);
        const otIds = remote.map((c) => c.otReservaId).filter((id): id is string => Boolean(id));
        const [titulos, planesOt] = await Promise.all([
          fetchOtTitulosByIds(otIds),
          fetchPlanCortePorOtIds(otIds),
        ]);
        if (!cancel) {
          setSlabs(remote);
          setScraps(sc);
          setOtTitulos(titulos);
          setPlanes(planesOt);
        }
      } catch {
        if (!cancel) {
          setSlabs(chapasLocales.filter((c) => c.material === materialLabel));
          setScraps([]);
          setOtTitulos(new Map());
          setPlanes(new Map());
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, materialLabel, chapasLocales]);

  const { raices, sueltos } = useMemo(() => armarArbol(slabs), [slabs]);

  const enterasDisp = raices.filter(
    (n) => n.chapa.estado === "Disponible" && !esChapaRetazo(n.chapa),
  );
  const retazosDisp = slabs.filter((c) => c.estado === "Disponible" && esChapaRetazo(c));
  const previstos = slabs.filter((c) => c.estado === "Prevista");
  const reservadas = slabs.filter((c) => c.estado === "Reservada" && !c.chapaOrigenId);

  const raicesFiltradas = raices.filter((n) => {
    if (filtro === "disponibles") return n.chapa.estado === "Disponible";
    if (filtro === "reservadas") return n.chapa.estado === "Reservada";
    if (filtro === "con_sobrante") return n.hijos.length > 0;
    return n.chapa.estado !== "Baja";
  });

  if (!materialLabel) return null;

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Disponibilidad del material</SheetTitle>
          <SheetDescription className="font-medium text-foreground">{materialLabel}</SheetDescription>
        </SheetHeader>
        <Separator className="my-3" />
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Planchas enteras disp.</p>
                <p className="text-lg font-semibold tabular-nums">
                  {enterasDisp.length}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    · {formatM2(enterasDisp.reduce((s, n) => s + m2(n.chapa.largoCm, n.chapa.anchoCm), 0))} m²
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Retazos para trabajar</p>
                <p className="text-lg font-semibold tabular-nums">
                  {retazosDisp.length}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    · {formatM2(retazosDisp.reduce((s, c) => s + m2(c.largoCm, c.anchoCm), 0))} m²
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-border bg-sky-500/10 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Sobrante previsto</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatM2(previstos.reduce((s, c) => s + m2(c.largoCm, c.anchoCm), 0))}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">m²</span>
                </p>
              </div>
              <div className="rounded-lg border border-border bg-amber-500/10 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">m² reservado</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatM2(reservadas.reduce((s, c) => s + m2(c.largoCm, c.anchoCm), 0))}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["todas", "Todas"],
                  ["disponibles", "Disponibles"],
                  ["reservadas", "Reservadas"],
                  ["con_sobrante", "Con sobrante"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={filtro === id ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setFiltro(id)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Planchas
              </p>
              {raicesFiltradas.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  Sin planchas para este filtro.
                </p>
              ) : (
                raicesFiltradas.map((nodo) => {
                  const c = nodo.chapa;
                  const otLabel = c.otReservaId ? otTitulos.get(c.otReservaId) : null;
                  const plan = c.otReservaId ? planes.get(c.otReservaId) : undefined;
                  const planPlancha = plan?.planchas.find((p) => p.chapaId === c.id);
                  const m2Chapa = m2(c.largoCm, c.anchoCm);
                  const m2HijosDisp = nodo.hijos
                    .filter((h) => h.estado === "Disponible")
                    .reduce((s, h) => s + m2(h.largoCm, h.anchoCm), 0);
                  const m2HijosPrev = nodo.hijos
                    .filter((h) => h.estado === "Prevista")
                    .reduce((s, h) => s + m2(h.largoCm, h.anchoCm), 0);
                  const pct = planPlancha?.pctAprovechado ?? (m2Chapa > 0 && (m2HijosDisp + m2HijosPrev) > 0
                    ? ((m2Chapa - m2HijosDisp - m2HijosPrev) / m2Chapa) * 100
                    : null);
                  return (
                    <Collapsible key={c.id ?? c.bulto} className="rounded-lg border border-border bg-card">
                      <div className="flex items-start gap-2 px-3 py-2.5">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                            aria-label="Ver sobrantes de la plancha"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </CollapsibleTrigger>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-medium">{c.bulto}</span>
                            <Badge variant="secondary" className={estadoBadgeClass(c.estado)}>
                              {c.estado === "Prevista" ? "Prevista" : c.estado}
                            </Badge>
                            {c.otReservaId &&
                            (c.estado === "Reservada" ||
                              c.estado === "Usada" ||
                              c.estado === "Bloqueada") ? (
                              <button
                                type="button"
                                className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                                disabled={abriendoOtId === c.otReservaId}
                                onClick={() => void abrirOt(c.otReservaId!)}
                              >
                                <span className="truncate">{otLabel || "OT"}</span>
                                <ArrowUpRight className="h-3 w-3 shrink-0" />
                              </button>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {c.largoCm} × {c.anchoCm} cm · {formatM2(m2Chapa)} m²
                            {c.espesorCm != null && c.espesorCm > 0 ? ` · ${c.espesorCm} cm` : ""}
                            {c.loteCodigo ? ` · lote ${c.loteCodigo}` : ""}
                          </p>
                          {pct != null ? (
                            <div className="space-y-1">
                              <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                                <span
                                  className="bg-emerald-600"
                                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                />
                                <span
                                  className="bg-sky-400"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, ((m2HijosDisp + m2HijosPrev) / Math.max(m2Chapa, 0.001)) * 100))}%`,
                                  }}
                                />
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {Math.round(pct)} % aprovechado
                                {m2HijosPrev > 0
                                  ? ` · ${formatM2(m2HijosPrev)} m² se libera al cortar`
                                  : m2HijosDisp > 0
                                    ? ` · ${formatM2(m2HijosDisp)} m² disponible para trabajo`
                                    : ""}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <CollapsibleContent>
                        <div className="space-y-3 border-t border-border/60 px-3 py-3">
                          {planPlancha ? (
                            <PlanCorteCroquis plancha={planPlancha} className="h-40 w-full rounded-md border border-border" />
                          ) : null}
                          {nodo.hijos.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sin sobrante registrado.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {nodo.hijos.map((h) => (
                                <li
                                  key={h.id ?? h.bulto}
                                  className="flex items-center justify-between gap-2 rounded-md border border-border/70 px-2.5 py-1.5 text-xs"
                                >
                                  <span className="min-w-0">
                                    <span className="font-mono">{h.bulto}</span>
                                    <span className="text-muted-foreground">
                                      {" "}
                                      · {h.largoCm} × {h.anchoCm} cm · {formatM2(m2(h.largoCm, h.anchoCm))} m²
                                    </span>
                                  </span>
                                  <Badge variant="secondary" className={cn("shrink-0", estadoBadgeClass(h.estado))}>
                                    {h.estado === "Prevista"
                                      ? "Previsto · se libera al cortar"
                                      : h.estado === "Disponible"
                                        ? "Disponible para trabajo"
                                        : h.estado}
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}
            </div>

            {sueltos.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Retazos sueltos
                </p>
                <ul className="space-y-1.5">
                  {sueltos.map((c) => (
                    <li
                      key={c.id ?? c.bulto}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs"
                    >
                      <span>
                        <span className="font-mono font-medium">{c.bulto}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {c.largoCm} × {c.anchoCm} cm · {formatM2(m2(c.largoCm, c.anchoCm))} m²
                        </span>
                      </span>
                      <Badge variant="secondary" className={estadoBadgeClass(c.estado)}>
                        {c.estado === "Disponible" ? "Disponible para trabajo" : c.estado}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {scraps.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Historial de recortes
                </p>
                <div className="space-y-2">
                  {scraps.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border bg-card p-3 text-xs shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{r.accion}</span>
                        <span className="text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("es-AR")}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{r.ingreso_tipo}</p>
                      <p className="mt-1 tabular-nums">
                        Cant. <span className="font-medium">{r.cantidad}</span>
                        {r.n_chapa ? (
                          <>
                            {" "}
                            · Chapa <span className="font-mono">{r.n_chapa}</span>
                          </>
                        ) : null}
                      </p>
                      {r.observacion ? <p className="mt-2 text-muted-foreground">{r.observacion}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
    <OtDetalleDialog
      item={otDetalle}
      open={otDetalleOpen}
      onOpenChange={(o) => {
        setOtDetalleOpen(o);
        if (!o) setOtDetalle(null);
      }}
      onChanged={() => void recargarChapas()}
    />
    </>
  );
}
