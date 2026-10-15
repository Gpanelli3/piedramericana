"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { FechaInput } from "@/components/ui/fecha-input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OtMedidasPanel } from "@/components/produccion/OtMedidasPanel";
import { VentaCobrosDialog } from "@/components/venta/VentaCobrosDialog";
import { OtRoturaEstado } from "@/components/produccion/OtRoturaEstado";
import { OtStockPanel } from "@/components/produccion/OtStockPanel";
import { M2Comparacion, UrgenciaBadge, formatFechaCorta } from "@/components/produccion/ot-ui";
import {
  avanzarEtapaOt,
  coalesceEtapaOt,
  ETAPAS_OT_ORDEN,
  fechaProgramadaInputValue,
  getOtSaldoVenta,
  marcarOtEntregada,
  setEtapaOt,
  setOtBloqueada,
  setOtDesbloqueada,
  setOtFechaProgramada,
  setOtNotas,
  setOtPausada,
  siguienteEtapaOt,
  type EtapaOtId,
  type OtProduccionItem,
  type OtSaldoVenta,
} from "@/lib/produccion-api";
import { etiquetaEtapaKanban, etiquetaTabDestino } from "@/lib/etiquetas-ot";
import { useAccionesRotuloOt } from "@/components/produccion/useAccionesRotuloOt";
import { fetchMedidasOt, type MedidaItemEditable } from "@/lib/ot-medidas-api";
import { formatMetraje, parseDecimalInput } from "@/lib/presupuesto-calculos";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  FileImage,
  FileText,
  Layers,
  MapPin,
  Printer,
  Receipt,
  Ruler,
} from "lucide-react";
import type { JobStatus } from "@/types/database";

type Props = {
  item: OtProduccionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  permitirEntregar?: boolean;
  /** Lista completa para navegar entre OTs con ← → */
  navItems?: OtProduccionItem[];
  /** Índice del item actual dentro de navItems */
  navIndex?: number;
  onNavChange?: (index: number) => void;
  /** Mostrar pestaña de cobros (p. ej. desde Finanzas). */
  mostrarSaldo?: boolean;
  /** Botones de rótulo de taller y plano (Producción y Logística). */
  mostrarRotulo?: boolean;
};

