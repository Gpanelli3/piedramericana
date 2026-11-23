"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRol } from "@/hooks/useRol";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  confirmarConformidadCliente,
  evaluarEnvioAProduccion,
  listarColaMedicion,
  type MedicionColaItem,
} from "@/lib/medicion-api";
import { formatMoneyAr } from "@/lib/presupuesto-detalle";
import { enColaParaMedir, etiquetaMedicionEstado } from "@/lib/medicion-reglas";
import { enviarAProduccionSiCorresponde } from "@/lib/produccion-api";
import { descargarRotuloOt } from "@/components/produccion/descargarRotuloOt";
import { descargarPlanoOt } from "@/lib/rotulo-ot-api";
import { eliminarPresupuestoPendiente } from "@/lib/presupuestos-api";
import { etiquetaVentaEstado, formatFechaCorta } from "@/components/produccion/ot-ui";
import { MedicionDetalleSheet } from "@/components/medicion/MedicionDetalleSheet";
import { RenegociarImporteDialog } from "@/components/medicion/RenegociarImporteDialog";
import { CalendarClock, Handshake, Ruler } from "lucide-react";

function hoyLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function enDiasIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type GrupoSemana = {
  key: string;
  titulo: string;
  items: MedicionColaItem[];
};

function agruparParaMedir(items: MedicionColaItem[]): GrupoSemana[] {
  const hoy = hoyLocalIso();
  const limite = enDiasIso(7);
  const vencidas: MedicionColaItem[] = [];
  const sinFecha: MedicionColaItem[] = [];
  const porDia = new Map<string, MedicionColaItem[]>();
  const masAdelante: MedicionColaItem[] = [];

  for (const it of items) {
    const f = it.medicion.fecha_programada?.slice(0, 10) ?? "";
    if (!f) {
      sinFecha.push(it);
      continue;
    }
    if (f < hoy) {
      vencidas.push(it);
      continue;
    }
    if (f > limite) {
      masAdelante.push(it);
      continue;
    }
    const list = porDia.get(f) ?? [];
    list.push(it);
    porDia.set(f, list);
  }

  const grupos: GrupoSemana[] = [];
  if (vencidas.length) grupos.push({ key: "vencidas", titulo: "Vencidas", items: vencidas });
  const dias = [...porDia.keys()].sort();
  for (const dia of dias) {
    const titulo = dia === hoy ? `Hoy · ${formatFechaCorta(dia)}` : formatFechaCorta(dia);
    grupos.push({ key: dia, titulo, items: porDia.get(dia)! });
  }
  if (sinFecha.length) grupos.push({ key: "sin-fecha", titulo: "Sin fecha", items: sinFecha });
  if (masAdelante.length) {
    grupos.push({ key: "luego", titulo: "Más adelante", items: masAdelante });
  }
  return grupos;
}

