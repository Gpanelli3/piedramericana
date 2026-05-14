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
import { AprobarPresupuestoDialog } from "@/components/presupuesto/AprobarPresupuestoDialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PresupuestoResumenInterior } from "@/components/presupuesto/PresupuestoResumenInterior";
import type { LineaResumenMoneda } from "@/components/presupuesto/PresupuestoResumenInterior";
import {
  listPresupuestosLista,
  getPresupuestoById,
  patchPresupuestoStatus,
  type PresupuestoRowLista,
} from "@/lib/presupuestos-api";
import { aprobarPresupuestoConVentaInicial } from "@/lib/ventas-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isPresupuestoPayloadV1 } from "@/types/presupuesto-payload";
import type { Database } from "@/types/database";

type PresupuestoRow = Database["public"]["Tables"]["presupuestos"]["Row"];

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

  const [rows, setRows] = useState<PresupuestoRowLista[]>([]);
  const [listaCargando, setListaCargando] = useState(true);

  const [resumenAbierto, setResumenAbierto] = useState(false);
  const [resumenCargando, setResumenCargando] = useState(false);
  const [filaResumen, setFilaResumen] = useState<PresupuestoRow | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const [aprobDialogAbierto, setAprobDialogAbierto] = useState(false);
  const [aprobDialogRow, setAprobDialogRow] = useState<PresupuestoRowLista | null>(null);
  const [aprobBusy, setAprobBusy] = useState(false);

  const refreshLista = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRows([]);
      setListaCargando(false);
      return;
    }
    setListaCargando(true);
    const { data, error } = await listPresupuestosLista();
    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setListaCargando(false);
  }, []);

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

  const iniciarAprobacion = useCallback(
    (id: string) => {
      const r = rows.find((x) => x.id === id);
      if (!r || r.status !== "pendiente") return;
      setAprobDialogRow(r);
      setAprobDialogAbierto(true);
    },
    [rows],
  );

  const onConfirmacionAprobar = useCallback(
    async (payload: {
      totalAprobado: number;
      montoSenia: number;
      fecha: string;
      metodo: string;
      nota: string;
    }) => {
      if (!aprobDialogRow) return;
      setAprobBusy(true);
      const res = await aprobarPresupuestoConVentaInicial({
        presupuestoId: aprobDialogRow.id,
        totalAprobado: payload.totalAprobado,
        montoSenia: payload.montoSenia,
        fecha: payload.fecha,
        metodo: payload.metodo,
        nota: payload.nota || undefined,
        created_by: null,
      });
      setAprobBusy(false);
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        payload.montoSenia > 0
          ? "Aprobado: venta creada con la seña indicada. El resto de cobros se gestiona en Ventas."
          : "Aprobado. Podés registrar la primera seña cuando quieras desde Ventas.",
      );
      setAprobDialogAbierto(false);
      setAprobDialogRow(null);
      await refreshLista();
    },
    [aprobDialogRow, refreshLista],
  );

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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border bg-white">
        <div className="px-8 pt-5 pb-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Home &rsaquo; Presupuestos</p>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Presupuestos</h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
              Al aprobás, definís total y seña inicial; los cobros adicionales están en{" "}
              <span className="font-medium text-foreground">Ventas</span> en el menú lateral.
            </p>
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
            onAprobar={async (id) => iniciarAprobacion(id)}
            onRechazar={onRechazar}
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

      <AprobarPresupuestoDialog
        open={aprobDialogAbierto}
        onOpenChange={(o) => {
          setAprobDialogAbierto(o);
          if (!o) setAprobDialogRow(null);
        }}
        row={
          aprobDialogRow ?
            {
              id: aprobDialogRow.id,
              numero: aprobDialogRow.numero,
              cliente: aprobDialogRow.cliente,
              total: aprobDialogRow.total,
              moneda: aprobDialogRow.moneda,
            }
          : null
        }
        busy={aprobBusy}
        onConfirm={onConfirmacionAprobar}
      />
    </div>
  );
}
