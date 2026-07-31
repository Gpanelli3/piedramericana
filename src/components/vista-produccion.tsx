"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Clock,
  User,
  Layers,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  GripVertical,
  PlayCircle,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  loadOtKanbanView,
  persistJobOtProduccion,
  textoDesdeOtPayloadClienteMaterial,
  type OtTarjeta,
} from "@/lib/ventas-api";
import type { JobStatus } from "@/types/database";
import { OtStockPanel } from "@/components/produccion/OtStockPanel";
import {
  bajaChapaPorRotura,
  listChapasDisponibles,
  listChapasPorOt,
  type ChapaInventarioRow,
} from "@/lib/stock-ot-api";
import { useStock } from "@/contexts/StockContext";

const ETAPAS_ORDEN = ["medicion", "corte", "produccion", "despacho"] as const;
type EtapaId = (typeof ETAPAS_ORDEN)[number];

interface OT {
  id: string;
  numero: string;
  cliente: string;
  material: string;
  m2: string;
  vendedor: string;
  columna: EtapaId;
  prioridad: "alta" | "normal" | "baja";
  pausada?: boolean;
  bloqueada: boolean;
  status: JobStatus;
}

function coalesceEtapa(raw: unknown): EtapaId {
  return ETAPAS_ORDEN.includes(raw as EtapaId) ? (raw as EtapaId) : "medicion";
}

function tarjetaToOtUi(t: OtTarjeta): OT {
  const { materialLabel, m2Display, vendedorLabel } = textoDesdeOtPayloadClienteMaterial(t.presupuestoFuente);
  return {
    id: t.orden.id,
    numero:
      t.orden.titulo?.trim()
        || (t.presupuestoFuente ? `OT · ${t.presupuestoFuente.numero}` : "OT"),
    cliente: t.presupuestoFuente?.cliente?.trim() || "—",
    material: materialLabel,
    m2: m2Display,
    vendedor: vendedorLabel,
    columna: coalesceEtapa(t.orden.etapa),
    prioridad: "normal",
    pausada: Boolean(t.orden.pausada),
    bloqueada: coalesceEtapa(t.orden.etapa) === "medicion",
    status: (t.orden.estado as JobStatus) ?? "pending",
  };
}

const columnas: { id: EtapaId; label: string; color: string }[] = [
  { id: "medicion", label: "Medición", color: "border-t-blue-400" },
  { id: "corte", label: "Corte", color: "border-t-orange-400" },
  { id: "produccion", label: "Producción", color: "border-t-violet-400" },
  { id: "despacho", label: "Despacho", color: "border-t-green-400" },
];

const prioridadConfig = {
  alta: { label: "Urgente", class: "bg-red-100 text-red-700 border-red-200" },
  normal: { label: "Normal", class: "bg-blue-100 text-blue-700 border-blue-200" },
  baja: { label: "Baja", class: "bg-gray-100 text-gray-600 border-gray-200" },
};

function etapaIndex(e: EtapaId): number {
  return ETAPAS_ORDEN.indexOf(e);
}

function jobStatusEtiqueta(s: JobStatus): string {
  switch (s) {
    case "pending":
      return "En espera";
    case "in_progress":
      return "En curso";
    case "done":
      return "Finalizada";
    case "cancelled":
      return "Cancelada";
    default:
      return s;
  }
}