export function VistaMedicion() {
  const { user } = useAuth();
  const { tieneAlgunRol, esAdmin, roles } = useRol();
  /** Igual que el sidebar: sin roles cargados se muestran todas las acciones. */
  const sinRoles = roles.length === 0;
  const puedeVendedor = esAdmin || sinRoles || tieneAlgunRol("vendedor", "administracion");

  const [items, setItems] = useState<MedicionColaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyRotuloId, setBusyRotuloId] = useState<string | null>(null);
  const [busyPlanoId, setBusyPlanoId] = useState<string | null>(null);

  const [renegociarItem, setRenegociarItem] = useState<MedicionColaItem | null>(null);
  const [detalleItem, setDetalleItem] = useState<MedicionColaItem | null>(null);
  const [detalleHistorial, setDetalleHistorial] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data, error } = await listarColaMedicion();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      setItems([]);
      return;
    }
    setItems(data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const paraMedir = useMemo(
    () => items.filter((i) => enColaParaMedir(i.medicion.estado, i.tieneSena)),
    [items],
  );
  const gruposSemana = useMemo(() => agruparParaMedir(paraMedir), [paraMedir]);
  const esperandoConformidad = useMemo(
    () =>
      items.filter(
        (i) =>
          i.medicion.estado === "medido" &&
          i.medicion.conformidad_pendiente &&
          i.presupuestoStatus === "aprobado",
      ),
    [items],
  );
  const confirmadas = useMemo(() => {
    return items
      .filter((i) => i.medicion.estado === "medido" && !esperandoConformidad.includes(i))
      .sort((a, b) => {
        const fa = a.medicion.medido_en ?? "";
        const fb = b.medicion.medido_en ?? "";
        if (fa === fb) return b.numero.localeCompare(a.numero);
        return fb.localeCompare(fa);
      });
  }, [items]);
  const onRechazar = async (item: MedicionColaItem) => {
    if (item.presupuestoStatus !== "pendiente") return;
    if (
      !window.confirm(
        `¿Borrar ${item.numero} · ${item.cliente}?\nSale de medición y no queda historial.`,
      )
    ) {
      return;
    }
    setBusyId(item.presupuestoId);
    const res = await eliminarPresupuestoPendiente(item.presupuestoId);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Presupuesto eliminado.");
    await refresh();
  };

  const onRotulo = async (item: MedicionColaItem) => {
    const ots = item.ots.filter((ot) => ot.id);
    if (ots.length === 0) {
      toast.message("Esta medición todavía no tiene orden de trabajo.");
      return;
    }
    setBusyRotuloId(item.presupuestoId);
    let ok = 0;
    try {
      for (const ot of ots) {
        const res = await descargarRotuloOt(ot.id);
        if (res.error) toast.error(res.error.message);
        else ok += 1;
      }
      if (ok === 1) toast.success("Rótulo descargado.");
      else if (ok > 1) toast.success(`Se descargaron ${ok} rótulos.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar el rótulo.");
    } finally {
      setBusyRotuloId(null);
    }
  };

  const onPlano = async (item: MedicionColaItem) => {
    const ots = item.ots.filter((ot) => ot.id && ot.ordenKey);
    if (ots.length === 0) {
      toast.message(
        item.ots.length === 0
          ? "Esta medición todavía no tiene orden de trabajo."
          : "Esta OT no tiene plano adjunto.",
      );
      return;
    }
    setBusyPlanoId(item.presupuestoId);
    let descargo = false;
    let sinPlano = 0;
    try {
      for (const ot of ots) {
        const res = await descargarPlanoOt(item.presupuestoId, ot.ordenKey);
        if (res.sinPlano) sinPlano += 1;
        else if (res.error) toast.error(res.error.message);
        else descargo = true;
      }
      if (!descargo && sinPlano > 0) toast.message("Esta OT no tiene plano adjunto.");
      else if (descargo) toast.success("Plano descargado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar el plano.");
    } finally {
      setBusyPlanoId(null);
    }
  };

  const onMedidasConfirmadas = async (presupuestoId: string) => {
    const envio = await enviarAProduccionSiCorresponde(presupuestoId);
    if (envio.error) toast.error(envio.error.message);
    else if (envio.enviado) toast.success("Pasó a producción.");
    else {
      // Si no pasó porque cambió el precio, se avisa que falta la conformidad del cliente.
      const ev = await evaluarEnvioAProduccion(presupuestoId);
      if (ev.data?.faltantes.some((f) => f.includes("conformidad"))) {
        toast.warning(
          "Cambió el importe al medir. Avisale al cliente y, cuando esté de acuerdo, confirmalo acá en «Esperando conformidad».",
          { duration: 12000 },
        );
      }
    }
    await refresh();
  };

  /** Se acordó un importe distinto con el cliente: sigue el mismo camino que la conformidad. */
  const onImporteAcordado = async (presupuestoId: string) => {
    const envio = await enviarAProduccionSiCorresponde(presupuestoId);
    if (envio.error) toast.error(envio.error.message);
    else if (envio.enviado) toast.success("Pasó a producción.");
    await refresh();
  };

  const onClienteConforme = async (item: MedicionColaItem) => {
    setBusyId(item.presupuestoId);
    const res = await confirmarConformidadCliente({
      presupuestoId: item.presupuestoId,
      usuarioId: user?.id ?? null,
    });
    if (res.error) {
      setBusyId(null);
      toast.error(res.error.message);
      return;
    }
    const envio = await enviarAProduccionSiCorresponde(item.presupuestoId);
    setBusyId(null);
    if (envio.error) toast.error(envio.error.message);
    else if (envio.enviado) toast.success("Cliente conforme. Pasó a producción.");
    else toast.success("Conformidad registrada.");
    await refresh();
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white px-5 py-4 sm:px-6 dark:bg-background">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground" data-guia="modulo-titulo">Medición</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Confirmá las medidas de cada visita. Después pasa a producción.
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-sm font-medium">
            {paraMedir.length} para medir
          </Badge>
        </div>
      </header>

      <main className="space-y-8 p-4 sm:p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando medición…</p>
        ) : (
          <>
            <Seccion titulo="Para medir" icono={<CalendarClock className="h-4 w-4" />} guia="medicion-para-medir">
              {gruposSemana.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay visitas pendientes.</p>
              ) : (
                <div className="space-y-5">
                  {gruposSemana.map((g) => (
                    <div key={g.key} className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.titulo}
                      </p>
                      <div className="overflow-hidden rounded-lg border border-border bg-card">
                        {g.items.map((item) => (
                          <FilaMedicion
                            key={item.presupuestoId}
                            item={item}
                            onClick={() => {
                              setDetalleItem(item);
                              setDetalleHistorial(false);
                            }}
                            extra={
                              puedeVendedor && item.presupuestoStatus === "pendiente" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-xs text-destructive hover:text-destructive"
                                  disabled={busyId === item.presupuestoId}
                                  onClick={() => void onRechazar(item)}
                                >
                                  Rechazar
                                </Button>
                              ) : null
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Seccion>

            {esperandoConformidad.length > 0 ? (
              <Seccion
                titulo="Esperando conformidad del cliente"
                guia="medicion-conformidad"
                icono={<Handshake className="h-4 w-4" />}
              >
                <p className="-mt-1 text-xs text-muted-foreground">
                  Al medir cambió el importe. Avisale al cliente: si está de acuerdo, tocá «Cliente conforme»
                  y la OT pasa a producción. Si no acepta, tocá «No conforme» y cargá el importe que
                  acuerden.
                </p>
                <div className="overflow-hidden rounded-lg border border-amber-200 bg-card">
                  {esperandoConformidad.map((item) => (
                    <FilaMedicion
                      key={item.presupuestoId}
                      item={item}
                      historial
                      onClick={() => {
                        // Se abre editable: si el cliente no está de acuerdo, se pueden corregir las medidas.
                        setDetalleItem(item);
                        setDetalleHistorial(false);
                      }}
                      extra={
                        <>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {item.medicion.conformidad_total_anterior != null
                              ? formatMoneyAr(item.medicion.conformidad_total_anterior, item.moneda)
                              : "—"}
                            {" → "}
                            <span className="font-semibold text-foreground">
                              {item.medicion.conformidad_total_nuevo != null
                                ? formatMoneyAr(item.medicion.conformidad_total_nuevo, item.moneda)
                                : "—"}
                            </span>
                          </span>
                          {puedeVendedor ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                disabled={busyId === item.presupuestoId}
                                onClick={() => setRenegociarItem(item)}
                              >
                                No conforme
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={busyId === item.presupuestoId}
                                onClick={() => void onClienteConforme(item)}
                              >
                                {busyId === item.presupuestoId ? "…" : "Cliente conforme"}
                              </Button>
                            </>
                          ) : null}
                        </>
                      }
                    />
                  ))}
                </div>
              </Seccion>
            ) : null}

            <Seccion titulo="Confirmadas" icono={<Ruler className="h-4 w-4" />} guia="medicion-confirmadas">
              {confirmadas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay medidas confirmadas.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  {confirmadas.map((item) => (
                    <FilaMedicion
                      key={item.presupuestoId}
                      item={item}
                      historial
                      onClick={() => {
                        setDetalleItem(item);
                        setDetalleHistorial(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </Seccion>
          </>
        )}
      </main>

      <RenegociarImporteDialog
        item={renegociarItem}
        open={Boolean(renegociarItem)}
        onOpenChange={(o) => {
          if (!o) setRenegociarItem(null);
        }}
        usuarioId={user?.id ?? null}
        onDone={(id) => void onImporteAcordado(id)}
      />

      <MedicionDetalleSheet
        item={detalleItem}
        open={Boolean(detalleItem)}
        onOpenChange={(o) => {
          if (!o) setDetalleItem(null);
        }}
        historial={detalleHistorial}
        onRotulo={() => {
          if (detalleItem) void onRotulo(detalleItem);
        }}
        onPlano={() => {
          if (detalleItem) void onPlano(detalleItem);
        }}
        rotuloBusy={Boolean(detalleItem && busyRotuloId === detalleItem.presupuestoId)}
        planoBusy={Boolean(detalleItem && busyPlanoId === detalleItem.presupuestoId)}
        onSaved={() => {
          const id = detalleItem?.presupuestoId;
          if (id && !detalleHistorial) void onMedidasConfirmadas(id);
          else void refresh();
        }}
      />
    </div>
  );
}

function Seccion({
  titulo,
  icono,
  children,
  guia,
}: {
  titulo: string;
  icono: ReactNode;
  children: ReactNode;
  /** Marca para la guía de uso. */
  guia?: string;
}) {
  return (
    <section className="space-y-3" data-guia={guia}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icono}
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function esControl(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button, a, input, textarea, select"));
}

function FilaMedicion({
  item,
  extra,
  historial = false,
  onClick,
}: {
  item: MedicionColaItem;
  extra?: ReactNode;
  historial?: boolean;
  onClick: () => void;
}) {
  const fechaConfirmada = formatFechaCorta(item.medicion.medido_en);

  const onRowClick = (e: MouseEvent<HTMLDivElement>) => {
    if (esControl(e.target)) return;
    onClick();
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (esControl(e.target)) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      tabIndex={0}
      onClick={onRowClick}
      onKeyDown={onRowKeyDown}
      className="group flex cursor-pointer flex-col gap-3 border-b border-border/70 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground underline-offset-2 group-hover:underline">
            {item.numero} · {item.cliente}
          </p>
          {historial ? (
            <Badge variant="outline" className="text-[10px]">
              {etiquetaVentaEstado(item.ventaEstado)}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              {etiquetaMedicionEstado(item.medicion.estado)}
            </Badge>
          )}
          {item.presupuestoStatus === "pendiente" ? (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-[10px] text-amber-900"
            >
              Presupuesto pendiente
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {historial ? (
            <>
              {fechaConfirmada !== "—" ? `Confirmó el ${fechaConfirmada}` : "Confirmado"}
              {item.medidoPorNombre ? ` · ${item.medidoPorNombre}` : null}
              {item.direccionObra && item.direccionObra !== "—" ? (
                <>
                  <span className="mx-1.5 text-border">·</span>
                  {item.direccionObra}
                </>
              ) : null}
            </>
          ) : (
            <>
              {item.direccionObra}
              {item.medicion.fecha_programada ? (
                <>
                  <span className="mx-1.5 text-border">·</span>
                  {formatFechaCorta(item.medicion.fecha_programada)}
                </>
              ) : null}
            </>
          )}
        </p>
        {!historial && item.bloqueoEnvio && item.medicion.estado !== "listo_para_medir" ? (
          <p className="text-[11px] text-amber-800 dark:text-amber-200">{item.bloqueoEnvio}</p>
        ) : null}
      </div>
      {extra ? <div className="flex shrink-0 flex-wrap items-center gap-2">{extra}</div> : null}
    </div>
  );
}
