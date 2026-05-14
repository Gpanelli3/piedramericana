"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Printer, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PresupuestoWizard } from "@/components/presupuesto/PresupuestoWizard";
import {
  PresupuestosLista,
  type PresupuestoFiltroTab,
} from "@/components/presupuesto/PresupuestosLista";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PresupuestoResumenInterior } from "@/components/presupuesto/PresupuestoResumenInterior";
import type { LineaResumenMoneda } from "@/components/presupuesto/PresupuestoResumenInterior";
import {
  listPresupuestosResumen,
  getPresupuestoById,
  patchPresupuestoStatus,
  approvePresupuestoWithVenta,
  type PresupuestoRowList,
} from "@/lib/presupuestos-api";
import {
  listPagosVenta,
  marcarVentaEntregado,
  registrarPagoSena,
  getVentaPorPresupuesto,
  ensureVentaForPresupuestoAprobado,
} from "@/lib/ventas-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isPresupuestoPayloadV1 } from "@/types/presupuesto-payload";
import type { Database, VentaEstado } from "@/types/database";

type PresupuestoRow = Database["public"]["Tables"]["presupuestos"]["Row"];

type VentasPagoRow = Database["public"]["Tables"]["ventas_pagos"]["Row"];

function formatoFechaCortaDb(s: string): string {
  try {
    const d =
      /\d{4}-\d{2}-\d{2}/.exec(s)?.[0] ?
        new Date(s.includes("T") ? s : `${s}T12:00:00`)
      : new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return s;
  }
}

function etiquetaEstadoVenta(e: VentaEstado): string {
  switch (e) {
    case "aprobado_sin_sena":
      return "Aprobado sin seña";
    case "senado":
      return "Con seña";
    case "en_produccion":
      return "En producción";
    case "finalizado":
      return "Finalizado";
    case "entregado":
      return "Entregado";
    default:
      return String(e);
  }
}

function parseTab(v: string | null): PresupuestoFiltroTab {
  if (v === "aprobados" || v === "rechazados" || v === "todos" || v === "pendientes") {
    return v;
  }
  return "pendientes";
}

