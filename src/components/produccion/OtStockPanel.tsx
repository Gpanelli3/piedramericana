"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, History, Layers, Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  consumirChapasConRetazos,
  liberarChapasDeOt,
  listChapasDisponibles,
  listChapasPorOt,
  listTrazabilidadStockPorOt,
  lotesDistintosEnChapas,
  materialSinChapasDisponibles,
  listChapasRoturaPorOt,
  reservarChapasAOt,
  type ChapaInventarioRow,
  type MovimientoStockRow,
} from "@/lib/stock-ot-api";
import {
  asignarBachaAOt,
  createBachaInventario,
  fetchBachasDisponiblesParaOt,
  fetchBachasInventario,
  liberarBachaDeOt,
  type BachaInventarioRow,
} from "@/lib/stock-api";
import { registrarRoturaBloqueo } from "@/lib/produccion-api";
import { AvisoRetazoPiezas } from "@/components/stock/AvisoRetazoPiezas";
import {
  ROTURA_MOMENTOS,
  ROTURA_TIPOS,
  type PiezaMedida,
  type RoturaMomento,
  type RoturaTipo,
} from "@/lib/rotura-reglas";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useStock } from "@/contexts/StockContext";
import { cn } from "@/lib/utils";
import { etiquetaTipoColocacion } from "@/components/presupuesto/wizard/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  otId: string;
  materialHint?: string;
  materialId?: string | null;
  piezas?: PiezaMedida[];
  requiereReservaStock?: boolean;
  otTitulo?: string;
  clienteNombre?: string | null;
  bachaRequerida?: boolean;
  bachaOrigen?: "propia" | "cliente" | null;
  bachaTipo?: string | null;
  bachaColocacion?: string | null;
  bachaId?: string | null;
  onChanged?: () => void;
};

function m2(l: number, a: number) {
  return ((l / 100) * (a / 100)).toFixed(2);
}

function etiquetaMov(t: MovimientoStockRow["tipo"]): string {
  const map: Record<MovimientoStockRow["tipo"], string> = {
    reserva: "Reserva",
    liberacion: "Liberación",
    consumo: "Consumo",
    baja: "Baja",
    retazo_alta: "Retazo",
    bloqueo: "Bloqueo",
  };
  return map[t] ?? t;
}

async function toastSiAgotado(materialId?: string | null, materialLabel?: string | null) {
  const r = await materialSinChapasDisponibles({ materialId, materialLabel });
  if (r.agotado) {
    toast.warning(`Se acabó ${r.label}: no queda stock disponible.`);
  }
}

