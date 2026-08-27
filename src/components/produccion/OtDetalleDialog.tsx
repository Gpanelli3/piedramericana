"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OtMedidasPanel } from "@/components/produccion/OtMedidasPanel";
import { VentaCobrosDialog } from "@/components/venta/VentaCobrosDialog";
import { OtStockPanel } from "@/components/produccion/OtStockPanel";
import { EtapaBadge, UrgenciaBadge, formatFechaCorta } from "@/components/produccion/ot-ui";
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
  type OtProduccionItem,
  type OtSaldoVenta,
} from "@/lib/produccion-api";
import { fetchMedidasOt, type MedidaItemEditable } from "@/lib/ot-medidas-api";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarIcon,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  Layers,
  MapPin,
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
};

const ETAPA_LABEL: Record<string, string> = {
  medicion: "Medición",
  corte: "Corte",
  produccion: "Producción",
  despacho: "Despacho",
};

function etapaLabel(e: string) {
  return ETAPA_LABEL[e] ?? e;
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

export function OtDetalleDialog({
  item,
  open,
  onOpenChange,
  onChanged,
  permitirEntregar = true,
}: Props) {
  const [fechaLocal, setFechaLocal] = useState("");
  const [savingFecha, setSavingFecha] = useState(false);
  const [busy, setBusy] = useState(false);

  const [medidaItems, setMedidaItems] = useState<MedidaItemEditable[]>([]);
  const [saldo, setSaldo] = useState<OtSaldoVenta | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);

  // Estado local del panel "Estado de la OT"
  type EstadoOtLocal = "activa" | "bloqueada" | "pausada";
  const [estadoLocal, setEstadoLocal] = useState<EstadoOtLocal>("activa");
  const [notaLocal, setNotaLocal] = useState("");
  const [motivoLocal, setMotivoLocal] = useState("");
  const [savingEstado, setSavingEstado] = useState(false);

  useEffect(() => {
    if (!item || !open) return;
    setFechaLocal(fechaProgramadaInputValue(item.orden.fecha_programada));
    setMedidaItems([]);
    setSaldo(null);
    setLoadingExtra(true);
    // Sincronizar estado local
    const esBloqueada = Boolean(item.orden.bloqueada);
    const esPausada = Boolean(item.orden.pausada);
    setEstadoLocal(esBloqueada ? "bloqueada" : esPausada ? "pausada" : "activa");
    setNotaLocal(item.orden.notas ?? "");
    setMotivoLocal(item.orden.motivo_bloqueo ?? "");
    void (async () => {
      const [medidasRes, saldoRes] = await Promise.all([
        fetchMedidasOt(item.orden.id),
        getOtSaldoVenta(item.ventaId),
      ]);
      if (medidasRes.data) setMedidaItems(medidasRes.data.items);
      if (saldoRes.data) setSaldo(saldoRes.data);
      setLoadingExtra(false);
    })();
  }, [item?.orden.id, open]);

  const refresh = useCallback(() => {
    onChanged();
  }, [onChanged]);

  const [cobrosOpen, setCobrosOpen] = useState(false);

  const onGuardarEstado = async () => {
    setSavingEstado(true);
    const errores: string[] = [];

    // 1. Guardar notas
    const resNotas = await setOtNotas(item!.orden.id, notaLocal.trim() || null);
    if (resNotas.error) errores.push(resNotas.error.message);

    // 2. Aplicar cambio de estado
    if (estadoLocal === "bloqueada" && !item!.orden.bloqueada) {
      const r = await setOtBloqueada(item!.orden.id, motivoLocal.trim() || "Sin motivo especificado");
      if (r.error) errores.push(r.error.message);
    } else if (estadoLocal === "pausada" && !item!.orden.pausada) {
      const r = await setOtPausada(item!.orden.id, true);
      if (r.error) errores.push(r.error.message);
    } else if (estadoLocal === "activa") {
      if (item!.orden.bloqueada) {
        const r = await setOtDesbloqueada(item!.orden.id);
        if (r.error) errores.push(r.error.message);
      }
      if (item!.orden.pausada) {
        const r = await setOtPausada(item!.orden.id, false);
        if (r.error) errores.push(r.error.message);
      }
    }

    setSavingEstado(false);
    if (errores.length > 0) { toast.error(errores.join(" / ")); return; }
    toast.success("Estado guardado.");
    refresh();
  };

  if (!item) return null;

  const etapa = coalesceEtapaOt(item.orden.etapa);
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

  const onGuardarFecha = async () => {
    setSavingFecha(true);
    const res = await setOtFechaProgramada(item.orden.id, fechaLocal || null);
    setSavingFecha(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Fecha actualizada.");
    refresh();
  };

  const onAvanzar = async () => {
    setBusy(true);
    const res = await avanzarEtapaOt(item.orden.id);
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Etapa avanzada.");
    refresh();
  };

  const onEtapaSelect = async (value: string) => {
    setBusy(true);
    const res = await setEtapaOt(item.orden.id, value as (typeof ETAPAS_OT_ORDEN)[number]);
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Etapa actualizada.");
    refresh();
  };

  const onEntregar = async () => {
    setBusy(true);
    const res = await marcarOtEntregada(item.orden.id);
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("OT entregada.");
    onOpenChange(false);
    refresh();
  };

  const grupos = groupItemsByOrden(medidaItems);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[min(36rem,78vh)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">

          {/* ─── HEADER ─── */}
          <DialogHeader className="shrink-0 border-b border-border px-5 py-3.5 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {item.orden.titulo}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wide",
                      done
                        ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"
                        : bloqueada
                          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                          : pausada
                            ? "border-gray-200 bg-gray-100 text-gray-600"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
                    )}
                  >
                    {done ? "Entregada" : bloqueada ? "Bloqueada" : pausada ? "Pausada" : "Activa"}
                  </Badge>
                </div>
                <DialogTitle className="text-lg font-bold leading-tight text-foreground">
                  {item.cliente}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
                  <EtapaBadge etapa={String(item.orden.etapa)} estado={item.orden.estado as JobStatus} />
                  <UrgenciaBadge fechaProgramada={item.orden.fecha_programada} />
                  <span className="text-muted-foreground">Pres. {item.presupuestoNumero}</span>
                </DialogDescription>
              </div>
            </div>
            {bloqueada && item.orden.motivo_bloqueo ? (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {item.orden.motivo_bloqueo}
              </div>
            ) : null}
          </DialogHeader>

          {/* ─── BODY: 2 columnas ─── */}
          <div className="flex min-h-0 flex-1 overflow-hidden">

            {/* Columna izquierda: ítems de la pieza */}
            <div className="flex w-52 shrink-0 flex-col border-r border-border bg-muted/20 sm:w-60">
              <p className="shrink-0 border-b border-border/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ítems{medidaItems.length > 0 ? ` (${medidaItems.length})` : ""}
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {loadingExtra ? (
                  <p className="px-3 py-4 text-xs text-muted-foreground">Cargando…</p>
                ) : medidaItems.length === 0 ? (
                  <div className="space-y-1 px-3 py-3">
                    <p className="text-xs font-medium text-foreground">{item.materialLabel}</p>
                    <p className="tabular-nums text-xs text-muted-foreground">{item.m2Display}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {grupos.map((g, gi) => (
                      <div key={gi} className="px-3 py-2.5 space-y-1.5">
                        {grupos.length > 1 ? (
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {g.ordenTitulo || `OT ${gi + 1}`}
                          </p>
                        ) : null}
                        {g.items.map((it, ii) => (
                          <div key={ii} className="space-y-0.5">
                            <p className="text-xs font-medium leading-snug text-foreground">
                              {it.articuloLabel}
                            </p>
                            <p className="tabular-nums text-[11px] text-muted-foreground">
                              {it.m2Approx > 0
                                ? `${it.m2Approx.toFixed(2)} m²`
                                : it.cantidad && it.cantidad !== "1"
                                  ? `×${it.cantidad}`
                                  : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Columna derecha: secciones accordion */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <Accordion type="multiple" defaultValue={[]} className="space-y-2">

                {/* Detalles y fechas */}
                <AccordionItem value="detalles" className="rounded-lg border border-border bg-muted/30 px-0 overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      Detalles y fechas
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3">
                      <div>
                        <p className="text-muted-foreground">Material</p>
                        <p className="font-medium text-foreground">{item.materialLabel}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">m²</p>
                        <p className="font-medium tabular-nums text-foreground">{item.m2Display}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ingreso</p>
                        <p className="font-medium tabular-nums text-foreground">
                          {formatFechaCorta(item.orden.creado_en)}
                        </p>
                      </div>
                    </div>
                    {item.direccionObra !== "—" ? (
                      <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{item.direccionObra}</span>
                      </div>
                    ) : null}
                    {!done ? (
                      <div className="mt-3 space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Fecha compromiso de entrega
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            className="h-8 max-w-[9rem] text-xs"
                            value={fechaLocal}
                            onChange={(e) => setFechaLocal(e.target.value)}
                          />
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
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-xs">
                        <p className="text-muted-foreground">Entrega comprometida</p>
                        <p className="font-medium">{formatFechaCorta(item.orden.fecha_programada)}</p>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Stock */}
                <AccordionItem value="stock" className="rounded-lg border border-border bg-muted/30 px-0 overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      Materiales / Stock
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <OtStockPanel
                      otId={item.orden.id}
                      materialHint={item.materialLabel}
                      requiereReservaStock={Boolean(item.orden.requiere_reserva_stock)}
                      onChanged={refresh}
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* Medidas */}
                <AccordionItem value="medidas" className="rounded-lg border border-border bg-muted/30 px-0 overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                      Medidas
                      {item.orden.medidas_confirmadas ? (
                        <Badge
                          variant="outline"
                          className="ml-1 border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                        >
                          Confirmadas
                        </Badge>
                      ) : null}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <OtMedidasPanel
                      otId={item.orden.id}
                      destacado={etapa === "medicion" && !item.orden.medidas_confirmadas}
                      onSaved={refresh}
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* Saldo de la venta */}
                <AccordionItem value="saldo" className="rounded-lg border border-border bg-muted/30 px-0 overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                      Saldo de la venta
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-0">
                    {loadingExtra ? (
                      <p className="text-xs text-muted-foreground">Cargando…</p>
                    ) : saldo ? (
                      <div className="space-y-3">
                        {/* Saldo prominente */}
                        <div>
                          <p className="text-2xl font-bold tabular-nums text-foreground">
                            {fmtMoneda(saldo.saldo, saldo.moneda)}
                          </p>
                          <div className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Total: {fmtMoneda(saldo.total, saldo.moneda)}</span>
                            <span>Cobrado: {fmtMoneda(saldo.cobrado, saldo.moneda)}</span>
                          </div>
                        </div>
                        {/* Barra de progreso */}
                        <div className="space-y-1">
                          <Progress value={saldo.pct} className="h-1.5" />
                          <p className="text-right text-[11px] text-muted-foreground">{saldo.pct}% cobrado</p>
                        </div>
                        {/* Botón registrar pago */}
                        {saldo.saldo > 0 && !done && item.presupuestoId && (
                          <Button
                            type="button"
                            className="w-full"
                            onClick={() => setCobrosOpen(true)}
                          >
                            <Receipt className="mr-2 h-4 w-4" />
                            Registrar pago
                          </Button>
                        )}
                        {saldo.saldo <= 0 && (
                          <p className="text-center text-xs font-medium text-green-600 dark:text-green-400">
                            ✓ Venta cobrada en su totalidad
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sin información de cobros.</p>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Estado de la OT */}
                {!done ? (
                  <AccordionItem value="estado" className="rounded-lg border border-border bg-muted/30 px-0 overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                      <span className="flex items-center gap-2">
                        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                        Estado de la OT
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-0">
                      <div className="space-y-4">
                        {/* Pills de estado */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Estado</p>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { id: "activa" as const, label: "Activa", on: "border-emerald-700 bg-emerald-700 text-white" },
                              { id: "bloqueada" as const, label: "Bloqueada", on: "border-red-700 bg-red-700 text-white" },
                              { id: "pausada" as const, label: "Pausada", on: "border-slate-600 bg-slate-600 text-white" },
                            ]).map((opt) => {
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

                        {/* Motivo del bloqueo (solo si bloqueada) */}
                        {estadoLocal === "bloqueada" && (
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
                        )}

                        {/* Nota interna */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <FileText className="h-3 w-3" />
                              Nota interna
                              <span className="normal-case font-normal text-muted-foreground/70">(solo equipo, no se comparte)</span>
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
                    </AccordionContent>
                  </AccordionItem>
                ) : null}

              </Accordion>
            </div>
          </div>

          {/* ─── FOOTER ─── */}
          <div className="shrink-0 border-t border-border bg-background px-4 py-2.5">
            <div className="flex items-center justify-end gap-2">
                {!done ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="sm" variant="outline" disabled={!puedeMover || busy}>
                        Cambiar etapa
                        <ChevronRight className="ml-1 h-3.5 w-3.5 rotate-90" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {ETAPAS_OT_ORDEN.map((e) => (
                        <DropdownMenuItem
                          key={e}
                          disabled={e === etapa}
                          onClick={() => void onEtapaSelect(e)}
                        >
                          {etapaLabel(e)}
                          {e === etapa ? " (actual)" : ""}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}

                {!done && nextEtapa ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!puedeMover || busy}
                    onClick={() => void onAvanzar()}
                  >
                    Pasar a {etapaLabel(nextEtapa)}
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

      {/* Diálogo de cobros – se abre sobre el diálogo principal */}
      {item.presupuestoId ? (
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
