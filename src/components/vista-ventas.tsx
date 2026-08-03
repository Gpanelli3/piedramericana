"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Download, Pencil, Printer } from "lucide-react";
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
import { PresupuestoDocumento } from "@/components/presupuesto/PresupuestoDocumento";
import {
  listPresupuestosLista,
  getPresupuestoById,
  patchPresupuestoStatus,
  listArticulosConPrecios,
  listArticulos,
  type PresupuestoRowLista,
} from "@/lib/presupuestos-api";
import { listMaterials } from "@/lib/materials-api";
import { aprobarPresupuestoConVentaInicial } from "@/lib/ventas-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  hydratePresupuestoPayloadV1,
  isPresupuestoPayloadV1,
  type PresupuestoPayloadV1,
} from "@/types/presupuesto-payload";
import type { Database } from "@/types/database";
import type { ArticuloConPrecio } from "@/types/articulos";
import type { MaterialWizardRow } from "@/types/material-catalog";
import { ORIGEN_VENTA_OPCIONES } from "@/data/origen-venta";
import { parseMoneyInput, mecAlgunoActivo } from "@/components/presupuesto/wizard/validacion";

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

  const pv = searchParams.get("pv");
  const vista = pv === "nuevo" ? "wizard" : "lista";
  const editPresupuestoId = searchParams.get("id");
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

  const [docArticulos, setDocArticulos] = useState<ArticuloConPrecio[]>([]);
  const [docMaterials, setDocMaterials] = useState<MaterialWizardRow[]>([]);
  const [docCatalogoCargando, setDocCatalogoCargando] = useState(false);

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
    setDocArticulos([]);
    setDocMaterials([]);
    limpiarRid();
  }, [limpiarRid]);

  const payloadRaw = filaResumen?.payload != null ? filaResumen.payload : null;
  const payload: PresupuestoPayloadV1 | null =
    payloadRaw && isPresupuestoPayloadV1(payloadRaw)
      ? hydratePresupuestoPayloadV1(payloadRaw)
      : null;

  useEffect(() => {
    if (!filaResumen || !resumenAbierto) return;
    const raw = filaResumen.payload;
    if (!raw || !isPresupuestoPayloadV1(raw)) {
      setDocArticulos([]);
      setDocMaterials([]);
      return;
    }
    const listaId = raw.listaPrecioId;
    let cancelled = false;
    async function loadCatalogo() {
      setDocCatalogoCargando(true);
      const [artsRes, matsRes] = await Promise.all([
        listaId ? listArticulosConPrecios(listaId) : listArticulos(),
        listMaterials(),
      ]);
      if (cancelled) return;
      if (artsRes.error || !artsRes.data) {
        const plain = await listArticulos();
        if (!cancelled) setDocArticulos(plain.data ?? []);
      } else {
        setDocArticulos(artsRes.data);
      }
      setDocMaterials(matsRes.data ?? []);
      setDocCatalogoCargando(false);
    }
    void loadCatalogo();
    return () => {
      cancelled = true;
    };
  }, [filaResumen, resumenAbierto]);

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

  const descargarPdf = useCallback(
    (id: string) => {
      navigate(`/presupuestos/${id}/imprimir?descargar=1`);
    },
    [navigate],
  );

  const origenLabelResumen = useMemo(() => {
    if (!payload) return "";
    return (
      ORIGEN_VENTA_OPCIONES.find((o) => o.value === payload.origenVentas)?.label ??
      payload.origenVentas
    );
  }, [payload]);

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
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white">
        <div className="px-8 pt-5 pb-5">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Presupuestos</h1>
        </div>
      </header>

      <main className="p-8 [scrollbar-gutter:stable]">
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
            navigate={navigate}
            statusBusyId={statusBusyId}
            onVerResumen={(id) => void abrirResumenPorId(id)}
            onEditar={irAEditar}
            onDescargarPdf={descargarPdf}
            onAprobar={async (id) => iniciarAprobacion(id)}
            onRechazar={onRechazar}
          />
        )}
      </main>

      <Dialog open={resumenAbierto} onOpenChange={(o) => !o && cerrarResumen()}>
        <DialogContent
          className="gap-0 p-0 sm:max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
          showCloseButton
        >
          <DialogHeader className="border-b bg-muted/30 px-5 py-4 shrink-0 space-y-1 print:hidden">
            <DialogTitle className="text-lg font-bold tracking-tight">
              Resumen del presupuesto
            </DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {filaResumen ? (
                  <>
                    <span className="font-semibold text-foreground tabular-nums">
                      {filaResumen.numero}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-foreground">{filaResumen.cliente}</span>
                    <span className="text-muted-foreground">·</span>
                    <span
                      className={
                        filaResumen.status === "pendiente"
                          ? "text-amber-800"
                          : filaResumen.status === "aprobado"
                            ? "text-emerald-800"
                            : "text-rose-800"
                      }
                    >
                      {filaResumen.status === "pendiente"
                        ? "Pendiente"
                        : filaResumen.status === "aprobado"
                          ? "Aprobado"
                          : "Rechazado"}
                    </span>
                  </>
                ) : (
                  <span>—</span>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-4 py-5 sm:px-6 bg-neutral-100/80 print:bg-white print:p-0">
            {!filaResumen || resumenCargando || docCatalogoCargando ? (
              <div className="text-sm text-muted-foreground py-10 text-center">
                Cargando…
              </div>
            ) : !payload ? (
              <div className="text-sm text-muted-foreground py-10 text-center">
                El detalle guardado no es compatible con esta vista de resumen.
              </div>
            ) : (
              <PresupuestoDocumento
                numero={filaResumen.numero}
                fecha={new Date(filaResumen.created_at).toLocaleDateString("es-AR")}
                clienteNombre={payload.clienteNombre || filaResumen.cliente}
                contacto={payload.contacto}
                tel={payload.tel}
                email={payload.email}
                direccion={payload.direccion}
                observacion={payload.obsCabecera}
                origenLabel={origenLabelResumen}
                moneda={payload.monedaPresupuesto}
                ordenes={payload.ordenes}
                articulos={docArticulos}
                materials={docMaterials}
                descuentoPct={parseMoneyInput(payload.descuentoGlobalPct)}
                mMedicion={payload.mMedicionGlobal}
                mEntrega={payload.mEntregaGlobal}
                mColocacion={payload.mColocacionGlobal}
                totalMec={
                  mecAlgunoActivo(
                    payload.mMedicionGlobal,
                    payload.mEntregaGlobal,
                    payload.mColocacionGlobal,
                  )
                    ? parseMoneyInput(payload.totalMecGlobal)
                    : 0
                }
                obsMec={payload.obsServiciosMec}
                className="mx-auto max-w-3xl bg-white p-4 sm:p-5 shadow-sm border border-neutral-200 print:shadow-none print:border-0 print:p-0"
              />
            )}
          </div>
          <DialogFooter className="border-t bg-background px-4 py-3 sm:px-5 print:hidden sm:justify-between gap-3">
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                className="order-last sm:order-first"
                onClick={cerrarResumen}
              >
                Cerrar
              </Button>
            </DialogClose>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {filaResumen?.status === "pendiente" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    const id = filaResumen.id;
                    cerrarResumen();
                    irAEditar(id);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled={!filaResumen}
                onClick={() => navigate(`/presupuestos/${filaResumen!.id}/imprimir`)}
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              <Button
                type="button"
                className="gap-1.5"
                disabled={!filaResumen}
                onClick={() => descargarPdf(filaResumen!.id)}
              >
                <Download className="h-4 w-4" />
                Descargar PDF
              </Button>
            </div>
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
