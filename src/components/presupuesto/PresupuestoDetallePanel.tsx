"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Paperclip,
  Pencil,
  Printer,
  Send,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PresupuestoDocumento } from "@/components/presupuesto/PresupuestoDocumento";
import { HojaDeTrabajoDocumento } from "@/components/presupuesto/HojaDeTrabajoDocumento";
import {
  getPresupuestoById,
  getPresupuestoVersion,
  getPresupuestoVinculos,
  listArticulos,
  listArticulosConPrecios,
  listPresupuestoVersiones,
  type PresupuestoVersionLista,
} from "@/lib/presupuestos-api";
import { listMaterials } from "@/lib/materials-api";
import {
  etiquetaEventoPrecio,
  listEventosPrecio,
  registrarEventoPrecio,
  type PresupuestoEventoPrecio,
} from "@/lib/presupuesto-eventos-api";
import {
  etiquetaTipoArchivo,
  getPlanoSignedUrl,
  listPlanosByPresupuesto,
  removePlano,
  uploadPlanoPresupuesto,
  type ArchivoPresupuesto,
} from "@/lib/presupuesto-planos-storage";
import {
  hydratePresupuestoPayloadV1,
  isPresupuestoPayloadV1,
  type PresupuestoPayloadV1,
} from "@/types/presupuesto-payload";
import type { Database, VentaEstado } from "@/types/database";
import type { ArticuloConPrecio } from "@/types/articulos";
import type { MaterialWizardRow } from "@/types/material-catalog";
import { ORIGEN_VENTA_OPCIONES } from "@/data/origen-venta";
import { parseMoneyInput } from "@/components/presupuesto/wizard/validacion";
import {
  etiquetaVersionPresupuesto,
  importeMecPresupuesto,
} from "@/lib/presupuesto-calculos";
import {
  buildPresupuestoDetalleVista,
  formatBytes,
  formatFechaHora,
  formatFechaLarga,
  formatMetrajeDetalle,
  formatMoneyAr,
  formatMoneyCard,
} from "@/lib/presupuesto-detalle";
import { descargarElementoComoPdf } from "@/lib/descargar-pdf";
import { cn } from "@/lib/utils";
import { etiquetaMetodo } from "@/lib/finanzas-api";
import { chipClaseEtapaOt, etiquetaEtapaOt } from "@/lib/etiquetas-ot";
import { etiquetaVentaEstado, formatFechaCorta } from "@/components/produccion/ot-ui";
import {
  getVentaPorPresupuesto,
  listOtsPorVenta,
  listPagosVenta,
  type OtPanelResumen,
} from "@/lib/ventas-api";

type PresupuestoRow = Database["public"]["Tables"]["presupuestos"]["Row"];

type Props = {
  open: boolean;
  presupuestoId: string | null;
  onClose: () => void;
  onEditar: (id: string) => void;
  onAprobar: (id: string) => void;
  onRechazar: (id: string) => Promise<void>;
  statusBusy?: boolean;
  refreshKey?: number;
};

type DocVista = "pdf" | "hoja" | null;
type SeccionPanel = "presupuesto" | "venta" | "ots";

