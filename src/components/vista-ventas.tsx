"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PresupuestoWizard } from "@/components/presupuesto/PresupuestoWizard";
import {
  PresupuestosLista,
  type PresupuestoFiltroTab,
} from "@/components/presupuesto/PresupuestosLista";
import { PresupuestoDetallePanel } from "@/components/presupuesto/PresupuestoDetallePanel";
import { AprobarPresupuestoDialog } from "@/components/presupuesto/AprobarPresupuestoDialog";
import { ElegirChapaReemplazoDialog } from "@/components/presupuesto/ElegirChapaReemplazoDialog";
import type { ChapaReservaPendiente } from "@/lib/ventas-api";
import {
  listPresupuestosLista,
  eliminarPresupuestoPendiente,
  type PresupuestoRowLista,
} from "@/lib/presupuestos-api";
import { aprobarPresupuestoConVentaInicial } from "@/lib/ventas-api";
import { enviarAProduccionSiCorresponde } from "@/lib/produccion-api";
import { listarMedicionesPorPresupuestos } from "@/lib/medicion-api";
import type { MedicionEstado } from "@/lib/medicion-reglas";
import { isSupabaseConfigured } from "@/lib/supabase";

function parseTab(v: string | null): PresupuestoFiltroTab {
  if (v === "aprobados" || v === "todos" || v === "dormidos") return v;
  if (v === "pendientes") return "dormidos";
  return "todos";
}

export function VistaVentas() {
  const [searchParams, setSearchParams] = useSearchParams();

  const pv = searchParams.get("pv");
  const vista = pv === "nuevo" ? "wizard" : "lista";
  const editPresupuestoId = searchParams.get("id");
  const tab = useMemo(() => parseTab(searchParams.get("ft")), [searchParams]);

  const [rows, setRows] = useState<PresupuestoRowLista[]>([]);
  const [listaCargando, setListaCargando] = useState(true);
  const [medicionPorId, setMedicionPorId] = useState<Record<string, MedicionEstado>>({});

  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [detalleRefresh, setDetalleRefresh] = useState(0);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const [aprobDialogAbierto, setAprobDialogAbierto] = useState(false);
  const [aprobDialogRow, setAprobDialogRow] = useState<PresupuestoRowLista | null>(null);
  const [aprobBusy, setAprobBusy] = useState(false);
  const [chapasPendientes, setChapasPendientes] = useState<ChapaReservaPendiente[]>([]);
  const [reemplazoOpen, setReemplazoOpen] = useState(false);

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
      const ids = (data ?? []).map((r) => r.id);
      const med = await listarMedicionesPorPresupuestos(ids);
      if (!med.error) {
        const map: Record<string, MedicionEstado> = {};
        for (const [id, row] of med.data) map[id] = row.estado;
        setMedicionPorId(map);
      }
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
    (id: string) => {
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
      setDetalleId(id);
    },
    [setSearchParams],
  );

  useEffect(() => {
    const rid = searchParams.get("rid");
    if (!rid) return;
    setDetalleId(rid);
  }, [searchParams]);

  const cerrarResumen = useCallback(() => {
    setDetalleId(null);
    limpiarRid();
  }, [limpiarRid]);

  const persistidoDesdeWizard = useCallback(
    async ({ id, numero: _numero }: { id: string; numero: string }) => {
      void _numero;
      await refreshLista();
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("pv", "list");
          n.set("ft", "todos");
          n.set("rid", id);
          n.delete("id");
          return n;
        },
        { replace: true },
      );
    },
    [refreshLista, setSearchParams],
  );

  const irAEditar = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("pv", "nuevo");
          n.set("id", id);
          n.delete("rid");
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

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
      retencionPorcentaje?: number;
      retencionMonto?: number;
      comprobante?: File | null;
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
        retencionPorcentaje: payload.retencionPorcentaje,
        retencionMonto: payload.retencionMonto,
        comprobante: payload.comprobante,
      });
      setAprobBusy(false);
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      setAprobDialogAbierto(false);
      setAprobDialogRow(null);
      if (res.chapasPendientes && res.chapasPendientes.length > 0) {
        toast.warning("Algunas chapas señaladas ya no están disponibles. Elegí reemplazo.");
        setChapasPendientes(res.chapasPendientes);
        setReemplazoOpen(true);
      } else {
        toast.success(
          payload.montoSenia > 0
            ? "Aprobado con seña. Chapas señaladas reservadas si había stock."
            : "Aprobado. Podés registrar la primera seña cuando quieras desde Ventas.",
        );
      }
      if (payload.montoSenia > 0) {
        const envio = await enviarAProduccionSiCorresponde(aprobDialogRow.id);
        if (envio.error) toast.error(envio.error.message);
        else if (envio.enviado) toast.success("Ya tenía medidas: pasó a producción.");
      }
      await refreshLista();
      setDetalleRefresh((n) => n + 1);
    },
    [aprobDialogRow, refreshLista],
  );

  const onRechazar = useCallback(
    async (id: string) => {
      const row = rows.find((r) => r.id === id);
      const etiqueta = row ? `${row.numero} · ${row.cliente}` : "este presupuesto";
      if (
        !window.confirm(
          `¿Borrar ${etiqueta}?\nSale de medición y no queda historial.`,
        )
      ) {
        return;
      }
      setStatusBusyId(id);
      const res = await eliminarPresupuestoPendiente(id);
      setStatusBusyId(null);
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Presupuesto eliminado.");
      if (detalleId === id) cerrarResumen();
      await refreshLista();
    },
    [refreshLista, rows, detalleId, cerrarResumen],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      {vista === "wizard" ? null : (
        <header className="border-b border-border bg-white">
          <div className="px-5 pt-5 pb-5 sm:px-6">
            <h1 className="text-xl font-bold text-foreground tracking-tight" data-guia="modulo-titulo">Presupuestos</h1>
          </div>
        </header>
      )}

      <main className="flex flex-1 flex-col p-4 sm:p-6 [scrollbar-gutter:stable]">
        {vista === "wizard" ? (
          <PresupuestoWizard
            key={editPresupuestoId ?? "nuevo"}
            presupuestoId={editPresupuestoId}
            onPersisted={persistidoDesdeWizard}
          />
        ) : (
          <PresupuestosLista
            loading={listaCargando}
            rows={rows}
            tab={tab}
            onVerResumen={abrirResumenPorId}
            medicionPorId={medicionPorId}
          />
        )}
      </main>

      <PresupuestoDetallePanel
        open={Boolean(detalleId)}
        presupuestoId={detalleId}
        onClose={cerrarResumen}
        onEditar={irAEditar}
        onAprobar={iniciarAprobacion}
        onRechazar={onRechazar}
        statusBusy={Boolean(detalleId && statusBusyId === detalleId)}
        refreshKey={detalleRefresh}
      />

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

      <ElegirChapaReemplazoDialog
        open={reemplazoOpen}
        onOpenChange={(o) => {
          setReemplazoOpen(o);
          if (!o) setChapasPendientes([]);
        }}
        pendientes={chapasPendientes}
        onResuelto={async () => {
          setChapasPendientes([]);
          await refreshLista();
        }}
      />
    </div>
  );
}