function fmtMoneda(n: number, moneda: "ars" | "usd") {
  return moneda === "usd"
    ? `USD ${n.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`
    : `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
}

function groupItemsByOrden(items: MedidaItemEditable[]) {
  const map = new Map<string, { ordenTitulo: string; items: MedidaItemEditable[] }>();
  for (const it of items) {
    if (!map.has(it.ordenKey)) {
      map.set(it.ordenKey, { ordenTitulo: it.ordenTitulo, items: [] });
    }
    map.get(it.ordenKey)!.items.push(it);
  }
  return [...map.values()];
}

function claveVentaOt(it: OtProduccionItem) {
  return it.ventaId || it.presupuestoNumero;
}

function OtEtapaStepper({
  etapa,
  done,
  disabled,
  busy,
  motivoDisabled,
  onSelect,
}: {
  etapa: EtapaOtId;
  done: boolean;
  disabled: boolean;
  busy: boolean;
  motivoDisabled?: string;
  onSelect: (e: EtapaOtId) => void;
}) {
  const currentIdx = ETAPAS_OT_ORDEN.indexOf(etapa);
  const last = ETAPAS_OT_ORDEN.length - 1;
  return (
    <ol className="flex w-full items-start">
      {ETAPAS_OT_ORDEN.map((e, i) => {
        const isCurrent = !done && i === currentIdx;
        const isPast = done || i < currentIdx;
        const canClick = !disabled && !busy && !isCurrent;
        const label = etiquetaEtapaKanban(e);
        const title = disabled
          ? motivoDisabled || "No se puede cambiar la etapa"
          : isCurrent
            ? "Etapa actual"
            : `Ir a ${label}`;
        return (
          <li key={e} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "h-0.5 flex-1",
                  i === 0 ? "bg-transparent" : isPast || isCurrent ? "bg-foreground/50" : "bg-border",
                )}
                aria-hidden
              />
              <button
                type="button"
                disabled={!canClick}
                onClick={() => onSelect(e)}
                aria-current={isCurrent ? "step" : undefined}
                title={title}
                className={cn(
                  "relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                  isCurrent && "border-foreground bg-foreground text-background",
                  isPast && !isCurrent && "border-foreground/40 bg-muted text-foreground",
                  !isPast && !isCurrent && "border-border bg-background text-muted-foreground",
                  canClick &&
                    "cursor-pointer hover:border-foreground hover:bg-foreground hover:text-background",
                  disabled && !isCurrent && "opacity-60",
                )}
              >
                {isPast && !isCurrent ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </button>
              <span
                className={cn(
                  "h-0.5 flex-1",
                  i === last ? "bg-transparent" : isPast ? "bg-foreground/50" : "bg-border",
                )}
                aria-hidden
              />
            </div>
            <span
              className={cn(
                "mt-1 max-w-full truncate px-0.5 text-center text-[10px] font-medium",
                isCurrent ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function OtDetalleDialog({
  item: itemProp,
  open,
  onOpenChange,
  onChanged,
  permitirEntregar = true,
  navItems,
  onNavChange,
  mostrarSaldo = false,
  mostrarRotulo = false,
}: Props) {
  const { irARotulo, abrirPlano, busyPlanoId } = useAccionesRotuloOt();
  const [fechaLocal, setFechaLocal] = useState("");
  const [savingFecha, setSavingFecha] = useState(false);
  const [busy, setBusy] = useState(false);

  const [medidaItems, setMedidaItems] = useState<MedidaItemEditable[]>([]);
  const [saldo, setSaldo] = useState<OtSaldoVenta | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);

  type EstadoOtLocal = "activa" | "bloqueada" | "pausada";
  const [estadoLocal, setEstadoLocal] = useState<EstadoOtLocal>("activa");
  const [notaLocal, setNotaLocal] = useState("");
  const [motivoLocal, setMotivoLocal] = useState("");
  const [savingEstado, setSavingEstado] = useState(false);
  const [cobrosOpen, setCobrosOpen] = useState(false);
  const [pinned, setPinned] = useState<OtProduccionItem | null>(null);
  const [etapaOverride, setEtapaOverride] = useState<EtapaOtId | null>(null);

  useEffect(() => {
    if (!open) {
      setPinned(null);
      setEtapaOverride(null);
      return;
    }
    if (!itemProp) return;
    setPinned((prev) => {
      if (!prev || prev.orden.id === itemProp.orden.id) return itemProp;
      return prev;
    });
  }, [open, itemProp]);

  const focusedId = pinned?.orden.id ?? itemProp?.orden.id ?? null;
  const fromNav = focusedId ? navItems?.find((i) => i.orden.id === focusedId) : undefined;
  const item =
    fromNav ??
    (itemProp && itemProp.orden.id === focusedId ? itemProp : null) ??
    pinned ??
    itemProp;

  const hermanos = item
    ? (navItems ?? []).filter((i) => claveVentaOt(i) === claveVentaOt(item))
    : [];
  const hermanosUsables = hermanos.length > 1 ? hermanos : [];
  const navPos = item ? hermanosUsables.findIndex((i) => i.orden.id === item.orden.id) : -1;
  const puedeNavegar = hermanosUsables.length > 1 && onNavChange != null && navPos >= 0;
  const hayAnterior = puedeNavegar && navPos > 0;
  const haySiguiente = puedeNavegar && navPos < hermanosUsables.length - 1;

  const irAHermano = useCallback(
    (dir: -1 | 1) => {
      const next = hermanosUsables[navPos + dir];
      if (!next || !navItems || !onNavChange) return;
      setPinned(next);
      setEtapaOverride(null);
      const idx = navItems.findIndex((i) => i.orden.id === next.orden.id);
      if (idx >= 0) onNavChange(idx);
    },
    [hermanosUsables, navPos, navItems, onNavChange],
  );

  useEffect(() => {
    if (!item || !open) return;
    setFechaLocal(fechaProgramadaInputValue(item.orden.fecha_programada));
    setMedidaItems([]);
    setSaldo(null);
    setLoadingExtra(true);
    const esBloqueada = Boolean(item.orden.bloqueada);
    const esPausada = Boolean(item.orden.pausada);
    setEstadoLocal(esBloqueada ? "bloqueada" : esPausada ? "pausada" : "activa");
    setNotaLocal(item.orden.notas ?? "");
    setMotivoLocal(item.orden.motivo_bloqueo ?? "");
    const ventaId = item.ventaId;
    const otId = item.orden.id;
    let cancelled = false;
    void (async () => {
      const [medidasRes, saldoRes] = await Promise.all([
        fetchMedidasOt(otId),
        mostrarSaldo ? getOtSaldoVenta(ventaId) : Promise.resolve({ data: null, error: null }),
      ]);
      if (cancelled) return;
      if (medidasRes.data) setMedidaItems(medidasRes.data.items);
      if (saldoRes.data) setSaldo(saldoRes.data);
      setLoadingExtra(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [item?.orden.id, open, mostrarSaldo, item?.ventaId]);

  useEffect(() => {
    if (!open || !puedeNavegar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) {
          return;
        }
        if (t.closest('[role="tablist"]')) return;
      }
      e.preventDefault();
      if (e.key === "ArrowLeft") irAHermano(-1);
      if (e.key === "ArrowRight") irAHermano(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, puedeNavegar, irAHermano]);

  const refresh = useCallback(() => {
    onChanged();
  }, [onChanged]);

  const onGuardarEstado = async () => {
    if (!item) return;
    setSavingEstado(true);
    const errores: string[] = [];

    const resNotas = await setOtNotas(item.orden.id, notaLocal.trim() || null);
    if (resNotas.error) errores.push(resNotas.error.message);

    if (estadoLocal === "bloqueada" && !item.orden.bloqueada) {
      const r = await setOtBloqueada(item.orden.id, motivoLocal.trim() || "Sin motivo especificado");
      if (r.error) errores.push(r.error.message);
    } else if (estadoLocal === "pausada" && !item.orden.pausada) {
      const r = await setOtPausada(item.orden.id, true);
      if (r.error) errores.push(r.error.message);
    } else if (estadoLocal === "activa") {
      if (item.orden.bloqueada) {
        const r = await setOtDesbloqueada(item.orden.id);
        if (r.error) errores.push(r.error.message);
      }
      if (item.orden.pausada) {
        const r = await setOtPausada(item.orden.id, false);
        if (r.error) errores.push(r.error.message);
      }
    }

    setSavingEstado(false);
    if (errores.length > 0) {
      toast.error(errores.join(" / "));
      return;
    }
    toast.success("Estado guardado.");
    refresh();
  };

  const piezasOt = useMemo(
    () =>
      medidaItems
        .filter((it) => it.muestraAlto || it.muestraAncho)
        .map((it) => ({
          label: it.articuloLabel || "Pieza",
          largoCm: parseDecimalInput(it.altoM) * 100,
          anchoCm: parseDecimalInput(it.anchoM) * 100,
        }))
        .filter((p) => p.largoCm > 0 && p.anchoCm > 0),
    [medidaItems],
  );

  if (!item) return null;

  const etapa = etapaOverride ?? coalesceEtapaOt(item.orden.etapa);
  const bloqueada = Boolean(item.orden.bloqueada);
  const pausada = Boolean(item.orden.pausada);
  const done = item.orden.estado === "done";
  const puedeMover = !bloqueada && !pausada && !done;
  const nextEtapa = siguienteEtapaOt(etapa);

  const estadoGuardado: EstadoOtLocal = bloqueada ? "bloqueada" : pausada ? "pausada" : "activa";
  const estadoOtDirty =
    estadoLocal !== estadoGuardado ||
    (notaLocal.trim() || "") !== (item.orden.notas ?? "").trim() ||
    (estadoLocal === "bloqueada" &&
      (motivoLocal.trim() || "") !== (item.orden.motivo_bloqueo ?? "").trim());

  const fechaGuardada = fechaProgramadaInputValue(item.orden.fecha_programada);
  const fechaDirty = fechaLocal !== fechaGuardada;

  const stockPendiente =
    Boolean(item.orden.requiere_reserva_stock) ||
    (Boolean(item.orden.bacha_requerida) && !item.orden.bacha_id);

  const onGuardarFecha = async () => {
    setSavingFecha(true);
    const res = await setOtFechaProgramada(item.orden.id, fechaLocal || null);
    setSavingFecha(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Fecha actualizada.");
    refresh();
  };

  const onAvanzar = async () => {
    setBusy(true);
    const res = await avanzarEtapaOt(item.orden.id);
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    const next = siguienteEtapaOt(etapa);
    if (next) setEtapaOverride(next);
    toast.success(next ? `Pasó a ${etiquetaEtapaKanban(next)}.` : "Etapa avanzada.");
    refresh();
  };

  const onEtapaSelect = async (value: EtapaOtId) => {
    if (value === etapa) return;
    setBusy(true);
    const res = await setEtapaOt(item.orden.id, value);
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    setEtapaOverride(value);
    toast.success(`Etapa: ${etiquetaEtapaKanban(value)}.`);
    refresh();
  };

  const onEntregar = async () => {
    setBusy(true);
    const res = await marcarOtEntregada(item.orden.id);
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("OT entregada.");
    onOpenChange(false);
    refresh();
  };

  const grupos = groupItemsByOrden(medidaItems);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[min(44rem,88vh)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-3.5 pr-12 text-left">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {item.orden.titulo}
                  </span>
                  {item.esReposicion ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-semibold uppercase tracking-wide border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200"
                    >
                      Reposición
                      {item.otOrigenTitulo ? ` · ${item.otOrigenTitulo}` : ""}
                    </Badge>
                  ) : null}
                  {done || bloqueada || pausada ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide",
                        done
                          ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"
                          : bloqueada
                            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                            : "border-gray-200 bg-gray-100 text-gray-600",
                      )}
                    >
                      {done ? "Entregada" : bloqueada ? "Bloqueada" : "Pausada"}
                    </Badge>
                  ) : null}
                  <UrgenciaBadge fechaProgramada={item.orden.fecha_programada} />
                </div>
                <DialogTitle className="text-lg font-bold leading-tight text-foreground">
                  {item.cliente}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Detalle de la orden de trabajo {item.orden.titulo}
                </DialogDescription>
              </div>
            {bloqueada && item.orden.motivo_bloqueo ? (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {item.orden.motivo_bloqueo}
              </div>
            ) : null}
          </DialogHeader>

          <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-2.5">
            <div className="min-w-0 flex-1">
              <OtEtapaStepper
                etapa={etapa}
                done={done}
                disabled={!puedeMover}
                busy={busy}
                motivoDisabled={
                  done
                    ? "OT entregada"
                    : bloqueada
                      ? "OT bloqueada"
                      : pausada
                        ? "OT pausada"
                        : undefined
                }
                onSelect={(e) => void onEtapaSelect(e)}
              />
            </div>
            {puedeNavegar ? (
              <div className="flex shrink-0 items-center gap-0.5 border-l border-border pl-3">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="h-8 w-8"
                  disabled={!hayAnterior}
                  aria-label="OT anterior de esta venta"
                  onClick={() => irAHermano(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span
                  className="min-w-[3.25rem] text-center text-[11px] tabular-nums text-muted-foreground"
                  title="Otras OTs de esta venta"
                >
                  {navPos + 1} / {hermanosUsables.length}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="h-8 w-8"
                  disabled={!haySiguiente}
                  aria-label="OT siguiente de esta venta"
                  onClick={() => irAHermano(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-3 border-b border-border bg-muted/20 px-5 py-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Material</p>
                  <p className="font-medium text-foreground">{item.materialLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ingreso</p>
                  <p className="font-medium tabular-nums text-foreground">
                    {formatFechaCorta(item.orden.creado_en)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Entrega</p>
                  {!done ? (
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <FechaInput
                        className="h-8 max-w-[11rem] text-xs"
                        value={fechaLocal}
                        onChange={setFechaLocal}
                      />
                      {fechaDirty ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={savingFecha}
                          onClick={() => void onGuardarFecha()}
                        >
                          Guardar
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="font-medium tabular-nums text-foreground">
                      {formatFechaCorta(item.orden.fecha_programada)}
                    </p>
                  )}
                </div>
              </div>
              <M2Comparacion item={item} />
              {item.direccionObra !== "—" ? (
                <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{item.direccionObra}</span>
                </div>
              ) : null}
              {loadingExtra ? (
                <p className="text-xs text-muted-foreground">Cargando piezas…</p>
              ) : medidaItems.length > 0 ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {grupos.flatMap((g, gi) =>
                    g.items.map((it, ii) => (
                      <li key={`${gi}-${ii}`} className="min-w-0">
                        <span className="font-medium text-foreground">{it.articuloLabel}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {it.m2Approx > 0
                            ? ` · ${formatMetraje(it.m2Approx)} m²`
                            : it.cantidad && it.cantidad !== "1"
                              ? ` · ×${it.cantidad}`
                              : ""}
                        </span>
                      </li>
                    )),
                  )}
                </ul>
              ) : null}
            </div>

            <Tabs key={item.orden.id} defaultValue="medidas" className="gap-0 px-5 py-3">
              <TabsList className="h-auto w-full flex-wrap justify-start">
                <TabsTrigger value="medidas" className="gap-1.5 text-xs">
                  <Ruler className="h-3.5 w-3.5" />
                  Medidas
                </TabsTrigger>
                <TabsTrigger value="stock" className="gap-1.5 text-xs">
                  <Layers className="h-3.5 w-3.5" />
                  Materiales y stock
                  {stockPendiente ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Pendiente" />
                  ) : null}
                </TabsTrigger>
                {!done ? (
                  <TabsTrigger value="estado" className="gap-1.5 text-xs">
                    Estado y notas
                  </TabsTrigger>
                ) : null}
                {mostrarSaldo ? (
                  <TabsTrigger value="cobros" className="gap-1.5 text-xs">
                    <Receipt className="h-3.5 w-3.5" />
                    Cobros
                  </TabsTrigger>
                ) : null}
              </TabsList>

              <TabsContent value="medidas" className="mt-3">
                <OtMedidasPanel
                  otId={item.orden.id}
                  destacado={etapa === "medicion" && !item.orden.medidas_confirmadas}
                  onSaved={refresh}
                />
              </TabsContent>

              <TabsContent value="stock" className="mt-3">
                <OtStockPanel
                  otId={item.orden.id}
                  materialHint={item.materialLabel}
                  piezas={piezasOt}
                  requiereReservaStock={Boolean(item.orden.requiere_reserva_stock)}
                  otTitulo={item.orden.titulo}
                  clienteNombre={item.cliente}
                  bachaRequerida={Boolean(item.orden.bacha_requerida)}
                  bachaOrigen={item.orden.bacha_origen}
                  bachaTipo={item.orden.bacha_tipo}
                  bachaColocacion={item.orden.bacha_colocacion}
                  bachaId={item.orden.bacha_id}
                  onChanged={refresh}
                />
              </TabsContent>

              {!done ? (
                <TabsContent value="estado" className="mt-3">
                  <div className="space-y-4 rounded-lg border border-border bg-muted/20 px-4 py-4">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Estado
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            {
                              id: "activa" as const,
                              label: "Activa",
                              on: "border-emerald-700 bg-emerald-700 text-white",
                            },
                            {
                              id: "bloqueada" as const,
                              label: "Bloqueada",
                              on: "border-red-700 bg-red-700 text-white",
                            },
                            {
                              id: "pausada" as const,
                              label: "Pausada",
                              on: "border-slate-600 bg-slate-600 text-white",
                            },
                          ] as const
                        ).map((opt) => {
                          const active = estadoLocal === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setEstadoLocal(opt.id)}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                                active
                                  ? opt.on
                                  : "border-border bg-background text-foreground hover:bg-muted",
                              )}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {estadoLocal === "bloqueada" ? (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Motivo del bloqueo
                        </Label>
                        <Textarea
                          rows={2}
                          className="resize-none text-sm"
                          placeholder="Ej. Falta seña, bacha del cliente, medidas incompletas…"
                          value={motivoLocal}
                          onChange={(e) => setMotivoLocal(e.target.value)}
                        />
                      </div>
                    ) : null}

                    <OtRoturaEstado
                      otId={item.orden.id}
                      etapa={etapa}
                      materialHint={item.materialLabel}
                      clienteNombre={item.cliente}
                      onChanged={refresh}
                      onPausada={() => setEstadoLocal("pausada")}
                      onReanudada={() => setEstadoLocal("activa")}
                    />

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3" />
                          Nota interna
                          <span className="normal-case font-normal text-muted-foreground/70">
                            (solo equipo, no se comparte)
                          </span>
                        </span>
                      </Label>
                      <Textarea
                        rows={2}
                        className="resize-none text-sm"
                        placeholder="Contexto para el historial — no lo ve el cliente"
                        value={notaLocal}
                        onChange={(e) => setNotaLocal(e.target.value)}
                      />
                    </div>

                    {estadoOtDirty ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={savingEstado}
                          onClick={() => {
                            setEstadoLocal(estadoGuardado);
                            setNotaLocal(item.orden.notas ?? "");
                            setMotivoLocal(item.orden.motivo_bloqueo ?? "");
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingEstado}
                          onClick={() => void onGuardarEstado()}
                        >
                          Guardar estado
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </TabsContent>
              ) : null}

              {mostrarSaldo ? (
                <TabsContent value="cobros" className="mt-3">
                  <div className="rounded-lg border border-border bg-muted/20 px-4 py-4">
                    {loadingExtra ? (
                      <p className="text-xs text-muted-foreground">Cargando…</p>
                    ) : saldo ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-2xl font-bold tabular-nums text-foreground">
                            {fmtMoneda(saldo.saldo, saldo.moneda)}
                          </p>
                          <div className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Total: {fmtMoneda(saldo.total, saldo.moneda)}</span>
                            <span>Cobrado: {fmtMoneda(saldo.cobrado, saldo.moneda)}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Progress value={saldo.pct} className="h-1.5" />
                          <p className="text-right text-[11px] text-muted-foreground">
                            {saldo.pct}% cobrado
                          </p>
                        </div>
                        {saldo.saldo > 0 && !done && item.presupuestoId ? (
                          <Button
                            type="button"
                            className="w-full"
                            onClick={() => setCobrosOpen(true)}
                          >
                            <Receipt className="mr-2 h-4 w-4" />
                            Registrar pago
                          </Button>
                        ) : null}
                        {saldo.saldo <= 0 ? (
                          <p className="text-center text-xs font-medium text-green-600 dark:text-green-400">
                            Venta cobrada en su totalidad
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sin información de cobros.</p>
                    )}
                  </div>
                </TabsContent>
              ) : null}
            </Tabs>
          </div>

          <div className="shrink-0 border-t border-border bg-background px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {mostrarRotulo ? (
                <div className="mr-auto flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      irARotulo(item.orden.id);
                    }}
                  >
                    <Printer className="mr-1 h-3.5 w-3.5" />
                    Rótulo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyPlanoId === item.orden.id}
                    onClick={() => void abrirPlano(item)}
                  >
                    <FileImage className="mr-1 h-3.5 w-3.5" />
                    Plano
                  </Button>
                </div>
              ) : null}
              {!done && nextEtapa ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={!puedeMover || busy}
                  onClick={() => void onAvanzar()}
                >
                  Pasar a {etiquetaTabDestino(nextEtapa)}
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              ) : permitirEntregar && !done && etapa === "despacho" ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={!puedeMover || busy}
                  onClick={() => void onEntregar()}
                >
                  Marcar entregada
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              ) : null}

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-xs text-muted-foreground"
                onClick={() => onOpenChange(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {mostrarSaldo && item.presupuestoId ? (
        <VentaCobrosDialog
          open={cobrosOpen}
          onOpenChange={setCobrosOpen}
          presupuestoId={item.presupuestoId}
          rowResumen={{
            cliente: item.cliente === "—" ? null : item.cliente,
            numero: item.presupuestoNumero,
            total: saldo?.total ?? null,
            moneda: saldo?.moneda ?? null,
            orden_trabajo_id: item.orden.id,
            ot_etapa: String(item.orden.etapa),
            ot_estado: item.orden.estado as JobStatus,
          }}
          onDatosCambiaron={async () => {
            refresh();
            const res = await getOtSaldoVenta(item.ventaId);
            if (res.data) setSaldo(res.data);
          }}
        />
      ) : null}
    </>
  );
}