export function OtStockPanel({
  otId,
  materialHint,
  materialId = null,
  piezas = [],
  requiereReservaStock = false,
  otTitulo,
  clienteNombre,
  bachaRequerida = false,
  bachaOrigen = null,
  bachaTipo = null,
  bachaColocacion = null,
  bachaId = null,
  onChanged,
}: Props) {
  const { reloadChapas } = useStock();
  const [reservadas, setReservadas] = useState<ChapaInventarioRow[]>([]);
  const [usadas, setUsadas] = useState<ChapaInventarioRow[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoStockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reservarOpen, setReservarOpen] = useState(false);
  const [consumoOpen, setConsumoOpen] = useState(false);
  const [disponibles, setDisponibles] = useState<ChapaInventarioRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [forzarMezcla, setForzarMezcla] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retazosByChapa, setRetazosByChapa] = useState<
    Record<string, Array<{ largo: string; ancho: string }>>
  >({});
  const [roturaOpen, setRoturaOpen] = useState(false);
  const [roturaTipo, setRoturaTipo] = useState<RoturaTipo>("chapa");
  const [roturaChapa, setRoturaChapa] = useState<ChapaInventarioRow | null>(null);
  const [roturaMotivo, setRoturaMotivo] = useState("");
  const [roturaMomento, setRoturaMomento] = useState<RoturaMomento>("corte");
  const [roturaPiezaLargo, setRoturaPiezaLargo] = useState("");
  const [roturaPiezaAncho, setRoturaPiezaAncho] = useState("");
  const [roturaPiezaLabel, setRoturaPiezaLabel] = useState("");
  const [bloqueadas, setBloqueadas] = useState<ChapaInventarioRow[]>([]);
  const [bachaAsignada, setBachaAsignada] = useState<BachaInventarioRow | null>(null);
  const [bachasDisponibles, setBachasDisponibles] = useState<BachaInventarioRow[]>([]);
  const [bachaSelectId, setBachaSelectId] = useState("");
  const [registrarClienteOpen, setRegistrarClienteOpen] = useState(false);
  const [registrarModelo, setRegistrarModelo] = useState("");
  const [registrarUbicacion, setRegistrarUbicacion] = useState("");

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    const [r, u, rot, mov] = await Promise.all([
      listChapasPorOt(otId, ["Reservada"]),
      listChapasPorOt(otId, ["Usada", "Baja"]),
      listChapasRoturaPorOt(otId),
      listTrazabilidadStockPorOt(otId),
    ]);
    if (r.error) toast.error(r.error.message);
    if (u.error) toast.error(u.error.message);
    if (rot.error) toast.error(rot.error.message);
    if (mov.error) toast.error(mov.error.message);
    setReservadas(r.data);
    setUsadas(u.data);
    setBloqueadas(rot.data);
    setMovimientos(mov.data);
    try {
      const bachas = await fetchBachasDisponiblesParaOt({ clienteNombre });
      setBachasDisponibles(bachas);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar las bachas");
      setBachasDisponibles([]);
    }
    if (bachaId) {
      try {
        const todas = await fetchBachasInventario();
        setBachaAsignada(todas.find((b) => b.id === bachaId) ?? null);
      } catch {
        setBachaAsignada(null);
      }
    } else {
      setBachaAsignada(null);
    }
    setLoading(false);
  }, [otId, bachaId, clienteNombre]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const reservaPendiente = requiereReservaStock && reservadas.length === 0;
  const esperaReponer = bloqueadas.length > 0 && reservadas.length === 0;

  const abrirReservar = async () => {
    setReservarOpen(true);
    setForzarMezcla(false);
    const needle = materialHint && materialHint !== "—" ? materialHint.split(" ")[0] : undefined;
    const { data, error } = await listChapasDisponibles({ materialNeedle: needle });
    if (error) toast.error(error.message);
    let pool = data;
    if ((data ?? []).length === 0 && needle) {
      const all = await listChapasDisponibles();
      pool = all.data;
    }
    setDisponibles(pool);
    setSelected(new Set());
  };

  const mezclaPreview = useMemo(() => {
    const elegidas = disponibles.filter((c) => selected.has(c.id));
    return lotesDistintosEnChapas([...reservadas, ...elegidas]);
  }, [disponibles, selected, reservadas]);

  const chapasParaRotura = useMemo(
    () => [...reservadas, ...usadas.filter((c) => c.estado === "Usada")],
    [reservadas, usadas],
  );

  const onReservar = async () => {
    setBusy(true);
    const res = await reservarChapasAOt({
      otId,
      chapaIds: [...selected],
      permitirMezclaLotes: forzarMezcla,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    if (res.warningMezclaLotes) toast.warning(res.warningMezclaLotes);
    else toast.success("Chapas reservadas a la OT.");
    setReservarOpen(false);
    await reload();
    await reloadChapas();
    onChanged?.();
    await toastSiAgotado(null, materialHint);
  };

  const onLiberar = async (chapaId: string) => {
    setBusy(true);
    const res = await liberarChapasDeOt({ otId, chapaIds: [chapaId] });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Chapa liberada.");
    await reload();
    await reloadChapas();
    onChanged?.();
  };

  const abrirRotura = () => {
    const primeraPieza = piezas[0];
    const primeraChapa = chapasParaRotura[0] ?? null;
    setRoturaTipo(primeraChapa ? "chapa" : "pieza");
    setRoturaChapa(primeraChapa);
    setRoturaMotivo("");
    setRoturaMomento("corte");
    setRoturaPiezaLargo(primeraPieza ? String(primeraPieza.largoCm) : "");
    setRoturaPiezaAncho(primeraPieza ? String(primeraPieza.anchoCm) : "");
    setRoturaPiezaLabel(primeraPieza?.label ?? otTitulo ?? "Pieza");
    setRoturaOpen(true);
  };

  const onConfirmarRotura = async () => {
    const motivo = roturaMotivo.trim();
    if (!motivo) {
      toast.error("Indicá el motivo de la rotura.");
      return;
    }
    if (roturaTipo === "chapa" && !roturaChapa) {
      toast.error("Elegí la chapa que se rompió.");
      return;
    }
    const largoCm = Number(String(roturaPiezaLargo).replace(",", "."));
    const anchoCm = Number(String(roturaPiezaAncho).replace(",", "."));
    if (roturaTipo === "pieza" && (!(largoCm > 0) || !(anchoCm > 0))) {
      toast.error("Indicá largo y ancho de la pieza en cm.");
      return;
    }
    const materialLabel =
      roturaChapa?.material_label ||
      (materialHint && materialHint !== "—" ? materialHint : "") ||
      "Material";
    setBusy(true);
    const res = await registrarRoturaBloqueo({
      otOrigenId: otId,
      tipo: roturaTipo,
      momento: roturaMomento,
      motivo,
      chapaId: roturaChapa?.id ?? chapasParaRotura[0]?.id ?? null,
      pieza:
        roturaTipo === "pieza"
          ? {
              largoCm,
              anchoCm,
              materialId,
              materialLabel,
            }
          : undefined,
      clienteNombre,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    setRoturaOpen(false);
    setRoturaChapa(null);
    toast.success("Rotura registrada. Apartá otro mármol para reponer.");
    await reload();
    await reloadChapas();
    onChanged?.();
    await toastSiAgotado(res.materialId, res.materialLabel ?? materialHint);
  };

  const abrirConsumo = () => {
    if (reservadas.length === 0) {
      toast.error("No hay chapas reservadas para consumir.");
      return;
    }
    const init: Record<string, Array<{ largo: string; ancho: string }>> = {};
    for (const c of reservadas) init[c.id] = [{ largo: "", ancho: "" }];
    setRetazosByChapa(init);
    setConsumoOpen(true);
  };

  const onConsumir = async () => {
    setBusy(true);
    const items = reservadas.map((c) => ({
      chapaId: c.id,
      retazos: (retazosByChapa[c.id] ?? [])
        .map((r) => ({
          largo_cm: Number(String(r.largo).replace(",", ".")),
          ancho_cm: Number(String(r.ancho).replace(",", ".")),
        }))
        .filter((r) => r.largo_cm > 0 && r.ancho_cm > 0),
    }));
    const res = await consumirChapasConRetazos({ otId, items });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Corte registrado: chapas consumidas y retazos dados de alta.");
    setConsumoOpen(false);
    await reload();
    await reloadChapas();
    onChanged?.();
    await toastSiAgotado(null, materialHint);
  };

  const mostrarBacha = bachaRequerida || Boolean(bachaId) || Boolean(bachaAsignada);

  const onAsignarBacha = async (id: string) => {
    if (!id) {
      toast.error("Elegí una bacha del stock.");
      return;
    }
    setBusy(true);
    const res = await asignarBachaAOt({
      bachaId: id,
      otId,
      clienteNombre,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Bacha asignada.");
    setBachaSelectId("");
    await reload();
    onChanged?.();
  };

  const onLiberarBacha = async () => {
    setBusy(true);
    const res = await liberarBachaDeOt({ otId });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Bacha liberada.");
    await reload();
    onChanged?.();
  };

  const onRegistrarBachaCliente = async () => {
    const nombre = (clienteNombre ?? "").trim();
    if (!nombre) {
      toast.error("La OT no tiene nombre de cliente.");
      return;
    }
    setBusy(true);
    try {
      const created = await createBachaInventario({
        origen: "cliente",
        cliente_nombre: nombre,
        modelo: registrarModelo.trim() || bachaTipo || null,
        ubicacion: registrarUbicacion.trim() || null,
        estado: "disponible",
      });
      const asg = await asignarBachaAOt({
        bachaId: created.id,
        otId,
        clienteNombre: nombre,
      });
      if (asg.error) throw asg.error;
      toast.success("Bacha del cliente registrada y asignada.");
      setRegistrarClienteOpen(false);
      setRegistrarModelo("");
      setRegistrarUbicacion("");
      await reload();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar la bacha");
    } finally {
      setBusy(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <p className="text-xs text-muted-foreground">Stock remoto no disponible en esta sesión.</p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
      {mostrarBacha ? (
        <div className="space-y-2 rounded-md border border-border bg-card px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            Bacha
          </p>
          <p className="text-xs text-muted-foreground">
            {bachaTipo?.trim() || "Sin tipo"}
            {bachaColocacion ? ` · ${etiquetaTipoColocacion(bachaColocacion)}` : ""}
            {bachaOrigen === "cliente"
              ? " · del cliente"
              : bachaOrigen === "propia"
                ? " · nuestra"
                : ""}
          </p>
          {bachaAsignada ? (
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 text-xs">
                <span className="font-medium">
                  {bachaAsignada.modelo?.trim() || "Asignada"}
                </span>
                {bachaAsignada.origen === "cliente" ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {bachaAsignada.cliente_nombre} · no vendible
                  </span>
                ) : null}
              </p>
              <div className="flex gap-1">
                <Badge variant="secondary" className="text-[10px]">
                  Asignada
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-xs"
                  disabled={busy}
                  onClick={() => void onLiberarBacha()}
                >
                  Liberar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                Bacha pendiente
              </p>
              {bachasDisponibles.length > 0 ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select value={bachaSelectId} onValueChange={setBachaSelectId}>
                    <SelectTrigger className="h-8 w-full text-xs sm:flex-1">
                      <SelectValue placeholder="Elegir del stock…" />
                    </SelectTrigger>
                    <SelectContent>
                      {bachasDisponibles.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {(b.modelo?.trim() || "Sin modelo") +
                            (b.origen === "cliente"
                              ? ` · ${b.cliente_nombre} (no vendible)`
                              : " · nuestra")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={busy || !bachaSelectId}
                    onClick={() => void onAsignarBacha(bachaSelectId)}
                  >
                    Asignar
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No hay bachas disponibles
                  {bachaOrigen === "cliente" ? " de este cliente" : " en stock"}.
                </p>
              )}
              {bachaOrigen === "cliente" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 w-full text-xs"
                  disabled={busy}
                  onClick={() => {
                    setRegistrarModelo(bachaTipo ?? "");
                    setRegistrarClienteOpen(true);
                  }}
                >
                  Registró llegada
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Placas / stock
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void abrirReservar()}>
            Reservar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={reservadas.length === 0}
            onClick={abrirConsumo}
          >
            Consumir corte
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-red-700 dark:text-red-300"
            disabled={busy}
            onClick={abrirRotura}
          >
            Rotura
          </Button>
        </div>
      </div>

      <AvisoRetazoPiezas
        materialId={materialId}
        materialLabel={materialHint && materialHint !== "—" ? materialHint : null}
        piezas={piezas}
      />

      {reservaPendiente && !esperaReponer ? (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">Reserva pendiente</p>
              <p className="text-amber-900/80 dark:text-amber-100/80">
                Esta orden todavía no tiene placas apartadas. Usá Reservar para elegirlas.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {esperaReponer ? (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Se rompió el mármol</p>
          <p className="text-amber-900/80 dark:text-amber-100/80">
            Esa placa salió de este trabajo. Quedó vacío: apartá otro mármol para reponer.
          </p>
          <Button
            type="button"
            size="sm"
            className="h-7 w-full text-xs"
            disabled={busy}
            onClick={() => void abrirReservar()}
          >
            Apartar otro mármol
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : reservadas.length === 0 && usadas.length === 0 ? (
        !reservaPendiente && !esperaReponer ? (
          <p className="text-xs text-muted-foreground">
            Sin placas asignadas. Si señalaste una chapa en el presupuesto, se reserva al señar; si no,
            podés reservar acá.
          </p>
        ) : null
      ) : (
        <ul className="space-y-1.5">
          {reservadas.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
            >
              <div className="min-w-0">
                <span className="font-mono font-medium">{c.bulto}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {m2(Number(c.largo_cm), Number(c.ancho_cm))} m²
                  {c.lote_codigo ? ` · lote ${c.lote_codigo}` : ""}
                  {c.origen_placa ? ` · ${c.origen_placa}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Badge
                  variant="secondary"
                  className="border border-amber-200 bg-amber-50 text-[10px] text-amber-900"
                >
                  Apartada
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-xs"
                  disabled={busy}
                  onClick={() => void onLiberar(c.id)}
                >
                  Liberar
                </Button>
              </div>
            </li>
          ))}
          {usadas.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground"
            >
              <div className="min-w-0">
                <span className="font-mono">{c.bulto}</span>
                {c.lote_codigo ? ` · lote ${c.lote_codigo}` : ""}
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  c.estado === "Baja" && "border-red-200 text-red-700",
                )}
              >
                {c.estado === "Usada" ? "Ya se cortó" : c.estado}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {movimientos.length > 0 ? (
        <div className="space-y-1.5 border-t border-border/60 pt-2">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <History className="h-3 w-3" />
            Historial de stock
          </p>
          <ul className="max-h-28 space-y-1 overflow-y-auto">
            {movimientos.slice(0, 12).map((m) => (
              <li key={m.id} className="flex justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">{etiquetaMov(m.tipo)}</span>
                  {m.chapa_bulto ? ` · ${m.chapa_bulto}` : ""}
                  {m.chapa_lote ? ` · lote ${m.chapa_lote}` : ""}
                  {!m.chapa_bulto && m.detalle ? ` · ${m.detalle}` : ""}
                </span>
                <span className="shrink-0 tabular-nums">{m.created_at.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Dialog open={reservarOpen} onOpenChange={setReservarOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reservar chapas a la OT</DialogTitle>
            <DialogDescription>
              Elegí placas concretas. Evitá mezclar lotes (veteado/color).
            </DialogDescription>
          </DialogHeader>
          {mezclaPreview.length > 1 ? (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p>Mezcla de lotes: {mezclaPreview.join(", ")}</p>
                <label className="flex items-center gap-2">
                  <Checkbox checked={forzarMezcla} onCheckedChange={(v) => setForzarMezcla(v === true)} />
                  Reservar igual (no recomendado)
                </label>
              </div>
            </div>
          ) : null}
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {disponibles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay chapas disponibles.</p>
            ) : (
              disponibles.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <label
                    key={c.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm",
                      checked ? "border-primary bg-muted/40" : "border-border",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setSelected((prev) => {
                          const n = new Set(prev);
                          if (v === true) n.add(c.id);
                          else n.delete(c.id);
                          return n;
                        });
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono font-medium">{c.bulto}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.material_label} · {Number(c.largo_cm)}×{Number(c.ancho_cm)} cm ·{" "}
                        {m2(Number(c.largo_cm), Number(c.ancho_cm))} m²
                        {c.lote_codigo ? ` · lote ${c.lote_codigo}` : " · sin lote"}
                        {c.origen_placa ? ` · ${c.origen_placa}` : ""}
                      </p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReservarOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={busy || selected.size === 0} onClick={() => void onReservar()}>
              Reservar {selected.size || ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={consumoOpen} onOpenChange={setConsumoOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar corte / consumo</DialogTitle>
            <DialogDescription>
              Las chapas reservadas pasan a Usada. Opcional: dar de alta retazos con medidas (Disponible).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {reservadas.map((c) => (
              <div key={c.id} className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium">
                  <span className="font-mono">{c.bulto}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {Number(c.largo_cm)}×{Number(c.ancho_cm)} cm
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">Retazos a reingresar (opcional)</p>
                {(retazosByChapa[c.id] ?? []).map((r, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Largo cm</Label>
                      <Input
                        value={r.largo}
                        onChange={(e) =>
                          setRetazosByChapa((prev) => {
                            const list = [...(prev[c.id] ?? [])];
                            list[i] = { ...list[i]!, largo: e.target.value };
                            return { ...prev, [c.id]: list };
                          })
                        }
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Ancho cm</Label>
                      <Input
                        value={r.ancho}
                        onChange={(e) =>
                          setRetazosByChapa((prev) => {
                            const list = [...(prev[c.id] ?? [])];
                            list[i] = { ...list[i]!, ancho: e.target.value };
                            return { ...prev, [c.id]: list };
                          })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9"
                      onClick={() =>
                        setRetazosByChapa((prev) => ({
                          ...prev,
                          [c.id]: (prev[c.id] ?? []).filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() =>
                    setRetazosByChapa((prev) => ({
                      ...prev,
                      [c.id]: [...(prev[c.id] ?? []), { largo: "", ancho: "" }],
                    }))
                  }
                >
                  <Plus className="h-3 w-3" />
                  Otro retazo
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsumoOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={() => void onConsumir()}>
              Confirmar consumo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={roturaOpen}
        onOpenChange={(open) => {
          setRoturaOpen(open);
          if (!open) setRoturaChapa(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar rotura</DialogTitle>
            <DialogDescription>
              La placa sale de este trabajo y queda fuera de venta. Acá queda vacío hasta que
              apartes otro mármol.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Qué se rompió</Label>
              <Select
                value={roturaTipo}
                onValueChange={(v) => {
                  const tipo = v === "pieza" ? "pieza" : "chapa";
                  setRoturaTipo(tipo);
                  if (tipo === "chapa" && !roturaChapa) {
                    setRoturaChapa(chapasParaRotura[0] ?? null);
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROTURA_TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {roturaTipo === "chapa" ? (
              <div className="space-y-1">
                <Label className="text-xs">Placa</Label>
                {chapasParaRotura.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay placas reservadas ni usadas en esta OT. Reservá una o registrá rotura de
                    pieza.
                  </p>
                ) : (
                  <Select
                    value={roturaChapa?.id ?? ""}
                    onValueChange={(id) => {
                      setRoturaChapa(chapasParaRotura.find((c) => c.id === id) ?? null);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Elegí la placa…" />
                    </SelectTrigger>
                    <SelectContent>
                      {chapasParaRotura.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.bulto} · {Number(c.largo_cm)}×{Number(c.ancho_cm)} cm · {c.estado}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {piezas.length > 1 ? (
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Pieza</Label>
                    <Select
                      value={roturaPiezaLabel || "__manual"}
                      onValueChange={(v) => {
                        const p = piezas.find((x) => x.label === v);
                        if (!p) return;
                        setRoturaPiezaLabel(p.label);
                        setRoturaPiezaLargo(String(p.largoCm));
                        setRoturaPiezaAncho(String(p.anchoCm));
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Elegí una pieza…" />
                      </SelectTrigger>
                      <SelectContent>
                        {piezas.map((p) => (
                          <SelectItem key={`${p.label}-${p.largoCm}x${p.anchoCm}`} value={p.label}>
                            {p.label} · {p.largoCm}×{p.anchoCm} cm
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <Label className="text-xs">Largo cm</Label>
                  <Input
                    className="h-8 text-xs"
                    value={roturaPiezaLargo}
                    onChange={(e) => setRoturaPiezaLargo(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ancho cm</Label>
                  <Input
                    className="h-8 text-xs"
                    value={roturaPiezaAncho}
                    onChange={(e) => setRoturaPiezaAncho(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Cuándo</Label>
              <Select
                value={roturaMomento}
                onValueChange={(v) => setRoturaMomento(v as RoturaMomento)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROTURA_MOMENTOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Motivo</Label>
              <Input
                className="h-8 text-xs"
                placeholder="Quebrada al cortar, veta, golpe, etc."
                value={roturaMotivo}
                onChange={(e) => setRoturaMotivo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoturaOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={busy || (roturaTipo === "chapa" && !roturaChapa)}
              onClick={() => void onConfirmarRotura()}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={registrarClienteOpen} onOpenChange={setRegistrarClienteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bacha del cliente</DialogTitle>
            <DialogDescription>
              Entra a stock con el nombre de {clienteNombre?.trim() || "este cliente"} y no se puede
              vender. Queda asignada a esta OT.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Modelo</Label>
              <Input
                className="h-8 text-xs"
                value={registrarModelo}
                onChange={(e) => setRegistrarModelo(e.target.value)}
                placeholder="Ej. Johnson 70"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ubicación (opcional)</Label>
              <Input
                className="h-8 text-xs"
                value={registrarUbicacion}
                onChange={(e) => setRegistrarUbicacion(e.target.value)}
                placeholder="Estantería, taller…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRegistrarClienteOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={busy} onClick={() => void onRegistrarBachaCliente()}>
              Registrar y asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
