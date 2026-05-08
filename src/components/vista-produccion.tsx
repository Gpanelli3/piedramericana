"use client";

import { useCallback, useMemo, useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStock } from "@/contexts/StockContext";
import { toast } from "sonner";

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
  /** Pausada por rotura / reproceso — no avanza ni arrastra hasta reanudar */
  pausada?: boolean;
}

const OT_INICIAL: OT[] = [
  {
    id: "1",
    numero: "OT #1042",
    cliente: "Familia Pérez",
    material: "Granito Negro Brasil",
    m2: "3.50 m²",
    vendedor: "tgorosito",
    columna: "corte",
    prioridad: "alta",
  },
  {
    id: "2",
    numero: "OT #1038",
    cliente: "Arq. Cecilia Ortega",
    material: "Silestone Blanco Norte",
    m2: "2.10 m²",
    vendedor: "acottini",
    columna: "medicion",
    prioridad: "normal",
  },
  {
    id: "3",
    numero: "OT #1035",
    cliente: "Victoria Torres",
    material: "Dekton TRILIUM 12mm",
    m2: "4.20 m²",
    vendedor: "rcampillo",
    columna: "produccion",
    prioridad: "normal",
  },
  {
    id: "4",
    numero: "OT #1031",
    cliente: "Daniel Natale",
    material: "Cuarcita Black Taurus",
    m2: "1.80 m²",
    vendedor: "operelna",
    columna: "produccion",
    prioridad: "baja",
  },
  {
    id: "5",
    numero: "OT #1028",
    cliente: "Yanina Salvini",
    material: "Granito Negro Boreal",
    m2: "2.90 m²",
    vendedor: "tgorosito",
    columna: "despacho",
    prioridad: "alta",
  },
];

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

export function VistaProduccion() {
  const { tryDeducirChapaPorRotura } = useStock();
  const [ots, setOts] = useState<OT[]>(OT_INICIAL);
  const [modalRoturaOpen, setModalRoturaOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [selectedOT, setSelectedOT] = useState<OT | null>(null);
  const [motivo, setMotivo] = useState("");
  const [materialDescuento, setMaterialDescuento] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<EtapaId | null>(null);

  const otsActivas = useMemo(() => ots.length, [ots]);

  const refrescarSeleccion = useCallback((lista: OT[]) => {
    setSelectedOT((prev) => (prev ? lista.find((o) => o.id === prev.id) ?? null : null));
  }, []);

  const moverAEtapa = useCallback(
    (otId: string, nueva: EtapaId) => {
      setOts((prev) => {
        const next = prev.map((o) => {
          if (o.id !== otId) return o;
          if (o.pausada) return o;
          if (o.columna === nueva) return o;
          return { ...o, columna: nueva };
        });
        refrescarSeleccion(next);
        return next;
      });
    },
    [refrescarSeleccion]
  );

  const avanzarEtapa = useCallback(
    (ot: OT) => {
      const i = etapaIndex(ot.columna);
      if (ot.pausada || i < 0 || i >= ETAPAS_ORDEN.length - 1) return;
      moverAEtapa(ot.id, ETAPAS_ORDEN[i + 1]!);
    },
    [moverAEtapa]
  );

  const retrocederEtapa = useCallback(
    (ot: OT) => {
      const i = etapaIndex(ot.columna);
      if (ot.pausada || i <= 0) return;
      moverAEtapa(ot.id, ETAPAS_ORDEN[i - 1]!);
    },
    [moverAEtapa]
  );

  const reanudarOT = useCallback((otId: string) => {
    setOts((prev) => {
      const next = prev.map((o) => (o.id === otId ? { ...o, pausada: false } : o));
      refrescarSeleccion(next);
      return next;
    });
  }, [refrescarSeleccion]);

  const handleRotura = (ot: OT) => {
    setSelectedOT(ot);
    setModalRoturaOpen(true);
  };

  const handleConfirmarRotura = () => {
    if (!selectedOT || !motivo || !materialDescuento) return;
    const { removed, bulto } = tryDeducirChapaPorRotura(materialDescuento);
    if (removed) {
      toast.success(`Stock actualizado: se dio de baja la chapa ${bulto ?? ""}`.trim());
    } else {
      toast.warning(
        "No había chapa disponible de ese material en stock; la OT queda pausada igual."
      );
    }
    setOts((prev) => {
      const next = prev.map((o) =>
        o.id === selectedOT.id ? { ...o, pausada: true } : o
      );
      refrescarSeleccion(next);
      return next;
    });
    setModalRoturaOpen(false);
    setMotivo("");
    setMaterialDescuento("");
  };

  const abrirDetalle = (ot: OT) => {
    setSelectedOT(ot);
    setDetalleOpen(true);
  };

  const otDetalle = selectedOT ? ots.find((o) => o.id === selectedOT.id) ?? selectedOT : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border bg-white px-6 py-4 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Producción / Taller</p>
            <h1 className="text-xl font-bold text-foreground">
              Control de taller — Kanban por OT
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Arrastrá una tarjeta a otra columna, o abrí la OT para avanzar o retroceder una etapa.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Hoy, 06 May 2026</span>
            </div>
            <Badge variant="outline" className="text-sm font-medium">
              {otsActivas} OTs en tablero
            </Badge>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-x-auto overflow-y-auto p-4 sm:p-6">
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
                    if (id) moverAEtapa(id, col.id);
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
                      onClick={() => reanudarOT(otDetalle.id)}
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
              </div>

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
                    otDetalle.pausada || etapaIndex(otDetalle.columna) <= 0
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
                  disabled={otDetalle.pausada}
                  onValueChange={(v) => moverAEtapa(otDetalle.id, v as EtapaId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columnas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              Al confirmar, la OT queda pausada hasta que el taller la reanude. Se intenta dar de
              baja una chapa disponible del material elegido en el módulo Stock (mock compartido en
              esta sesión).
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
              <Label htmlFor="material-desc">Material a descontar del stock (mock)</Label>
              <Select value={materialDescuento} onValueChange={setMaterialDescuento}>
                <SelectTrigger id="material-desc">
                  <SelectValue placeholder="Seleccionar material…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="granito-negro">Granito Negro Brasil Extra 20mm</SelectItem>
                  <SelectItem value="silestone-blanco">Silestone Blanco Norte</SelectItem>
                  <SelectItem value="cuarcita-black">Cuarcita Black Taurus</SelectItem>
                  <SelectItem value="dekton-trilium">Dekton TRILIUM 12mm</SelectItem>
                  <SelectItem value="granito-boreal">Granito Negro Boreal Leather</SelectItem>
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
              onClick={handleConfirmarRotura}
              disabled={!motivo || !materialDescuento}
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
  const puedeArrastrar = !ot.pausada;

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
        !puedeArrastrar && "opacity-90",
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
