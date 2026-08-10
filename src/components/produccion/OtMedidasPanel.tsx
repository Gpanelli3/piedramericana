"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Ruler } from "lucide-react";
import {
  approxM2Linea,
  fetchMedidasOt,
  guardarMedidasOt,
  m2CambioSignificativo,
  type MedidaItemEditable,
} from "@/lib/ot-medidas-api";
import { formatMetraje } from "@/lib/presupuesto-calculos";

type Props = {
  otId: string;
  /** Mostrar panel expandido (etapa medición o aún sin confirmar). */
  destacado: boolean;
  onSaved?: () => void;
};

export function OtMedidasPanel({ otId, destacado, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmadas, setConfirmadas] = useState(false);
  const [editando, setEditando] = useState(false);
  const [items, setItems] = useState<MedidaItemEditable[]>([]);
  const [notas, setNotas] = useState("");
  const [m2Total, setM2Total] = useState(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await fetchMedidasOt(otId);
    setLoading(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    if (!res.data) return;
    setItems(res.data.items);
    setConfirmadas(res.data.medidasConfirmadas);
    setNotas(res.data.notasMedicion);
    setM2Total(res.data.materialM2);
    setEditando(!res.data.medidasConfirmadas && destacado);
  }, [otId, destacado]);

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
    const res = await guardarMedidasOt({
      otId,
      items: items.map((it) => ({
        itemKey: it.itemKey,
        ordenKey: it.ordenKey,
        altoM: it.altoM,
        anchoM: it.anchoM,
        cantidad: it.cantidad,
      })),
      notas,
    });
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    setConfirmadas(true);
    setEditando(false);
    setM2Total(res.m2Nuevo);
    if (m2CambioSignificativo(res.m2Anterior, res.m2Nuevo)) {
      toast.success("Medidas guardadas. Revisá en Ventas si el precio debe ajustarse.");
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

  return (
    <div
      className={
        destacado
          ? "space-y-3 rounded-md border border-blue-200 bg-blue-50/50 px-3 py-3 dark:border-blue-900/50 dark:bg-blue-950/20"
          : "space-y-3 rounded-md border border-border bg-muted/20 px-3 py-3"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Medidas del presupuesto</p>
        </div>
        {confirmadas ? (
          <Badge variant="secondary" className="text-[10px]">
            Confirmadas
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            Opcional
          </Badge>
        )}
      </div>

      {destacado && !confirmadas ? (
        <p className="text-xs text-muted-foreground leading-snug">
          Revisá las medidas anotadas. Podés confirmarlas, ajustarlas o seguir a Corte sin confirmar.
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground tabular-nums">
        Material aprox.:{" "}
        <span className="font-medium text-foreground">{formatMetraje(m2Total)} m²</span>
      </p>

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
              <p className="text-[10px] text-muted-foreground tabular-nums">
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
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {items.map((it) => (
              <li key={`${it.ordenKey}-${it.itemKey}`} className="flex flex-wrap justify-between gap-x-2">
                <span className="text-foreground">{it.articuloLabel}</span>
                <span className="tabular-nums">
                  {it.muestraAlto || it.muestraAncho
                    ? `${it.altoM || "—"} × ${it.anchoM || "—"} m`
                    : `cant. ${it.cantidad || "—"}`}
                  {" · "}
                  {formatMetraje(it.m2Approx)} m²
                </span>
              </li>
            ))}
          </ul>
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
