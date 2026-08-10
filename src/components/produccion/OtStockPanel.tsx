"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, History, Layers, Plus, Trash2 } from "lucide-react";
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
  reservarChapasAOt,
  sugerirChapasParaOt,
  type ChapaInventarioRow,
  type MovimientoStockRow,
} from "@/lib/stock-ot-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Props = {
  otId: string;
  materialHint?: string;
  requiereReservaStock?: boolean;
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
  };
  return map[t] ?? t;
}

export function OtStockPanel({
  otId,
  materialHint,
  requiereReservaStock = false,
  onChanged,
}: Props) {
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
  const [sugeridas, setSugeridas] = useState<ChapaInventarioRow[]>([]);
  const [loteSugerido, setLoteSugerido] = useState<string | null>(null);
  const [retazosByChapa, setRetazosByChapa] = useState<
    Record<string, Array<{ largo: string; ancho: string }>>
  >({});

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    const [r, u, mov] = await Promise.all([
      listChapasPorOt(otId, ["Reservada"]),
      listChapasPorOt(otId, ["Usada", "Baja"]),
      listTrazabilidadStockPorOt(otId),
    ]);
    if (r.error) toast.error(r.error.message);
    if (u.error) toast.error(u.error.message);
    if (mov.error) toast.error(mov.error.message);
    setReservadas(r.data);
    setUsadas(u.data);
    setMovimientos(mov.data);
    setLoading(false);
  }, [otId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const reservaPendiente = requiereReservaStock && reservadas.length === 0;

  const cargarSugerencias = useCallback(async () => {
    const sug = await sugerirChapasParaOt({ materialHint, cantidad: 1 });
    if (sug.error) {
      toast.error(sug.error.message);
      return;
    }
    setSugeridas(sug.data.chapas);
    setLoteSugerido(sug.data.lotePreferido);
  }, [materialHint]);

  useEffect(() => {
    if (reservaPendiente) void cargarSugerencias();
  }, [reservaPendiente, cargarSugerencias]);

  const abrirReservar = async (preselectSugeridas = false) => {
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
    if (preselectSugeridas && sugeridas.length > 0) {
      setSelected(new Set(sugeridas.map((c) => c.id)));
    } else {
      setSelected(new Set());
    }
  };

  const onReservarSugeridas = async () => {
    if (sugeridas.length === 0) {
      await abrirReservar(false);
      return;
    }
    setBusy(true);
    const res = await reservarChapasAOt({
      otId,
      chapaIds: sugeridas.map((c) => c.id),
      permitirMezclaLotes: false,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      await abrirReservar(true);
      return;
    }
    toast.success(
      loteSugerido
        ? `Reservada(s) del lote ${loteSugerido}.`
        : "Chapas sugeridas reservadas.",
    );
    await reload();
    onChanged?.();
  };

  const mezclaPreview = useMemo(() => {
    const elegidas = disponibles.filter((c) => selected.has(c.id));
    return lotesDistintosEnChapas([...reservadas, ...elegidas]);
  }, [disponibles, selected, reservadas]);

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
    onChanged?.();
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
    onChanged?.();
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
    onChanged?.();
  };

  if (!isSupabaseConfigured) {
    return (
      <p className="text-xs text-muted-foreground">Stock remoto no disponible en esta sesión.</p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Placas / stock
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void abrirReservar(false)}>
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
        </div>
      </div>

      {reservaPendiente ? (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">Reserva pendiente</p>
              <p className="text-amber-900/80 dark:text-amber-100/80">
                La OT pasó a corte. Reservá placas para no venderlas a otro cliente.
                {loteSugerido ? ` Lote sugerido: ${loteSugerido}.` : null}
              </p>
              {sugeridas.length > 0 ? (
                <p className="font-mono text-[11px]">
                  Sugerida: {sugeridas.map((c) => c.bulto).join(", ")}
                </p>
              ) : (
                <p>No hay chapas disponibles que coincidan con el material.</p>
              )}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-7 w-full text-xs"
            disabled={busy}
            onClick={() => void onReservarSugeridas()}
          >
            {sugeridas.length > 0 ? "Reservar sugeridas" : "Elegir chapas…"}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : reservadas.length === 0 && usadas.length === 0 ? (
        !reservaPendiente ? (
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
                <Badge variant="secondary" className="border border-amber-200 bg-amber-50 text-[10px] text-amber-900">
                  Reservada
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
                {c.motivo_estado ? ` · ${c.motivo_estado}` : ""}
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  c.estado === "Baja" && "border-red-200 text-red-700",
                )}
              >
                {c.estado}
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
    </div>
  );
}
