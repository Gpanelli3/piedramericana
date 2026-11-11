"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  approxM2Linea,
  fetchMedidasOt,
  fetchMedidasPresupuesto,
  guardarMedidasOt,
  m2CambioSignificativo,
  type MedidaItemEditable,
} from "@/lib/ot-medidas-api";
import { confirmarMedicion } from "@/lib/medicion-api";
import { useAuth } from "@/contexts/AuthContext";
import {
  etiquetaVersionPresupuesto,
  formatMetraje,
  parseDecimalInput,
} from "@/lib/presupuesto-calculos";

function formatMonto(n: number, moneda: "ars" | "usd"): string {
  const pref = moneda === "usd" ? "u$s" : "$";
  return `${pref} ${n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDim(v: string): string {
  const n = parseDecimalInput(v);
  if (!(n > 0)) return v.trim() || "—";
  return n.toLocaleString("es-AR", { maximumFractionDigits: 3 });
}

function medidasItemTexto(it: MedidaItemEditable): string {
  if (it.muestraAlto || it.muestraAncho) {
    return `${formatDim(it.altoM)} × ${formatDim(it.anchoM)} m`;
  }
  return `cant. ${it.cantidad.trim() || "—"}`;
}

type Props = {
  otId?: string;
  presupuestoId?: string;
  /** Mostrar panel expandido (etapa medición o aún sin confirmar). */
  destacado?: boolean;
  /** Si true, confirmar también marca el presupuesto como medido. */
  confirmarPipeline?: boolean;
  onSaved?: () => void;
};

export function OtMedidasPanel({
  otId,
  presupuestoId,
  destacado = false,
  confirmarPipeline = false,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmadas, setConfirmadas] = useState(false);
  const [editando, setEditando] = useState(false);
  const [items, setItems] = useState<MedidaItemEditable[]>([]);
  const [notas, setNotas] = useState("");
  const [totalVigente, setTotalVigente] = useState(0);
  const [totalVenta, setTotalVenta] = useState(0);
  const [moneda, setMoneda] = useState<"ars" | "usd">("ars");
  const [nroVersion, setNroVersion] = useState(1);
  const [m2Venta, setM2Venta] = useState(0);
  const [m2Obra, setM2Obra] = useState(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = otId
      ? await fetchMedidasOt(otId)
      : presupuestoId
        ? await fetchMedidasPresupuesto(presupuestoId)
        : { data: null, error: new Error("Falta OT o presupuesto.") };
    setLoading(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    if (!res.data) return;
    setItems(res.data.items);
    setConfirmadas(res.data.medidasConfirmadas);
    setNotas(res.data.notasMedicion);
    setTotalVigente(res.data.total);
    setTotalVenta(res.data.totalVenta);
    setMoneda(res.data.moneda);
    setNroVersion(res.data.nroVersion);
    setM2Venta(res.data.m2Venta);
    setM2Obra(res.data.m2Obra);
    setEditando(!res.data.medidasConfirmadas && destacado);
  }, [otId, presupuestoId, destacado]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const onChangeItem = (itemKey: string, ordenKey: string, patch: Partial<MedidaItemEditable>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.itemKey !== itemKey || it.ordenKey !== ordenKey) return it;
        const next = { ...it, ...patch };
        return { ...next, m2Approx: approxM2Linea(next) };
      }),
    );
  };

  const onConfirmar = async () => {
    setSaving(true);
    const patches = items.map((it) => ({
      itemKey: it.itemKey,
      ordenKey: it.ordenKey,
      altoM: it.altoM,
      anchoM: it.anchoM,
      cantidad: it.cantidad,
    }));
    const res =
      confirmarPipeline && presupuestoId
        ? await confirmarMedicion({
            presupuestoId,
            items: patches,
            notas,
            usuarioId: user?.id ?? null,
          })
        : otId
          ? await guardarMedidasOt({ otId, items: patches, notas })
          : {
              error: new Error("Falta OT o presupuesto."),
              totalNuevo: 0,
              totalAnterior: 0,
              nroVersion: 1,
              m2Anterior: 0,
              m2Nuevo: 0,
            };
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    setConfirmadas(true);
    setEditando(false);
    setTotalVigente(res.totalNuevo);
    setTotalVenta(res.totalAnterior);
    setNroVersion(res.nroVersion);
    setM2Venta(res.m2Anterior);
    setM2Obra(res.m2Nuevo);
    if (m2CambioSignificativo(res.m2Anterior, res.m2Nuevo)) {
      toast.success("Medidas confirmadas. El presupuesto pasó a " + etiquetaVersionPresupuesto(res.nroVersion) + ".");
    } else {
      toast.success("Medidas confirmadas.");
    }
    onSaved?.();
  };

  if (loading) {
    return (
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Cargando medidas…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        Sin ítems con medidas en el presupuesto.
      </div>
    );
  }

  const mostrarForm = editando || (destacado && !confirmadas);
  const m2ObraMostrado = mostrarForm ? items.reduce((s, it) => s + it.m2Approx, 0) : m2Obra;

  return (
    <div
      className={
        destacado
          ? "space-y-3 rounded-md border border-blue-200 bg-blue-50/50 px-3 py-3 dark:border-blue-900/50 dark:bg-blue-950/20"
          : "space-y-3 rounded-md border border-border bg-muted/20 px-3 py-3"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Medidas del presupuesto</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {nroVersion > 1 ? (
            <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
              {etiquetaVersionPresupuesto(nroVersion)}
            </span>
          ) : null}
          {!confirmadas && !confirmarPipeline ? (
            <Badge variant="outline" className="text-[10px]">
              Opcional
            </Badge>
          ) : null}
        </div>
      </div>

      {destacado && !confirmadas ? (
        <p className="text-xs text-muted-foreground leading-snug">
          {confirmarPipeline
            ? "Revisá las medidas de obra y confirmá. Eso deja el presupuesto listo para que el vendedor lo mande a producción."
            : "Revisá las medidas anotadas. Podés ajustarlas y confirmarlas."}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-md border border-border/70 bg-background text-xs">
        <div className="grid grid-cols-2 border-b border-border/60 bg-muted/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Cotizado</span>
          <span className="text-right">Medido en obra</span>
        </div>
        <div className="grid grid-cols-2 items-baseline gap-y-1 px-3 py-2 tabular-nums">
          <span className="text-muted-foreground">{formatMetraje(m2Venta)} m²</span>
          <span className="text-right font-medium text-foreground">
            {formatMetraje(m2ObraMostrado)} m²
          </span>
          <span className="text-muted-foreground">{formatMonto(totalVenta, moneda)}</span>
          <span className="text-right font-medium text-foreground">
            {formatMonto(totalVigente, moneda)}
          </span>
        </div>
      </div>

      {mostrarForm ? (
        <div className="space-y-3">
          {items.map((it) => (
            <div
              key={`${it.ordenKey}-${it.itemKey}`}
              className="space-y-2 rounded-md border border-border/80 bg-background/80 px-3 py-2"
            >
              <p className="text-xs font-medium text-foreground">
                {it.articuloLabel}
                <span className="ml-1 font-normal text-muted-foreground">· {it.ordenTitulo}</span>
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {it.muestraAlto ? (
                  <div className="space-y-1">
                    <Label className="text-[10px]">Alto (m)</Label>
                    <Input
                      className="h-8 text-xs"
                      value={it.altoM}
                      onChange={(e) =>
                        onChangeItem(it.itemKey, it.ordenKey, { altoM: e.target.value })
                      }
                    />
                  </div>
                ) : null}
                {it.muestraAncho ? (
                  <div className="space-y-1">
                    <Label className="text-[10px]">Ancho (m)</Label>
                    <Input
                      className="h-8 text-xs"
                      value={it.anchoM}
                      onChange={(e) =>
                        onChangeItem(it.itemKey, it.ordenKey, { anchoM: e.target.value })
                      }
                    />
                  </div>
                ) : null}
                <div className="space-y-1">
                  <Label className="text-[10px]">
                    {it.unidad === "M2" && it.modoIngreso === "manual" ? "m²" : "Cantidad"}
                  </Label>
                  <Input
                    className="h-8 text-xs"
                    value={it.cantidad}
                    onChange={(e) =>
                      onChangeItem(it.itemKey, it.ordenKey, { cantidad: e.target.value })
                    }
                  />
                </div>
              </div>
              <p className="text-[10px] tabular-nums text-muted-foreground">
                ≈ {formatMetraje(it.m2Approx)} m²
              </p>
            </div>
          ))}

          <div className="space-y-1">
            <Label className="text-[10px]">Notas técnicas (opcional)</Label>
            <Textarea
              rows={2}
              className="resize-none text-xs"
              placeholder="Diferencias en obra, columnas, cortes en L…"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={() => void onConfirmar()}>
              Confirmar medidas
            </Button>
            {confirmadas ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() => setEditando(false)}
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-md border border-border/70 bg-background">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-border/60 bg-muted/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>Ítem</span>
              <span>Medidas</span>
              <span className="text-right">m²</span>
            </div>
            <ul>
              {items.map((it) => (
                <li
                  key={`${it.ordenKey}-${it.itemKey}`}
                  className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 border-t border-border/40 px-3 py-2 text-xs first:border-t-0"
                >
                  <span className="min-w-0 truncate font-medium text-foreground">
                    {it.articuloLabel}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{medidasItemTexto(it)}</span>
                  <span className="text-right tabular-nums font-medium text-foreground">
                    {formatMetraje(it.m2Approx)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {notas ? (
            <p className="text-xs text-muted-foreground">
              Notas: <span className="text-foreground">{notas}</span>
            </p>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => setEditando(true)}>
            Editar medidas
          </Button>
        </div>
      )}
    </div>
  );
}