export function VistaProduccion() {
  const { reloadChapas } = useStock();
  const [ots, setOts] = useState<OT[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [modalRoturaOpen, setModalRoturaOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [selectedOT, setSelectedOT] = useState<OT | null>(null);
  const [motivo, setMotivo] = useState("");
  const [chapaRoturaId, setChapaRoturaId] = useState("");
  const [obsRotura, setObsRotura] = useState("");
  const [chapasRotura, setChapasRotura] = useState<ChapaInventarioRow[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<EtapaId | null>(null);

  const otsActivas = useMemo(() => ots.length, [ots]);

  const refrescarSeleccion = useCallback((lista: OT[]) => {
    setSelectedOT((prev) => (prev ? lista.find((o) => o.id === prev.id) ?? null : null));
  }, []);

  const refreshBoard = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setOts([]);
      return;
    }
    setBoardLoading(true);
    const { data, error } = await loadOtKanbanView();
    setBoardLoading(false);
    if (error) {
      toast.error(error.message);
      setOts([]);
      return;
    }
    const mapped = (data ?? []).map(tarjetaToOtUi);
    setOts(mapped);
    refrescarSeleccion(mapped);
  }, [refrescarSeleccion]);

  useEffect(() => {
    void refreshBoard();
  }, [refreshBoard]);

  const moverAEtapa = useCallback(
    async (otId: string, nueva: EtapaId) => {
      const ot = ots.find((o) => o.id === otId);
      if (!ot || ot.pausada || ot.bloqueada || ot.columna === nueva || ot.status === "done") return;
      if (nueva === "medicion") return;

      let nextStatus: JobStatus = ot.status;
      if (ot.status === "pending") nextStatus = "in_progress";

      setOts((prev) => {
        const next = prev.map((o) => {
          if (o.id !== otId) return o;
          return { ...o, columna: nueva, status: nextStatus };
        });
        refrescarSeleccion(next);
        return next;
      });

      const res = await persistJobOtProduccion({
        ordenTrabajoId: otId,
        patch: { etapa: nueva, status: nextStatus },
      });

      if (res.error) {
        toast.error(res.error.message);
        await refreshBoard();
        return;
      }
      await refreshBoard();
    },
    [ots, refrescarSeleccion, refreshBoard],
  );

  const avanzarEtapa = useCallback(
    (ot: OT) => {
      const i = etapaIndex(ot.columna);
      if (ot.pausada || ot.bloqueada || ot.status === "done" || i < 0 || i >= ETAPAS_ORDEN.length - 1) return;
      void moverAEtapa(ot.id, ETAPAS_ORDEN[i + 1]!);
    },
    [moverAEtapa],
  );

  const retrocederEtapa = useCallback(
    (ot: OT) => {
      const i = etapaIndex(ot.columna);
      if (ot.pausada || ot.bloqueada || ot.status === "done" || i <= 0) return;
      void moverAEtapa(ot.id, ETAPAS_ORDEN[i - 1]!);
    },
    [moverAEtapa],
  );

  const reanudarOT = useCallback(
    async (otId: string) => {
      const r = await persistJobOtProduccion({ ordenTrabajoId: otId, patch: { pausada: false } });
      if (r.error) {
        toast.error(r.error.message);
        return;
      }
      toast.success("OT reanudada.");
      await refreshBoard();
    },
    [refreshBoard],
  );

  const finalizarOtEnDb = useCallback(
    async (otId: string) => {
      const r = await persistJobOtProduccion({
        ordenTrabajoId: otId,
        patch: { status: "done" },
      });
      if (r.error) {
        toast.error(r.error.message);
        return;
      }
      toast.success("Obra marcada como finalizada.");
      await refreshBoard();
      setDetalleOpen(false);
    },
    [refreshBoard],
  );

  const handleRotura = (ot: OT) => {
    setSelectedOT(ot);
    setMotivo("");
    setChapaRoturaId("");
    setObsRotura("");
    setModalRoturaOpen(true);
    void (async () => {
      const [res, disp] = await Promise.all([
        listChapasPorOt(ot.id, ["Reservada"]),
        listChapasDisponibles(),
      ]);
      const merge = [...res.data];
      const ids = new Set(merge.map((c) => c.id));
      for (const c of disp.data) {
        if (!ids.has(c.id)) merge.push(c);
      }
      setChapasRotura(merge);
      if (merge[0]) setChapaRoturaId(merge[0].id);
    })();
  };

  const handleConfirmarRotura = async () => {
    if (!selectedOT || !motivo || !chapaRoturaId) return;
    const baja = await bajaChapaPorRotura({
      chapaId: chapaRoturaId,
      otId: selectedOT.id,
      motivo,
      observacion: obsRotura,
    });
    if (baja.error) {
      toast.error(baja.error.message);
      return;
    }
    toast.success(`Stock: baja de chapa ${baja.bulto ?? ""}`.trim());
    await reloadChapas();
    const r = await persistJobOtProduccion({
      ordenTrabajoId: selectedOT.id,
      patch: { pausada: true },
    });
    if (r.error) {
      toast.error(r.error.message);
    } else {
      await refreshBoard();
    }
    setModalRoturaOpen(false);
    setMotivo("");
    setChapaRoturaId("");
    setObsRotura("");
  };

  const abrirDetalle = (ot: OT) => {
    setSelectedOT(ot);
    setDetalleOpen(true);
  };

  const otDetalle = selectedOT ? (ots.find((o) => o.id === selectedOT.id) ?? selectedOT) : null;

  const hoyFmt = useMemo(
    () =>
      new Date().toLocaleDateString("es-AR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [],
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white px-6 py-4 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Control de taller — Kanban por OT
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="capitalize">{hoyFmt}</span>
            </div>
            <Badge variant="outline" className="text-sm font-medium">
              {otsActivas} OTs en tablero
            </Badge>
          </div>
        </div>
      </header>

      <main className="overflow-x-auto p-4 sm:p-6">
        {boardLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Cargando órdenes de trabajo…
          </div>
        ) : ots.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground leading-relaxed">
            No hay órdenes activas en taller. Se generan cuando registrás la primera seña sobre un presupuesto
            aprobado en Ventas.
          </div>
        ) : (
          <div className="flex min-w-max gap-4">
          {columnas.map((col) => {
            const lista = ots.filter((o) => o.columna === col.id);
            return (
              <div key={col.id} className="flex w-64 flex-col gap-3">
                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3 shadow-sm",
                    col.color,
                    "border-t-4"
                  )}
                >
                  <span className="text-sm font-semibold text-foreground">{col.label}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                    {lista.length}
                  </span>
                </div>

                <div
                  role="list"
                  className={cn(
                    "flex min-h-[120px] flex-col gap-3 rounded-lg border-2 border-dashed p-1 transition-colors",
                    dropTarget === col.id ? "border-primary bg-primary/5" : "border-transparent"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropTarget(col.id);
                  }}
                  onDragLeave={() => setDropTarget((t) => (t === col.id ? null : t))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropTarget(null);
                    const id = e.dataTransfer.getData("application/x-ot-id");
                    if (id) void moverAEtapa(id, col.id);
                  }}
                >
                  {lista.map((ot) => (
                    <OTCard
                      key={ot.id}
                      ot={ot}
                      draggingId={draggingId}
                      onDragStart={(oid) => setDraggingId(oid)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropTarget(null);
                      }}
                      onVer={() => abrirDetalle(ot)}
                      onRotura={() => handleRotura(ot)}
                      showRotura={col.id === "corte" || col.id === "produccion"}
                    />
                  ))}

                  {lista.length === 0 && (
                    <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-border">
                      <p className="text-xs text-muted-foreground">Soltar acá</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </main>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-left">{otDetalle?.numero ?? "OT"}</DialogTitle>
            <DialogDescription className="text-left">
              Mover entre etapas del taller. Si la OT está pausada por rotura, reanudala antes de
              avanzar.
            </DialogDescription>
          </DialogHeader>

          {otDetalle && (
            <div className="space-y-4">
              {otDetalle.bloqueada && (
                <div className="flex items-start gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">OT bloqueada en medición</p>
                    <p className="text-xs opacity-90">
                      Producción no puede mover esta OT hasta que Ventas registre el pago del saldo.
                    </p>
                  </div>
                </div>
              )}

              {otDetalle.pausada && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">Pausada (rotura / reproceso)</p>
                    <p className="text-xs opacity-90">
                      No se puede cambiar de etapa hasta reanudar.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-8 gap-1 border-amber-400 bg-white text-xs dark:bg-background"
                      onClick={() => void reanudarOT(otDetalle.id)}
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Reanudar obra
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">{otDetalle.cliente}</p>
                <p className="text-muted-foreground">{otDetalle.material}</p>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{otDetalle.m2}</span>
                  <span>·</span>
                  <span>{otDetalle.vendedor}</span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Estado trabajo:{" "}
                  <span className="font-medium text-foreground">{jobStatusEtiqueta(otDetalle.status)}</span>
                </p>
              </div>

              <OtStockPanel
                otId={otDetalle.id}
                materialHint={otDetalle.material}
                onChanged={() => void reloadChapas()}
              />

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Etapa actual</p>
                <div className="flex flex-wrap gap-1.5">
                  {ETAPAS_ORDEN.map((eid) => {
                    const label = columnas.find((c) => c.id === eid)?.label ?? eid;
                    const activa = otDetalle.columna === eid;
                    return (
                      <Badge
                        key={eid}
                        variant={activa ? "default" : "outline"}
                        className={cn("text-xs font-normal", !activa && "opacity-60")}
                      >
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-1"
                  disabled={
                    otDetalle.pausada ||
                    otDetalle.bloqueada ||
                    otDetalle.status === "done" ||
                    etapaIndex(otDetalle.columna) <= 0
                  }
                  onClick={() => retrocederEtapa(otDetalle)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Etapa anterior
                </Button>
                <Button
                  type="button"
                  className="flex-1 gap-1"
                  disabled={
                    otDetalle.pausada ||
                    otDetalle.bloqueada ||
                    otDetalle.status === "done" ||
                    etapaIndex(otDetalle.columna) >= ETAPAS_ORDEN.length - 1
                  }
                  onClick={() => avanzarEtapa(otDetalle)}
                >
                  Siguiente etapa
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Mover directamente a</Label>
                <Select
                  value={otDetalle.columna}
                  disabled={otDetalle.pausada || otDetalle.bloqueada || otDetalle.status === "done"}
                  onValueChange={(v) => void moverAEtapa(otDetalle.id, v as EtapaId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columnas
                      .filter((c) => c.id !== "medicion")
                      .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {otDetalle.columna === "despacho" &&
              otDetalle.status !== "done" &&
              !otDetalle.pausada ?
                <Button
                  type="button"
                  className="w-full"
                  variant="secondary"
                  onClick={() => void finalizarOtEnDb(otDetalle.id)}
                >
                  Finalizar obra y archivar OT
                </Button>
              : null}

              {otDetalle.status === "done" ?
                <p className="text-xs text-muted-foreground">
                  Esta OT ya está finalizada en sistema y fue retirada del tablero.
                </p>
              : null}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetalleOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalRoturaOpen} onOpenChange={setModalRoturaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Registrar rotura / reproceso
            </DialogTitle>
            <DialogDescription>
              La OT queda pausada y la chapa elegida pasa a estado Baja (queda historial, no se borra).
            </DialogDescription>
          </DialogHeader>

          {selectedOT && (
            <div className="mb-2 rounded-md bg-muted/50 px-4 py-3 text-sm">
              <p className="font-semibold text-foreground">{selectedOT.numero}</p>
              <p className="text-muted-foreground">
                {selectedOT.cliente} — {selectedOT.material}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo de la rotura</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger id="motivo">
                  <SelectValue placeholder="Seleccionar motivo…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corte-incorrecto">Corte incorrecto</SelectItem>
                  <SelectItem value="caida-accidente">Caída / accidente</SelectItem>
                  <SelectItem value="veta-material">Veta del material</SelectItem>
                  <SelectItem value="medicion-error">Error de medición</SelectItem>
                  <SelectItem value="traslado">Daño en traslado</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chapa-baja">Chapa a dar de baja</Label>
              <Select value={chapaRoturaId} onValueChange={setChapaRoturaId}>
                <SelectTrigger id="chapa-baja">
                  <SelectValue placeholder="Seleccionar chapa…" />
                </SelectTrigger>
                <SelectContent>
                  {chapasRotura.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Sin chapas disponibles/reservadas
                    </SelectItem>
                  ) : (
                    chapasRotura.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.bulto} · {c.material_label}
                        {c.lote_codigo ? ` · lote ${c.lote_codigo}` : ""}
                        {c.estado === "Reservada" ? " (reservada)" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs-rotura">Observaciones</Label>
              <Textarea
                id="obs-rotura"
                placeholder="Descripción del incidente…"
                rows={3}
                className="resize-none"
                value={obsRotura}
                onChange={(e) => setObsRotura(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setModalRoturaOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => void handleConfirmarRotura()}
              disabled={!motivo || !chapaRoturaId || chapaRoturaId === "__none"}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Confirmar y pausar OT
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OTCard({
  ot,
  draggingId,
  onDragStart,
  onDragEnd,
  onVer,
  onRotura,
  showRotura,
}: {
  ot: OT;
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onVer: () => void;
  onRotura: () => void;
  showRotura: boolean;
}) {
  const prioridad = prioridadConfig[ot.prioridad];
  const puedeArrastrar = !ot.pausada && !ot.bloqueada && ot.status !== "done";

  return (
    <div
      role="listitem"
      draggable={puedeArrastrar}
      onDragStart={(e) => {
        if (!puedeArrastrar) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("application/x-ot-id", ot.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(ot.id);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "space-y-3 rounded-lg border border-border bg-white p-4 shadow-sm transition-[box-shadow,transform] duration-150",
        puedeArrastrar && "cursor-grab active:cursor-grabbing",
        ot.bloqueada && "opacity-70",
        !puedeArrastrar && !ot.bloqueada && "opacity-90",
        draggingId === ot.id &&
          "z-10 border-primary/40 shadow-md ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {puedeArrastrar ? (
            <GripVertical
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : null}
          <span className="truncate text-sm font-bold text-primary">{ot.numero}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium",
              prioridad.class
            )}
          >
            {prioridad.label}
          </span>
          {ot.pausada ? (
            <Badge variant="secondary" className="text-[10px] text-amber-800">
              Pausada
            </Badge>
          ) : null}
          {ot.bloqueada ? (
            <Badge variant="secondary" className="gap-1 text-[10px] text-slate-800">
              <Lock className="h-3 w-3" />
              Bloqueada
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-sm text-foreground">
          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{ot.cliente}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{ot.material}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{ot.m2}</span>
          <span>{ot.vendedor}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="flex-1 h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={onVer}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Ver OT
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>

        {showRotura && (
          <Button
            type="button"
            size="sm"
            className="h-7 bg-red-600 px-2 text-xs text-white hover:bg-red-700"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRotura();
            }}
          >
            <AlertTriangle className="mr-1 h-3 w-3" />
            Rotura
          </Button>
        )}
      </div>
    </div>
  );
}
