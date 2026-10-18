"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRol } from "@/hooks/useRol";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  listarColaMedicion,
  type MedicionColaItem,
} from "@/lib/medicion-api";
import { enColaParaMedir, etiquetaMedicionEstado } from "@/lib/medicion-reglas";
import { enviarAProduccionSiCorresponde } from "@/lib/produccion-api";
import { abrirPlanoOt } from "@/lib/rotulo-ot-api";
import { eliminarPresupuestoPendiente } from "@/lib/presupuestos-api";
import { etiquetaVentaEstado, formatFechaCorta } from "@/components/produccion/ot-ui";
import { ConfirmarMedidasDialog } from "@/components/medicion/ConfirmarMedidasDialog";
import { ArrowRight, CalendarClock, Eye, FileImage, Printer, Ruler } from "lucide-react";

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
  const navigate = useNavigate();
  const { tieneAlgunRol, esAdmin, roles } = useRol();
  /** Igual que el sidebar: sin roles cargados se muestran todas las acciones. */
  const sinRoles = roles.length === 0;
  const puedeVendedor = esAdmin || sinRoles || tieneAlgunRol("vendedor", "administracion");
  const puedeMedidor = esAdmin || sinRoles || tieneAlgunRol("medidor", "vendedor", "administracion");

  const [items, setItems] = useState<MedicionColaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyPlanoId, setBusyPlanoId] = useState<string | null>(null);

  const [confirmar, setConfirmar] = useState<{
    item: MedicionColaItem;
    autoEnviar: boolean;
  } | null>(null);

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
  const confirmadas = useMemo(() => {
    return items
      .filter((i) => i.medicion.estado === "medido")
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

  const onRotulo = (item: MedicionColaItem) => {
    const ots = item.ots.filter((ot) => ot.id);
    if (ots.length === 0) {
      toast.message("Esta medición todavía no tiene orden de trabajo.");
      return;
    }
    if (ots.length === 1) {
      navigate(`/ordenes-trabajo/${ots[0]!.id}/rotulo`);
      return;
    }
    for (const ot of ots) {
      window.open(`/ordenes-trabajo/${ot.id}/rotulo`, "_blank", "noopener,noreferrer");
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
    let abrio = false;
    let sinPlano = 0;
    try {
      for (const ot of ots) {
        const res = await abrirPlanoOt(item.presupuestoId, ot.ordenKey);
        if (res.sinPlano) sinPlano += 1;
        else if (res.error) toast.error(res.error.message);
        else abrio = true;
      }
      if (!abrio && sinPlano > 0) toast.message("Esta OT no tiene plano adjunto.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir el plano.");
    } finally {
      setBusyPlanoId(null);
    }
  };

  const onMedidasConfirmadas = async (presupuestoId: string) => {
    const envio = await enviarAProduccionSiCorresponde(presupuestoId);
    if (envio.error) toast.error(envio.error.message);
    else if (envio.enviado) toast.success("Pasó a producción.");
    await refresh();
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white px-6 py-4 sm:px-8 dark:bg-background">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Medición</h1>
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
            <Seccion titulo="Para medir" icono={<CalendarClock className="h-4 w-4" />}>
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
                            busy={busyId === item.presupuestoId}
                            planoBusy={busyPlanoId === item.presupuestoId}
                            onRotulo={() => onRotulo(item)}
                            onPlano={() => void onPlano(item)}
                            accionPrincipal={
                              puedeMedidor
                                ? {
                                    label: "Confirmar medidas",
                                    onClick: () => setConfirmar({ item, autoEnviar: true }),
                                  }
                                : undefined
                            }
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

            <Seccion titulo="Confirmadas" icono={<Ruler className="h-4 w-4" />}>
              {confirmadas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay medidas confirmadas.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  {confirmadas.map((item) => (
                    <FilaMedicion
                      key={item.presupuestoId}
                      item={item}
                      busy={false}
                      planoBusy={busyPlanoId === item.presupuestoId}
                      onRotulo={() => onRotulo(item)}
                      onPlano={() => void onPlano(item)}
                      historial
                      accionPrincipal={{
                        label: "Ver",
                        onClick: () => setConfirmar({ item, autoEnviar: false }),
                      }}
                    />
                  ))}
                </div>
              )}
            </Seccion>
          </>
        )}
      </main>

      <ConfirmarMedidasDialog
        open={Boolean(confirmar)}
        onOpenChange={(o) => {
          if (!o) setConfirmar(null);
        }}
        presupuestoId={confirmar?.item.presupuestoId ?? null}
        cliente={confirmar?.item.cliente}
        numero={confirmar?.item.numero}
        titulo={confirmar?.autoEnviar ? "Confirmar medidas" : "Medidas confirmadas"}
        onSaved={() => {
          const id = confirmar?.item.presupuestoId;
          if (id && confirmar?.autoEnviar) void onMedidasConfirmadas(id);
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
}: {
  titulo: string;
  icono: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icono}
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function FilaMedicion({
  item,
  busy,
  accionPrincipal,
  extra,
  historial = false,
  onRotulo,
  onPlano,
  planoBusy = false,
}: {
  item: MedicionColaItem;
  busy: boolean;
  accionPrincipal?: { label: string; onClick: () => void; disabled?: boolean };
  extra?: ReactNode;
  historial?: boolean;
  onRotulo?: () => void;
  onPlano?: () => void;
  planoBusy?: boolean;
}) {
  const fechaConfirmada = formatFechaCorta(item.medicion.medido_en);
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
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
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {extra}
        {onRotulo ? (
          <Button type="button" size="sm" variant="outline" onClick={onRotulo}>
            <Printer className="mr-1 h-3.5 w-3.5" />
            Rótulo
          </Button>
        ) : null}
        {onPlano ? (
          <Button type="button" size="sm" variant="outline" disabled={planoBusy} onClick={onPlano}>
            <FileImage className="mr-1 h-3.5 w-3.5" />
            Plano
          </Button>
        ) : null}
        {accionPrincipal ? (
          <Button
            type="button"
            size="sm"
            variant={historial ? "outline" : "default"}
            disabled={busy || accionPrincipal.disabled}
            onClick={accionPrincipal.onClick}
          >
            {historial ? <Eye className="mr-1 h-3.5 w-3.5" /> : null}
            {accionPrincipal.label}
            {historial ? null : <ArrowRight className="ml-1 h-3.5 w-3.5" />}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