export function PresupuestoDetallePanel({
  open,
  presupuestoId,
  onClose,
  onEditar,
  onAprobar,
  onRechazar,
  statusBusy = false,
  refreshKey = 0,
}: Props) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docPdfRef = useRef<HTMLDivElement>(null);
  const docHojaRef = useRef<HTMLDivElement>(null);

  const [cargando, setCargando] = useState(false);
  const [fila, setFila] = useState<PresupuestoRow | null>(null);
  const [versiones, setVersiones] = useState<PresupuestoVersionLista[]>([]);
  const [viendoNro, setViendoNro] = useState<number | null>(null);
  const [payloadHistorico, setPayloadHistorico] = useState<PresupuestoPayloadV1 | null>(null);
  const [historicoCargando, setHistoricoCargando] = useState(false);
  const [articulos, setArticulos] = useState<ArticuloConPrecio[]>([]);
  const [materials, setMaterials] = useState<MaterialWizardRow[]>([]);
  const [eventos, setEventos] = useState<PresupuestoEventoPrecio[]>([]);
  const [archivos, setArchivos] = useState<ArchivoPresupuesto[]>([]);
  const [ventaId, setVentaId] = useState<string | null>(null);
  const [otsCount, setOtsCount] = useState(0);
  const [seccion, setSeccion] = useState<SeccionPanel>("presupuesto");
  const [docVista, setDocVista] = useState<DocVista>(null);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [marcandoEnvio, setMarcandoEnvio] = useState(false);

  const recargarEventosYArchivos = useCallback(async (id: string) => {
    const [ev, ar] = await Promise.all([listEventosPrecio(id), listPlanosByPresupuesto(id)]);
    if (!ev.error) setEventos(ev.data);
    if (!ar.error) setArchivos(ar.data);
  }, []);

  useEffect(() => {
    if (!open || !presupuestoId) {
      setFila(null);
      setVersiones([]);
      setViendoNro(null);
      setPayloadHistorico(null);
      setEventos([]);
      setArchivos([]);
      setVentaId(null);
      setOtsCount(0);
      setSeccion("presupuesto");
      setDocVista(null);
      return;
    }

    let cancelled = false;
    async function load(id: string) {
      setCargando(true);
      setSeccion("presupuesto");
      setViendoNro(null);
      setPayloadHistorico(null);
      const [pres, vers, vinc] = await Promise.all([
        getPresupuestoById(id),
        listPresupuestoVersiones(id),
        getPresupuestoVinculos(id),
      ]);
      if (cancelled) return;
      if (pres.error || !pres.data) {
        toast.error(pres.error?.message ?? "No se pudo cargar el presupuesto.");
        setCargando(false);
        onClose();
        return;
      }
      const row = pres.data as PresupuestoRow;
      setFila(row);
      setVersiones(vers.data ?? []);
      setVentaId(vinc.ventaId);
      setOtsCount(vinc.otsCount);

      const raw = row.payload;
      const listaId =
        raw && typeof raw === "object" && "listaPrecioId" in raw
          ? String((raw as { listaPrecioId?: unknown }).listaPrecioId ?? "")
          : "";
      const [artsRes, matsRes] = await Promise.all([
        listaId ? listArticulosConPrecios(listaId) : listArticulos(),
        listMaterials(),
        recargarEventosYArchivos(id),
      ]);
      if (cancelled) return;
      if (artsRes.error || !artsRes.data) {
        const plain = await listArticulos();
        if (!cancelled) setArticulos(plain.data ?? []);
      } else {
        setArticulos(artsRes.data);
      }
      setMaterials(matsRes.data ?? []);
      setCargando(false);
    }

    void load(presupuestoId);
    return () => {
      cancelled = true;
    };
  }, [open, presupuestoId, refreshKey, onClose, recargarEventosYArchivos]);

  const payloadRaw = fila?.payload != null ? fila.payload : null;
  const payloadVigente: PresupuestoPayloadV1 | null =
    payloadRaw && isPresupuestoPayloadV1(payloadRaw)
      ? hydratePresupuestoPayloadV1(payloadRaw)
      : null;
  const payload: PresupuestoPayloadV1 | null =
    viendoNro != null && payloadHistorico ? payloadHistorico : payloadVigente;

  const nroVigente = fila?.nro_version ?? 1;
  const vista = useMemo(
    () =>
      payload ? buildPresupuestoDetalleVista({ payload, articulos, materials }) : null,
    [payload, articulos, materials],
  );

  const origenLabel = useMemo(() => {
    if (!payload) return "";
    return (
      ORIGEN_VENTA_OPCIONES.find((o) => o.value === payload.origenVentas)?.label ??
      payload.origenVentas
    );
  }, [payload]);

  const enviadoEvento = eventos.find((e) => e.tipo === "enviado_pdf") ?? null;
  const eventosMostrados: PresupuestoEventoPrecio[] = useMemo(() => {
    if (eventos.length > 0) return eventos;
    if (!fila) return [];
    return [
      {
        id: "synthetic-primer",
        presupuesto_id: fila.id,
        tipo: "primer_precio",
        monto: vista?.total ?? fila.total,
        moneda: payload?.monedaPresupuesto ?? fila.moneda,
        created_at: fila.created_at,
        created_by: fila.created_by,
        created_by_nombre: payload?.vendedorNombre ?? null,
        meta: {},
      },
    ];
  }, [eventos, fila, payload?.vendedorNombre, payload?.monedaPresupuesto, vista?.total]);

  const planosOt: ArchivoPresupuesto[] = useMemo(() => {
    if (!payload) return [];
    const out: ArchivoPresupuesto[] = [];
    for (const ot of payload.ordenes) {
      const p = ot.planoAdjunto;
      if (!p?.storagePath) continue;
      out.push({
        name: p.name,
        mime: p.mime,
        storagePath: p.storagePath,
        size: p.size,
        createdAt: fila?.created_at ?? new Date().toISOString(),
        tipo: "plano",
      });
    }
    return out;
  }, [payload, fila?.created_at]);

  const archivosTodos = useMemo(() => {
    const seen = new Set(archivos.map((a) => a.storagePath));
    return [...archivos, ...planosOt.filter((p) => !seen.has(p.storagePath))];
  }, [archivos, planosOt]);

  const verVersion = useCallback(
    async (nro: number) => {
      if (!fila) return;
      if (nro === nroVigente) {
        setViendoNro(null);
        setPayloadHistorico(null);
        return;
      }
      setHistoricoCargando(true);
      const res = await getPresupuestoVersion(fila.id, nro);
      setHistoricoCargando(false);
      if (res.error || !res.data) {
        toast.error(res.error?.message ?? "No se encontró esa versión.");
        return;
      }
      setPayloadHistorico(res.data.payload);
      setViendoNro(nro);
    },
    [fila, nroVigente],
  );

  const compartir = useCallback(async () => {
    if (!fila) return;
    const url = `${window.location.origin}/?ws=ventas&rid=${fila.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link de la obra copiado.");
    } catch {
      toast.error("No se pudo copiar el link.");
    }
  }, [fila]);

  const marcarEnviadoHoy = useCallback(async () => {
    if (!fila) return;
    setMarcandoEnvio(true);
    const res = await registrarEventoPrecio({
      presupuestoId: fila.id,
      tipo: "enviado_pdf",
      monto: fila.total,
      moneda: fila.moneda,
    });
    setMarcandoEnvio(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Marcado como enviado hoy.");
    await recargarEventosYArchivos(fila.id);
  }, [fila, recargarEventosYArchivos]);

  const registrarEnvioPdf = useCallback(async () => {
    if (!fila) return;
    await registrarEventoPrecio({
      presupuestoId: fila.id,
      tipo: "enviado_pdf",
      monto: fila.total,
      moneda: fila.moneda,
    });
    await recargarEventosYArchivos(fila.id);
  }, [fila, recargarEventosYArchivos]);

  const descargarDoc = useCallback(async () => {
    const el = docVista === "hoja" ? docHojaRef.current : docPdfRef.current;
    if (!el || !fila) {
      toast.error("El documento todavía no está listo.");
      return;
    }
    const ver = viendoNro != null ? `_V${viendoNro}` : "";
    const base =
      docVista === "hoja"
        ? `Hoja_trabajo_${fila.numero}${ver}`
        : `Presupuesto_${fila.numero}${ver}`;
    setDescargandoPdf(true);
    try {
      await descargarElementoComoPdf(el, base);
      if (docVista === "pdf") await registrarEnvioPdf();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF.");
    } finally {
      setDescargandoPdf(false);
    }
  }, [docVista, fila, viendoNro, registrarEnvioPdf]);

  const onSubirArchivo = useCallback(
    async (file: File | undefined) => {
      if (!file || !fila) return;
      setSubiendo(true);
      const res = await uploadPlanoPresupuesto({ presupuestoId: fila.id, file });
      setSubiendo(false);
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Archivo subido.");
      await recargarEventosYArchivos(fila.id);
    },
    [fila, recargarEventosYArchivos],
  );

  const verArchivo = useCallback(async (path: string) => {
    const res = await getPlanoSignedUrl(path);
    if (res.error || !res.url) {
      toast.error(res.error?.message ?? "No se pudo abrir el archivo.");
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }, []);

  const borrarArchivo = useCallback(
    async (archivo: ArchivoPresupuesto) => {
      if (archivo.storagePath.startsWith("planos/")) {
        toast.error("Este plano está adjunto a una OT. Editá el presupuesto para quitarlo.");
        return;
      }
      if (!window.confirm(`¿Eliminar ${archivo.name}?`)) return;
      const res = await removePlano(archivo.storagePath);
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Archivo eliminado.");
      if (fila) await recargarEventosYArchivos(fila.id);
    },
    [fila, recargarEventosYArchivos],
  );

  const pendiente = fila?.status === "pendiente";
  const aprobado = fila?.status === "aprobado";
  const otsAGenerar = payload?.ordenes.filter((o) => o.titulo.trim() || o.items.length > 0).length ?? 0;
  const nroMostrado = viendoNro ?? nroVigente;

  return (
      <Sheet
        open={open}
        onOpenChange={(o) => {
          if (!o && descargandoPdf) return;
          if (!o && docVista) {
            setDocVista(null);
            return;
          }
          if (!o) onClose();
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-xl lg:max-w-2xl overflow-hidden bg-stone-50"
          onInteractOutside={(e) => {
            if (descargandoPdf) e.preventDefault();
          }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Detalle del presupuesto</SheetTitle>
            <SheetDescription>Ficha completa del presupuesto.</SheetDescription>
          </SheetHeader>

          <div className="flex items-center justify-center gap-1 px-4 pr-12 pt-3 pb-1 shrink-0">
            <button
              type="button"
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold",
                seccion === "presupuesto"
                  ? "bg-zinc-900 text-white"
                  : "font-medium text-muted-foreground hover:bg-muted",
              )}
              onClick={() => setSeccion("presupuesto")}
            >
              Presupuesto {fila?.numero ?? "…"}
            </button>
            {ventaId ? (
              <button
                type="button"
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium",
                  seccion === "venta"
                    ? "bg-zinc-900 font-semibold text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => {
                  setDocVista(null);
                  setSeccion("venta");
                }}
              >
                Venta
              </button>
            ) : null}
            {otsCount > 0 ? (
              <button
                type="button"
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium",
                  seccion === "ots"
                    ? "bg-zinc-900 font-semibold text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => {
                  setDocVista(null);
                  setSeccion("ots");
                }}
              >
                OTs {otsCount}
              </button>
            ) : null}
          </div>

          <div className="overflow-y-auto px-5 pb-5 pt-2 space-y-5">
            {seccion === "venta" && fila ? (
              <SeccionVenta presupuestoId={fila.id} total={fila.total} moneda={fila.moneda} />
            ) : seccion === "ots" && ventaId ? (
              <SeccionOts ventaId={ventaId} />
            ) : cargando || historicoCargando || !fila ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>
            ) : !payload || !vista ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                El detalle guardado no es compatible con esta vista.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-bold tabular-nums tracking-tight">{fila.numero}</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800"
                          >
                            V{nroMostrado} {viendoNro == null ? "activa" : ""}
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => void verVersion(nroVigente)}>
                            {etiquetaVersionPresupuesto(nroVigente)} · vigente
                          </DropdownMenuItem>
                          {versiones
                            .filter((v) => v.nro !== nroVigente)
                            .map((v) => (
                              <DropdownMenuItem key={v.id} onClick={() => void verVersion(v.nro)}>
                                {etiquetaVersionPresupuesto(v.nro, "historica")}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {enviadoEvento && pendiente ? (
                        <span className="text-sm font-medium text-amber-800">Enviado</span>
                      ) : null}
                    </div>
                    {aprobado ? (
                      <p className="flex items-center gap-1.5 text-sm text-emerald-800">
                        <Check className="h-4 w-4" />
                        Aprobado
                        <span className="text-muted-foreground">
                          {formatFechaLarga(fila.updated_at || fila.created_at)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => setDocVista("pdf")}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Ver PDF
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => setDocVista("hoja")}
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      Hoja de trabajo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => void compartir()}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Compartir obra
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight">
                    {payload.clienteNombre || fila.cliente}
                  </h2>
                  {pendiente && !enviadoEvento ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1 h-8 gap-1.5"
                      disabled={marcandoEnvio}
                      onClick={() => void marcarEnviadoHoy()}
                    >
                      Ponerle la fecha de hoy
                    </Button>
                  ) : null}
                </div>

                <div className="rounded-2xl bg-zinc-900 text-white px-5 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-white/70">Total del presupuesto</p>
                      <p className="text-3xl font-extrabold tracking-tight tabular-nums mt-1">
                        {formatMoneyCard(vista.total)}
                      </p>
                      <p className="mt-2 text-sm text-white/70">
                        <span className="font-medium text-white/90">
                          {formatMoneyCard(vista.items)}
                        </span>{" "}
                        ítems{" "}
                        <span className="ml-2 font-medium text-white/90">
                          {formatMoneyCard(vista.servicios)}
                        </span>{" "}
                        servicios
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className="border-0 bg-emerald-700/80 text-white">IVA incluido</Badge>
                      {pendiente || (vista.total > 0 && !aprobado) ? (
                        <p className="text-sm text-white/80 tabular-nums">
                          Saldo {formatMoneyCard(vista.total)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Dato label="Vendedor" value={payload.vendedorNombre || "—"} />
                  <Dato label="Contacto" value={payload.contacto || "—"} />
                  <Dato label="Teléfono" value={payload.tel || "—"} />
                  <Dato
                    label="Fecha de envío"
                    value={enviadoEvento ? formatFechaLarga(enviadoEvento.created_at) : "—"}
                  />
                </div>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    Artículos{" "}
                    <span className="font-normal text-muted-foreground">
                      {vista.ambientes.length}
                      {aprobado && otsCount > 0
                        ? " — convertidos en OT"
                        : pendiente
                          ? " — cada uno será una OT al aprobar"
                          : null}
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {vista.ambientes.map((amb) => (
                      <Collapsible key={amb.key} defaultOpen={false}>
                        <div className="rounded-xl border border-border bg-card px-4 py-3">
                          <CollapsibleTrigger className="group flex w-full items-start gap-2 text-left">
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-3">
                                <p className="font-bold uppercase tracking-wide">{amb.titulo}</p>
                                <p className="font-semibold tabular-nums shrink-0">
                                  {formatMoneyCard(amb.total)}
                                </p>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {amb.materialNombre || "Sin material"}
                                {amb.piezas > 0 ? ` · ${amb.piezas} piezas` : null}
                              </p>
                              {amb.colocacion > 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Colocación {formatMoneyCard(amb.colocacion)}
                                  {amb.m2 > 0 ? ` · ${formatMetrajeDetalle(amb.m2)}` : null}
                                </p>
                              ) : amb.m2 > 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  {formatMetrajeDetalle(amb.m2)}
                                </p>
                              ) : null}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
                              {amb.filas.map((f) => (
                                <li key={f.key} className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-medium">{f.descripcion}</p>
                                    {f.medidas ? (
                                      <p className="text-xs text-muted-foreground">{f.medidas}</p>
                                    ) : null}
                                  </div>
                                  <p className="tabular-nums shrink-0">{formatMoneyCard(f.total)}</p>
                                </li>
                              ))}
                            </ul>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                </section>

                {vista.superficies.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Superficie</h3>
                    <div className="rounded-xl border border-border bg-card divide-y">
                      {vista.superficies.map((s) => (
                        <div
                          key={s.nombre}
                          className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                        >
                          <p>{s.nombre}</p>
                          <p className="font-medium tabular-nums">{formatMetrajeDetalle(s.m2)}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    Servicios <span className="font-normal text-muted-foreground">global</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Medición{" "}
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatMoneyCard(vista.serviciosSplit.medicion)}
                    </span>
                    <span className="mx-3">Envío</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatMoneyCard(vista.serviciosSplit.envio)}
                    </span>
                    <span className="mx-3">Colocación</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatMoneyCard(vista.serviciosSplit.colocacion)}
                    </span>
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    Historia del precio{" "}
                    <span className="font-normal text-muted-foreground">
                      qué le llegó al cliente y cada cambio
                    </span>
                  </h3>
                  <div className="rounded-xl border border-border bg-card divide-y">
                    {eventosMostrados.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-start justify-between gap-3 px-4 py-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          {ev.tipo === "enviado_pdf" ? (
                            <Send className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Pencil className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{etiquetaEventoPrecio(ev.tipo)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFechaHora(ev.created_at)}
                              {ev.created_by_nombre ? ` · ${ev.created_by_nombre}` : null}
                            </p>
                            {ev.tipo === "ajuste" &&
                            ev.meta &&
                            typeof ev.meta === "object" &&
                            !Array.isArray(ev.meta) &&
                            typeof ev.meta.total_anterior === "number" ? (
                              <p className="text-xs text-muted-foreground">
                                {ev.meta.motivo === "aprobacion" ? "Al aprobar" : "Ajuste"} · antes{" "}
                                {formatMoneyAr(ev.meta.total_anterior, ev.moneda)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-sm font-semibold tabular-nums shrink-0">
                          {formatMoneyAr(ev.monto, ev.moneda)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Archivos ({archivosTodos.length})
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-orange-700 hover:text-orange-800"
                      disabled={subiendo}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {subiendo ? "Subiendo…" : "Subir"}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        void onSubirArchivo(f);
                      }}
                    />
                  </div>
                  {archivosTodos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todavía no hay archivos.</p>
                  ) : (
                    <div className="space-y-2">
                      {archivosTodos.map((a) => (
                        <div
                          key={a.storagePath}
                          className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                        >
                          <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{a.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {etiquetaTipoArchivo(a.tipo)} · {formatBytes(a.size)} ·{" "}
                              {formatFechaLarga(a.createdAt)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Ver archivo"
                            onClick={() => void verArchivo(a.storagePath)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Eliminar archivo"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => void borrarArchivo(a)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          {pendiente && fila && !cargando && seccion === "presupuesto" ? (
            <div className="shrink-0 border-t bg-stone-50 px-5 py-3 space-y-2">
              <Button
                type="button"
                className="w-full h-11 gap-2 bg-orange-600 text-white hover:bg-orange-700"
                onClick={() => onAprobar(fila.id)}
              >
                <Check className="h-4 w-4" />
                Aprobar presupuesto
                {otsAGenerar > 0 ? ` · genera ${otsAGenerar} OT` : null}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-1.5"
                  onClick={() => {
                    const id = fila.id;
                    onClose();
                    onEditar(id);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-1.5 text-destructive hover:text-destructive"
                  disabled={statusBusy}
                  onClick={() => void onRechazar(fila.id)}
                >
                  No aprobado
                </Button>
              </div>
            </div>
          ) : null}

          {docVista ? (
            <div className="absolute inset-0 z-10 flex flex-col bg-background">
              <div className="border-b px-5 py-3 shrink-0">
                <p className="text-base font-semibold">
                  {docVista === "hoja" ? "Hoja de trabajo" : "Presupuesto PDF"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {fila?.numero}
                  {nroMostrado > 1 ? ` · V${nroMostrado}` : ""}
                </p>
              </div>
              <div className="overflow-y-auto flex-1 px-4 py-4 bg-neutral-100/80">
                {!fila || !payload ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
                ) : docVista === "hoja" ? (
                  <div ref={docHojaRef}>
                    <HojaDeTrabajoDocumento
                      numero={fila.numero}
                      fecha={new Date(fila.created_at).toLocaleDateString("es-AR")}
                      clienteNombre={payload.clienteNombre || fila.cliente}
                      direccion={payload.direccion}
                      contacto={payload.contacto}
                      tel={payload.tel}
                      vendedorLabel={payload.vendedorNombre ?? ""}
                      payload={payload}
                      articulos={articulos}
                      materials={materials}
                      className="mx-auto max-w-3xl bg-white p-5 shadow-sm border border-neutral-200"
                    />
                  </div>
                ) : (
                  <div ref={docPdfRef}>
                    <PresupuestoDocumento
                      numero={fila.numero}
                      fecha={new Date(fila.created_at).toLocaleDateString("es-AR")}
                      clienteNombre={payload.clienteNombre || fila.cliente}
                      contacto={payload.contacto}
                      tel={payload.tel}
                      email={payload.email}
                      direccion={payload.direccion}
                      observacion={payload.obsCabecera}
                      origenLabel={origenLabel}
                      vendedorLabel={payload.vendedorNombre ?? ""}
                      comisionPct={payload.comisionPct ?? ""}
                      moneda={payload.monedaPresupuesto}
                      dolarHoy={payload.dolarHoy}
                      ordenes={payload.ordenes}
                      articulos={articulos}
                      materials={materials}
                      descuentoPct={parseMoneyInput(payload.descuentoGlobalPct)}
                      mMedicion={payload.mMedicionGlobal}
                      mEntrega={payload.mEntregaGlobal}
                      mColocacion={payload.mColocacionGlobal}
                      totalMec={importeMecPresupuesto({
                        mMedicion: payload.mMedicionGlobal,
                        mEntrega: payload.mEntregaGlobal,
                        mColocacion: payload.mColocacionGlobal,
                        totalMec: payload.totalMecGlobal,
                        ordenes: payload.ordenes,
                      })}
                      obsMec={payload.obsServiciosMec}
                      versionLabel={
                        viendoNro != null
                          ? etiquetaVersionPresupuesto(viendoNro, "historica")
                          : nroVigente > 1
                            ? etiquetaVersionPresupuesto(nroVigente)
                            : ""
                      }
                      className="mx-auto max-w-3xl bg-white p-4 sm:p-5 shadow-sm border border-neutral-200"
                    />
                  </div>
                )}
              </div>
              <div className="border-t px-4 py-3 flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDocVista(null)}>
                  Volver
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!fila}
                  onClick={() => {
                    if (!fila) return;
                    const q = viendoNro != null ? `?vn=${viendoNro}` : "";
                    navigate(
                      docVista === "hoja"
                        ? `/presupuestos/${fila.id}/hoja-trabajo${q}`
                        : `/presupuestos/${fila.id}/imprimir${q}`,
                    );
                  }}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                <Button
                  type="button"
                  className="gap-1.5"
                  disabled={!fila || !payload || descargandoPdf}
                  onClick={() => void descargarDoc()}
                >
                  <Download className="h-4 w-4" />
                  {descargandoPdf ? "Generando…" : "Descargar PDF"}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function SeccionVenta({
  presupuestoId,
  total,
  moneda,
}: {
  presupuestoId: string;
  total: number;
  moneda: "ars" | "usd";
}) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<VentaEstado | null>(null);
  const [creada, setCreada] = useState<string | null>(null);
  const [medidas, setMedidas] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [pagos, setPagos] = useState<Database["public"]["Tables"]["ventas_pagos"]["Row"][]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCargando(true);
      setError(null);
      const venta = await getVentaPorPresupuesto(presupuestoId);
      if (cancelled) return;
      if (venta.error) {
        setError(venta.error.message);
        setCargando(false);
        return;
      }
      if (!venta.data) {
        setError("Este presupuesto todavía no tiene venta.");
        setCargando(false);
        return;
      }
      const pagosRes = await listPagosVenta(venta.data.id);
      if (cancelled) return;
      if (pagosRes.error) {
        setError(pagosRes.error.message);
        setCargando(false);
        return;
      }
      setEstado(venta.data.estado);
      setCreada(venta.data.created_at);
      setMedidas(venta.data.fecha_confirmacion_medidas);
      setNotas(venta.data.notas_medicion?.trim() ?? "");
      setPagos(pagosRes.data);
      setCargando(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [presupuestoId]);

  if (cargando) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Cargando venta…</p>;
  }
  if (error) {
    return <p className="py-16 text-center text-sm text-destructive">{error}</p>;
  }

  const cobrado = pagos.reduce((sum, p) => {
    if (p.moneda !== moneda) return sum;
    const monto = Number(p.monto);
    return Number.isFinite(monto) ? sum + monto : sum;
  }, 0);
  const saldo = total - cobrado;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight">Venta</h2>
        <Badge variant="outline">{etiquetaVentaEstado(estado)}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Dato label="Creada" value={creada ? formatFechaLarga(creada) : "—"} />
        <Dato
          label="Medidas confirmadas"
          value={medidas ? formatFechaCorta(medidas) : "Todavía no"}
        />
        <Dato label="Total" value={formatMoneyAr(total, moneda)} />
        <Dato label="Cobrado" value={formatMoneyAr(cobrado, moneda)} />
        <Dato label="Saldo" value={formatMoneyAr(Math.max(0, saldo), moneda)} />
      </div>
      {notas ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm text-muted-foreground">{notas}</p>
      ) : null}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Cobros</h3>
        {pagos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay cobros.</p>
        ) : (
          <ul className="space-y-2">
            {pagos.map((p) => {
              const monto = Number(p.monto);
              return (
                <li key={p.id} className="rounded-lg border bg-white px-3 py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">{etiquetaMetodo(p.metodo)}</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatMoneyAr(Number.isFinite(monto) ? monto : 0, p.moneda)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatFechaCorta(p.fecha)}
                    {p.nota?.trim() ? ` · ${p.nota.trim()}` : ""}
                    {p.retencion_monto > 0
                      ? ` · retención ${formatMoneyAr(p.retencion_monto, p.moneda)}`
                      : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function SeccionOts({ ventaId }: { ventaId: string }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ots, setOts] = useState<OtPanelResumen[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCargando(true);
      setError(null);
      const res = await listOtsPorVenta(ventaId);
      if (cancelled) return;
      if (res.error) setError(res.error.message);
      else setOts(res.data);
      setCargando(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ventaId]);

  if (cargando) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Cargando órdenes…</p>;
  }
  if (error) {
    return <p className="py-16 text-center text-sm text-destructive">{error}</p>;
  }
  if (ots.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Esta venta todavía no tiene órdenes de trabajo.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold tracking-tight">Órdenes de trabajo</h2>
      <ul className="space-y-2">
        {ots.map((ot) => {
          const etapa = ot.pausada ? "Venta retenida" : etiquetaEtapaOt(ot.etapa, ot.estado);
          return (
            <li key={ot.id} className="rounded-lg border bg-white px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{ot.titulo}</p>
                  {ot.tipo === "reposicion" ? (
                    <p className="text-xs text-muted-foreground">Reposición</p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    ot.pausada
                      ? "border-rose-300 bg-rose-50 text-rose-800"
                      : chipClaseEtapaOt(ot.etapa, ot.estado),
                  )}
                >
                  {etapa}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {ot.medidas_confirmadas ? "Medidas confirmadas" : "Medidas sin confirmar"}
                {ot.fecha_programada ? ` · programada ${formatFechaCorta(ot.fecha_programada)}` : ""}
              </p>
              {ot.bloqueada ? (
                <p className="mt-1 text-xs text-rose-700">
                  Bloqueada{ot.motivo_bloqueo?.trim() ? `: ${ot.motivo_bloqueo.trim()}` : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}