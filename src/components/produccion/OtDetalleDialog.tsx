"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { FechaInput } from "@/components/ui/fecha-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OtMedidasPanel } from "@/components/produccion/OtMedidasPanel";
import { OtRoturaEstado } from "@/components/produccion/OtRoturaEstado";
import { OtStockPanel } from "@/components/produccion/OtStockPanel";
import { UrgenciaBadge, formatFechaCorta } from "@/components/produccion/ot-ui";
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
import { avisoBachaPendiente, frenaAvancePorBacha } from "@/lib/bacha-reglas";
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
  MapPin,
  Printer,
} from "lucide-react";
import type { ReactNode } from "react";

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
  /** Reservado: el saldo se muestra siempre en Datos. */
  mostrarSaldo?: boolean;
  /** Botones de rótulo de taller y plano (Órdenes de Trabajo). */
  mostrarRotulo?: boolean;
};

type VistaOt = "resumen" | "medidas" | "stock" | "estado";

function DatoFila({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

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
  mostrarRotulo = false,
}: Props) {
  const { irARotulo, irAPlano } = useAccionesRotuloOt();
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
  const [editandoEstado, setEditandoEstado] = useState(false);
  const [pinned, setPinned] = useState<OtProduccionItem | null>(null);
  const [etapaOverride, setEtapaOverride] = useState<EtapaOtId | null>(null);
  const [vista, setVista] = useState<VistaOt>("resumen");

  useEffect(() => {
    if (!open) {
      setPinned(null);
      setEtapaOverride(null);
      setVista("resumen");
      setEditandoEstado(false);
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
      setVista("resumen");
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
    setEditandoEstado(false);
    const ventaId = item.ventaId;
    const otId = item.orden.id;
    let cancelled = false;
    void (async () => {
      const [medidasRes, saldoRes] = await Promise.all([
        fetchMedidasOt(otId),
        getOtSaldoVenta(ventaId),
      ]);
      if (cancelled) return;
      if (medidasRes.data) setMedidaItems(medidasRes.data.items);
      if (saldoRes.data) setSaldo(saldoRes.data);
      setLoadingExtra(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [item?.orden.id, open, item?.ventaId]);

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
    setEditandoEstado(false);
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
  const bachaPendiente = avisoBachaPendiente({
    bachaRequerida: Boolean(item.orden.bacha_requerida),
    bachaAsignada: Boolean(item.orden.bacha_id),
  });
  const frenaBacha = frenaAvancePorBacha({
    bachaRequerida: Boolean(item.orden.bacha_requerida),
    bachaAsignada: Boolean(item.orden.bacha_id),
    nextEtapa,
  });

  const estadoGuardado: EstadoOtLocal = bloqueada ? "bloqueada" : pausada ? "pausada" : "activa";
  const opcionesEstado = [
    { id: "activa" as const, label: "Activa", on: "border-emerald-700 bg-emerald-700 text-white" },
    { id: "bloqueada" as const, label: "Bloqueada", on: "border-red-700 bg-red-700 text-white" },
    { id: "pausada" as const, label: "Pausada", on: "border-slate-600 bg-slate-600 text-white" },
  ];
  const opcionEstado = opcionesEstado.find((o) => o.id === estadoLocal) ?? opcionesEstado[0];
  const cancelarEdicionEstado = () => {
    setEstadoLocal(estadoGuardado);
    setNotaLocal(item.orden.notas ?? "");
    setMotivoLocal(item.orden.motivo_bloqueo ?? "");
    setEditandoEstado(false);
  };
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(44rem,88vh)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-3.5 pr-12 text-left">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {item.orden.titulo}
                    {item.presupuestoNumero &&
                    !item.orden.titulo?.includes(item.presupuestoNumero)
                      ? ` · ${item.presupuestoNumero}`
                      : ""}
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
                {item.direccionObra !== "—" ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.direccionObra}</span>
                  </p>
                ) : null}
                <DialogDescription className="sr-only">
                  Detalle de la orden de trabajo {item.orden.titulo}
                </DialogDescription>
              </div>
            {bloqueada && item.orden.motivo_bloqueo ? (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {item.orden.motivo_bloqueo}
              </div>
            ) : bachaPendiente ? (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {bachaPendiente}. El corte sigue. Para pasar a producción hay que asignar la bacha.
              </div>
            ) : null}
          </DialogHeader>

          <div className="shrink-0 border-b border-border px-5 py-2.5">
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
                      : frenaBacha
                        ? bachaPendiente ?? "Bacha pendiente"
                        : undefined
              }
              onSelect={(e) => void onEtapaSelect(e)}
            />
          </div>

          <div className="flex shrink-0 items-stretch gap-2 border-b border-border pl-2 pr-3">
            <div
              role="tablist"
              className="flex min-w-0 flex-1 items-end overflow-x-auto overflow-y-hidden"
            >
              {(
                [
                  { id: "resumen" as const, label: "Resumen" },
                  { id: "medidas" as const, label: "Medidas" },
                  { id: "stock" as const, label: "Materiales y stock" },
                  ...(!done ? [{ id: "estado" as const, label: "Estado y notas" }] : []),
                ]
              ).map((sec) => {
                const activo = vista === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    role="tab"
                    aria-selected={activo}
                    onClick={() => setVista(sec.id)}
                    className={cn(
                      "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                      activo
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {sec.label}
                      {sec.id === "stock" && stockPendiente ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {mostrarRotulo ? (
              <div className="flex shrink-0 items-center gap-1.5 py-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => irARotulo(item.orden.id)}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Rótulo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => irAPlano(item.orden.id)}
                >
                  <FileImage className="h-3.5 w-3.5" />
                  Plano
                </Button>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {vista === "resumen" ? (
            <div className="px-5 py-4">
              <div className="grid gap-8 sm:grid-cols-2">
                <section className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Pieza
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h3 className="text-lg font-semibold leading-tight text-foreground">
                      {item.materialLabel}
                    </h3>
                    {item.m2Obra > 0 ? (
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatMetraje(item.m2Obra)} m²
                      </span>
                    ) : null}
                  </div>
                  {loadingExtra ? (
                    <p className="mt-3 text-xs text-muted-foreground">Cargando…</p>
                  ) : medidaItems.length > 0 ? (
                    <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-lg border border-border bg-background">
                      {grupos.flatMap((g, gi) =>
                        g.items.map((it, ii) => {
                          const tieneMedidas = it.muestraAlto || it.muestraAncho;
                          let medidaTexto = "";
                          if (tieneMedidas) {
                            const alto = parseDecimalInput(it.altoM);
                            const ancho = parseDecimalInput(it.anchoM);
                            if (alto > 0 && ancho > 0) {
                              medidaTexto = `${alto.toFixed(2)} × ${ancho.toFixed(2)} m`;
                            } else if (alto > 0) {
                              medidaTexto = `${alto.toFixed(2)} m`;
                            }
                          }

                          return (
                            <li
                              key={`${gi}-${ii}`}
                              className="px-3 py-2.5 text-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-foreground">
                                    {it.articuloLabel}
                                  </p>
                                  {medidaTexto ? (
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {medidaTexto}
                                    </p>
                                  ) : null}
                                </div>
                                <span className="shrink-0 tabular-nums text-muted-foreground">
                                  {it.m2Approx > 0
                                    ? `${formatMetraje(it.m2Approx)} m²`
                                    : it.cantidad
                                      ? `${it.cantidad} u`
                                      : "—"}
                                </span>
                              </div>
                            </li>
                          );
                        }),
                      )}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">Sin ítems cargados.</p>
                  )}
                </section>

                <section className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Datos
                  </p>
                  <dl className="mt-1 divide-y divide-border/70 text-sm">
                    <DatoFila label="Vendedor">
                      {item.vendedorLabel?.trim() || "—"}
                    </DatoFila>
                    <DatoFila label="Entrega comprometida">
                      {!done ? (
                        <div className="flex items-center justify-end gap-1.5">
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
                        <span className="tabular-nums">
                          {formatFechaCorta(item.orden.fecha_programada)}
                        </span>
                      )}
                    </DatoFila>
                    <DatoFila label="Saldo">
                      {loadingExtra ? (
                        "…"
                      ) : saldo ? (
                        <span
                          className={cn(
                            "tabular-nums",
                            saldo.saldo > 0
                              ? "text-amber-800 dark:text-amber-200"
                              : "text-emerald-700 dark:text-emerald-300",
                          )}
                        >
                          {fmtMoneda(saldo.saldo, saldo.moneda)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </DatoFila>
                  </dl>
                </section>
              </div>
            </div>
            ) : null}

            {vista === "medidas" ? (
              <div className="px-5 py-3">
                <OtMedidasPanel
                  otId={item.orden.id}
                  destacado={etapa === "medicion" && !item.orden.medidas_confirmadas}
                  onSaved={refresh}
                />
              </div>
            ) : null}

            {vista === "stock" ? (
              <div className="px-5 py-3">
                <OtStockPanel
                  otId={item.orden.id}
                  materialHint={item.materialLabel}
                  piezas={piezasOt}
                  requiereReservaStock={Boolean(item.orden.requiere_reserva_stock)}
                  otTitulo={item.orden.titulo}
                  clienteNombre={item.cliente}
                  clienteId={item.orden.id_cliente}
                  bachaRequerida={Boolean(item.orden.bacha_requerida)}
                  bachaOrigen={item.orden.bacha_origen}
                  bachaTipo={item.orden.bacha_tipo}
                  bachaColocacion={item.orden.bacha_colocacion}
                  bachaId={item.orden.bacha_id}
                  onChanged={refresh}
                />
              </div>
            ) : null}

            {vista === "estado" && !done ? (
                  <div className="space-y-4 px-5 py-3">
                  <div className="space-y-4 rounded-lg border border-border bg-muted/20 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Estado
                      </p>
                      {editandoEstado ? null : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditandoEstado(true)}
                        >
                          Editar
                        </Button>
                      )}
                    </div>

                    {editandoEstado ? (
                      <div className="grid grid-cols-3 gap-2">
                        {opcionesEstado.map((opt) => {
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
                    ) : (
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-3 py-1.5 text-sm font-medium",
                          opcionEstado.on,
                        )}
                      >
                        {opcionEstado.label}
                      </span>
                    )}

                    {estadoLocal === "bloqueada" ? (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Motivo del bloqueo
                        </Label>
                        {editandoEstado ? (
                          <Textarea
                            rows={2}
                            className="resize-none text-sm"
                            placeholder="Ej. Falta seña, bacha del cliente, medidas incompletas…"
                            value={motivoLocal}
                            onChange={(e) => setMotivoLocal(e.target.value)}
                          />
                        ) : (
                          <p className="text-sm text-foreground">
                            {motivoLocal.trim() || "Sin motivo"}
                          </p>
                        )}
                      </div>
                    ) : null}

                    <OtRoturaEstado
                      otId={item.orden.id}
                      etapa={etapa}
                      materialHint={item.materialLabel}
                      clienteNombre={item.cliente}
                      soloLectura={!editandoEstado}
                      onChanged={refresh}
                      onPausada={() => setEstadoLocal("pausada")}
                      onReanudada={() => setEstadoLocal("activa")}
                    />

                    <div className="space-y-1.5 border-t border-border pt-4">
                      <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Nota interna
                      </Label>
                      {editandoEstado ? (
                        <Textarea
                          rows={2}
                          className="resize-none text-sm"
                          placeholder="Contexto para el historial — no lo ve el cliente"
                          value={notaLocal}
                          onChange={(e) => setNotaLocal(e.target.value)}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-foreground">
                          {notaLocal.trim() || "Sin nota"}
                        </p>
                      )}
                    </div>

                    {editandoEstado ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={savingEstado}
                          onClick={cancelarEdicionEstado}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingEstado || !estadoOtDirty}
                          onClick={() => void onGuardarEstado()}
                        >
                          Guardar estado
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-border bg-background px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {puedeNavegar ? (
                <div className="flex items-center gap-0.5">
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
              ) : (
                <span />
              )}

              <div className="ml-auto flex flex-wrap items-center gap-2">
                {!done && nextEtapa ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!puedeMover || busy || frenaBacha}
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
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
  );
}