export function VistaVentas() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const vista = searchParams.get("pv") === "nuevo" ? "wizard" : "lista";
  const tab = useMemo(() => parseTab(searchParams.get("ft")), [searchParams]);

  const [rows, setRows] = useState<PresupuestoRowList[]>([]);
  const [listaCargando, setListaCargando] = useState(true);

  const [resumenAbierto, setResumenAbierto] = useState(false);
  const [resumenCargando, setResumenCargando] = useState(false);
  const [filaResumen, setFilaResumen] = useState<PresupuestoRow | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const [ventaDialogPresetId, setVentaDialogPresetId] = useState<string | null>(null);
  const [ventaDialogAbierto, setVentaDialogAbierto] = useState(false);
  const [ventaDialogBusy, setVentaDialogBusy] = useState(false);
  const [ventaCabecera, setVentaCabecera] = useState<{ id: string; estado: VentaEstado } | null>(null);
  const [pagosVentas, setPagosVentas] = useState<VentasPagoRow[]>([]);
  const [pagoBusy, setPagoBusy] = useState(false);
  const [montoDigitado, setMontoDigitado] = useState("");
  const [pagoMoneda, setPagoMoneda] = useState<"ars" | "usd">("ars");
  const [pagoMetodo, setPagoMetodo] = useState("transferencia");
  const [pagoFecha, setPagoFecha] = useState("");
  const [pagoNota, setPagoNota] = useState("");

  const refreshLista = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRows([]);
      setListaCargando(false);
      return;
    }
    setListaCargando(true);
    const { data, error } = await listPresupuestosResumen();
    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setListaCargando(false);
  }, []);

  const cargarPanelVentas = useCallback(
    async (presupuestoId: string) => {
      setVentaDialogBusy(true);
      const en = await ensureVentaForPresupuestoAprobado(presupuestoId);
      if (en.error) toast.error(en.error.message);
      const vt = await getVentaPorPresupuesto(presupuestoId);
      if (vt.error || !vt.data) {
        toast.error(vt.error?.message ?? "No se pudo cargar la venta.");
        setPagosVentas([]);
        setVentaCabecera(null);
        setVentaDialogBusy(false);
        return;
      }
      const lp = await listPagosVenta(vt.data.id);
      setVentaCabecera({ id: vt.data.id, estado: vt.data.estado as VentaEstado });
      if (lp.error) {
        toast.error(lp.error.message);
        setPagosVentas([]);
      } else {
        setPagosVentas(lp.data ?? []);
      }
      setVentaDialogBusy(false);
      await refreshLista();
    },
    [refreshLista],
  );

  useEffect(() => {
    if (!ventaDialogAbierto || !ventaDialogPresetId || !isSupabaseConfigured) return;
    void cargarPanelVentas(ventaDialogPresetId);
  }, [ventaDialogAbierto, ventaDialogPresetId, cargarPanelVentas]);

  const abrirGestiónVentas = useCallback((presupuestoId: string) => {
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado.");
      return;
    }
    const row = rows.find((r) => r.id === presupuestoId);
    if (!row || row.status !== "aprobado") {
      toast.info("La gestión de ventas aplica sólo a presupuestos aprobados.");
      return;
    }
    const hoy = new Date().toISOString().slice(0, 10);
    setVentaDialogPresetId(presupuestoId);
    setPagoFecha(hoy);
    setPagoMoneda(row.moneda);
    setPagoMetodo("transferencia");
    setMontoDigitado("");
    setPagoNota("");
    setVentaDialogAbierto(true);
  }, [rows]);

  useEffect(() => {
    void refreshLista();
  }, [refreshLista]);

  const limpiarRid = useCallback(() => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete("rid");
        return n;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const abrirResumenPorId = useCallback(
    async (id: string) => {
      if (!isSupabaseConfigured) {
        toast.error("Supabase no está configurado.");
        return;
      }
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete("rid");
          return n;
        },
        { replace: true },
      );
      setResumenAbierto(true);
      setResumenCargando(true);
      setFilaResumen(null);
      const { data, error } = await getPresupuestoById(id);
      setResumenCargando(false);
      if (error || !data) {
        toast.error(error?.message ?? "No se pudo cargar el presupuesto.");
        setResumenAbierto(false);
        return;
      }
      setFilaResumen(data as PresupuestoRow);
    },
    [setSearchParams],
  );

  useEffect(() => {
    const rid = searchParams.get("rid");
    if (!rid) return;

    let cancelled = false;

    async function load(docId: string) {
      setResumenAbierto(true);
      setResumenCargando(true);
      setFilaResumen(null);
      const { data, error } = await getPresupuestoById(docId);
      if (cancelled) return;
      setResumenCargando(false);
      if (error || !data) {
        toast.error(error?.message ?? "No se encontró el presupuesto.");
        setResumenAbierto(false);
        limpiarRid();
        return;
      }
      setFilaResumen(data as PresupuestoRow);
    }

    void load(rid);

    return () => {
      cancelled = true;
    };
  }, [searchParams, limpiarRid]);

  const cerrarResumen = useCallback(() => {
    setResumenAbierto(false);
    setFilaResumen(null);
    limpiarRid();
  }, [limpiarRid]);

  const volverListado = useCallback(() => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("pv", "list");
        if (!n.get("ft")) n.set("ft", "pendientes");
        return n;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const persistidoDesdeWizard = useCallback(
    async ({ id, numero: _numero }: { id: string; numero: string }) => {
      void _numero;
      await refreshLista();
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("pv", "list");
          n.set("ft", "pendientes");
          n.set("rid", id);
          return n;
        },
        { replace: true },
      );
    },
    [refreshLista, setSearchParams],
  );

  const noopStr = useCallback((_v: string) => {}, []);
  const noopBool = useCallback((_v: boolean) => {}, []);
  const noopLinea = useCallback((_id: string, _patch: Partial<LineaResumenMoneda>) => {}, []);

  const payload = filaResumen?.payload != null ? filaResumen.payload : null;
  const resumenInterior = payload && isPresupuestoPayloadV1(payload);

  const onAprobar = useCallback(
    async (id: string) => {
      setStatusBusyId(id);
      const res = await approvePresupuestoWithVenta(id);
      setStatusBusyId(null);
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Presupuesto aprobado y venta registrada.");
      await refreshLista();
    },
    [refreshLista],
  );

  const onRegistrarPagoSena = useCallback(async () => {
    if (!ventaDialogPresetId || pagoBusy) return;
    const normalizado = montoDigitado.replace(",", ".").trim();
    const monto = Number(normalizado);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error("Ingresá un monto válido.");
      return;
    }
    setPagoBusy(true);
    const res = await registrarPagoSena({
      presupuestoId: ventaDialogPresetId,
      monto,
      moneda: pagoMoneda,
      fecha: pagoFecha,
      metodo: pagoMetodo || "Sin especificar",
      nota: pagoNota.trim() ? pagoNota.trim() : undefined,
      created_by: null,
    });
    setPagoBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Pago registrado.");
    setMontoDigitado("");
    setPagoNota("");
    await cargarPanelVentas(ventaDialogPresetId);
  }, [
    ventaDialogPresetId,
    pagoBusy,
    montoDigitado,
    pagoMoneda,
    pagoFecha,
    pagoMetodo,
    pagoNota,
    cargarPanelVentas,
  ]);

  const onMarcarVentaEntregada = useCallback(async () => {
    if (!ventaCabecera?.id || pagoBusy || !ventaDialogPresetId) return;
    setPagoBusy(true);
    const res = await marcarVentaEntregado(ventaCabecera.id);
    setPagoBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Venta marcada como entregada.");
    await cargarPanelVentas(ventaDialogPresetId);
  }, [ventaCabecera, pagoBusy, cargarPanelVentas, ventaDialogPresetId]);

  const onRechazar = useCallback(
    async (id: string) => {
      setStatusBusyId(id);
      const res = await patchPresupuestoStatus(id, "rechazado");
      setStatusBusyId(null);
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Presupuesto rechazado.");
      await refreshLista();
    },
    [refreshLista],
  );

  const ventaListaRow = useMemo(
    () => (ventaDialogPresetId ? rows.find((r) => r.id === ventaDialogPresetId) : undefined),
    [rows, ventaDialogPresetId],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border bg-white">
        <div className="px-8 pt-5 pb-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Home &rsaquo; Presupuestos</p>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Presupuestos</h1>
          </div>
          {vista === "wizard" ? (
            <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={volverListado}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Volver al listado
            </Button>
          ) : null}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-8 [scrollbar-gutter:stable]">
        {vista === "wizard" ? (
          <PresupuestoWizard onPersisted={persistidoDesdeWizard} />
        ) : (
          <PresupuestosLista
            loading={listaCargando}
            rows={rows}
            tab={tab}
            navigate={navigate}
            statusBusyId={statusBusyId}
            onVerResumen={(id) => void abrirResumenPorId(id)}
            onAprobar={onAprobar}
            onRechazar={onRechazar}
            onVentasGestión={(id) => abrirGestiónVentas(id)}
          />
        )}
      </main>

      <Dialog open={resumenAbierto} onOpenChange={(o) => !o && cerrarResumen()}>
        <DialogContent className="gap-0 p-0 sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden" showCloseButton>
          <DialogHeader className="border-b bg-muted/30 px-6 py-5 shrink-0 space-y-1">
            <DialogTitle className="text-xl font-bold tracking-tight">Resumen del presupuesto</DialogTitle>
            <DialogDescription>
              {filaResumen ? (
                <>
                  <span className="font-semibold text-foreground">{filaResumen.numero}</span>
                  {" · "}
                  {filaResumen.cliente}
                  {" · "}
                  Estado:{" "}
                  <span className="text-foreground">
                    {filaResumen.status === "pendiente"
                      ? "Pendiente"
                      : filaResumen.status === "aprobado"
                        ? "Aprobado"
                        : "Rechazado"}
                  </span>
                </>
              ) : (
                "—"
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-6">
            {!filaResumen || resumenCargando ? (
              <div className="text-sm text-muted-foreground py-10 text-center">Cargando…</div>
            ) : !resumenInterior ? (
              <div className="text-sm text-muted-foreground py-10 text-center">
                El detalle guardado no es compatible con esta vista de resumen.
              </div>
            ) : (
              <PresupuestoResumenInterior
                readOnly
                dolarHoy={payload.dolarHoy}
                cotizacionMixtaActiva={payload.cotizacionMixtaActiva}
                setCotizacionMixtaActiva={noopBool}
                lineasResumen={payload.lineasResumen}
                setLineaResumen={noopLinea}
                monedaFinal={payload.monedaFinal}
                setMonedaFinal={noopStr}
                totalUsdEquivalente={payload.totalUsdEquivalente}
                totalArsEquivalente={payload.totalArsEquivalente}
                materialM2Presupuesto={payload.materialM2Presupuesto}
                materialTonEstimadoPresupuesto={payload.materialTonEstimadoPresupuesto}
              />
            )}
          </div>
          <DialogFooter className="border-t px-6 py-4 gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2 print:hidden"
              disabled={!filaResumen}
              onClick={() => navigate(`/presupuestos/${filaResumen!.id}/imprimir`)}
            >
              <Printer className="h-4 w-4" />
              Vista de impresión
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={cerrarResumen}>
                Cerrar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ventaDialogAbierto}
        onOpenChange={(abierto) => {
          setVentaDialogAbierto(abierto);
          if (!abierto) setVentaDialogPresetId(null);
        }}
      >
        <DialogContent className="gap-5 sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Venta y cobros</DialogTitle>
            <DialogDescription className="space-y-2 text-left">
              {ventaListaRow ?
                <>
                  <span>
                    Presupuesto{" "}
                    <span className="font-semibold text-foreground">{ventaListaRow.numero}</span>
                    {" · "}
                    {ventaListaRow.cliente}
                  </span>
                  {ventaCabecera ?
                    <span className="block">
                      Estado venta:{" "}
                      <span className="font-medium text-foreground">
                        {etiquetaEstadoVenta(ventaCabecera.estado)}
                      </span>
                    </span>
                  : null}
                  {ventaListaRow.pct_sena_sobre_presupuesto != null ?
                    <span className="block text-xs tabular-nums">
                      Cobrado sobre total (misma moneda):{" "}
                      {ventaListaRow.pct_sena_sobre_presupuesto.toFixed(1)} % — saldo estimado según listado.
                    </span>
                  : null}
                </>
              : <span>Elegí un presupuesto desde el listado.</span>}
            </DialogDescription>
          </DialogHeader>

          {ventaDialogBusy ?
            <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p>
          : <>
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                <p className="font-semibold text-foreground">Registrar pago / seña</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pago-monto">Monto</Label>
                    <Input
                      id="pago-monto"
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={montoDigitado}
                      onChange={(e) => setMontoDigitado(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pago-fecha">Fecha</Label>
                    <Input id="pago-fecha" type="date" value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Moneda del pago</Label>
                    <Select value={pagoMoneda} onValueChange={(v) => setPagoMoneda(v as "ars" | "usd")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ars">ARS</SelectItem>
                        <SelectItem value="usd">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Método</Label>
                    <Select value={pagoMetodo} onValueChange={setPagoMetodo}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pago-nota">Nota (opcional)</Label>
                  <Textarea id="pago-nota" rows={2} value={pagoNota} onChange={(e) => setPagoNota(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="button" disabled={pagoBusy} onClick={() => void onRegistrarPagoSena()}>
                    Registrar pago
                  </Button>
                  {ventaCabecera?.estado === "finalizado" ?
                    <Button type="button" variant="outline" disabled={pagoBusy} onClick={() => void onMarcarVentaEntregada()}>
                      Marcar entregado
                    </Button>
                  : null}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Historial</p>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-3 text-xs">
                  {pagosVentas.length === 0 ?
                    <p className="text-muted-foreground">Sin pagos registrados.</p>
                  : pagosVentas.map((p) => {
                      const val = typeof p.monto === "string" ? parseFloat(p.monto) : Number(p.monto ?? 0);
                      const montoTxt = Number.isFinite(val) ?
                          p.moneda === "usd"
                            ? val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : Math.round(val).toLocaleString("es-AR")
                        : String(p.monto);
                      return (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/70 pb-2 last:border-none last:pb-0"
                        >
                          <span className="text-muted-foreground">{formatoFechaCortaDb(p.fecha)}</span>
                          <span className="font-medium tabular-nums text-foreground">
                            {montoTxt} {p.moneda.toUpperCase()}
                          </span>
                          <span className="text-muted-foreground">{p.metodo}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          }

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setVentaDialogAbierto(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
