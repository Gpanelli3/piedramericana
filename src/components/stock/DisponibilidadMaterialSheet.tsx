"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OtDetalleDialog } from "@/components/produccion/OtDetalleDialog";
import {
  esChapaRetazo,
  fetchOtTitulosByIds,
  fetchScrapsByMaterialLabel,
  fetchSlabsByMaterialLabel,
  type StockScrapRow,
} from "@/lib/stock-api";
import { getOtProduccionById, type OtProduccionItem } from "@/lib/produccion-api";
import type { ChapaRow } from "@/contexts/StockContext";

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
  if (estado === "Usada") {
    return "border border-slate-200 bg-slate-100 text-[10px] text-slate-700";
  }
  if (estado === "Bloqueada") {
    return "border border-amber-200 bg-amber-50 text-[10px] text-amber-900";
  }
  return "border border-red-200 bg-red-50 text-[10px] text-red-800";
}

type DisponibilidadMaterialSheetProps = {
  materialLabel: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fallback local chapas cuando no hay servidor (filtro mismo label). */
  chapasLocales: ChapaRow[];
};

export function DisponibilidadMaterialSheet({
  materialLabel,
  open,
  onOpenChange,
  chapasLocales,
}: DisponibilidadMaterialSheetProps) {
  const [slabs, setSlabs] = useState<ChapaRow[]>([]);
  const [scraps, setScraps] = useState<StockScrapRow[]>([]);
  const [otTitulos, setOtTitulos] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [otDetalle, setOtDetalle] = useState<OtProduccionItem | null>(null);
  const [otDetalleOpen, setOtDetalleOpen] = useState(false);
  const [abriendoOtId, setAbriendoOtId] = useState<string | null>(null);

  const recargarChapas = useCallback(async () => {
    if (!materialLabel) return;
    try {
      const s = await fetchSlabsByMaterialLabel(materialLabel);
      const remote = s.length > 0 ? s : chapasLocales.filter((c) => c.material === materialLabel);
      const titulos = await fetchOtTitulosByIds(
        remote.map((c) => c.otReservaId).filter((id): id is string => Boolean(id)),
      );
      setSlabs(remote);
      setOtTitulos(titulos);
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
        const titulos = await fetchOtTitulosByIds(
          remote.map((c) => c.otReservaId).filter((id): id is string => Boolean(id)),
        );
        if (!cancel) {
          setSlabs(remote);
          setScraps(sc);
          setOtTitulos(titulos);
        }
      } catch {
        if (!cancel) {
          setSlabs(chapasLocales.filter((c) => c.material === materialLabel));
          setScraps([]);
          setOtTitulos(new Map());
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, materialLabel, chapasLocales]);

  if (!materialLabel) return null;

  const disponibles = slabs.filter((c) => c.estado === "Disponible");
  const reservadas = slabs.filter((c) => c.estado === "Reservada");
  const m2Disp = disponibles.reduce((acc, c) => acc + m2(c.largoCm, c.anchoCm), 0);
  const m2Res = reservadas.reduce((acc, c) => acc + m2(c.largoCm, c.anchoCm), 0);
  const retazos = slabs.filter((c) => c.estado === "Disponible" && esChapaRetazo(c));

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-lg">
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
                <p className="text-[11px] text-muted-foreground">Chapas activas</p>
                <p className="text-lg font-semibold tabular-nums">
                  {disponibles.length + reservadas.length}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Retazos disp.</p>
                <p className="text-lg font-semibold tabular-nums">{retazos.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-emerald-500/10 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">m² disponible</p>
                <p className="text-lg font-semibold tabular-nums">{formatM2(m2Disp)}</p>
              </div>
              <div className="rounded-lg border border-border bg-amber-500/10 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">m² reservado</p>
                <p className="text-lg font-semibold tabular-nums">{formatM2(m2Res)}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Chapas
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs">Bulto</TableHead>
                      <TableHead className="text-xs">Medidas</TableHead>
                      <TableHead className="text-right text-xs">m²</TableHead>
                      <TableHead className="text-center text-xs">Estado</TableHead>
                      <TableHead className="text-xs">OT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slabs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                          Sin chapas para este material.
                        </TableCell>
                      </TableRow>
                    ) : (
                      slabs.map((c) => {
                        const otLabel = c.otReservaId ? otTitulos.get(c.otReservaId) : null;
                        const retazo = esChapaRetazo(c);
                        return (
                          <TableRow key={c.id ?? c.bulto}>
                            <TableCell className="font-mono text-xs">
                              <span className="inline-flex flex-wrap items-center gap-1">
                                {c.bulto}
                                {retazo ? (
                                  <Badge variant="outline" className="text-[9px] font-normal">
                                    Retazo
                                  </Badge>
                                ) : null}
                              </span>
                            </TableCell>
                            <TableCell className="tabular-nums text-xs text-muted-foreground">
                              {c.largoCm} × {c.anchoCm} cm
                              {c.espesorCm != null && c.espesorCm > 0
                                ? ` · ${c.espesorCm} cm esp`
                                : ""}
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold tabular-nums">
                              {formatM2(m2(c.largoCm, c.anchoCm))}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className={estadoBadgeClass(c.estado)}>
                                {c.estado}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[11rem] text-xs text-muted-foreground">
                              {c.otReservaId &&
                              (c.estado === "Reservada" ||
                                c.estado === "Usada" ||
                                c.estado === "Baja" ||
                                c.estado === "Bloqueada") ? (
                                <div className="flex min-w-0 items-center gap-1">
                                  <span className="truncate">{otLabel || "OT"}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 text-foreground"
                                    aria-label={`Ir a ${otLabel || "la OT"}`}
                                    disabled={abriendoOtId === c.otReservaId}
                                    onClick={() => void abrirOt(c.otReservaId!)}
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

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
