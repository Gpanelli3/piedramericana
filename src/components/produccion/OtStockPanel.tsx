"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OtBachaControl } from "@/components/produccion/OtBachaControl";
import {
  listChapasDisponibles,
  listChapasPorOt,
  lotesDistintosEnChapas,
  materialSinChapasDisponibles,
  listChapasRoturaPorOt,
  reservarChapasAOt,
  type ChapaInventarioRow,
} from "@/lib/stock-ot-api";
import { bajaPedazoBloqueadoYReponer } from "@/lib/produccion-api";
import { useAuth } from "@/contexts/AuthContext";
import { AvisoRetazoPiezas } from "@/components/stock/AvisoRetazoPiezas";
import { type PiezaMedida } from "@/lib/rotura-reglas";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useStock } from "@/contexts/StockContext";
import { cn } from "@/lib/utils";

type Props = {
  otId: string;
  materialHint?: string;
  materialId?: string | null;
  piezas?: PiezaMedida[];
  requiereReservaStock?: boolean;
  otTitulo?: string;
  clienteNombre?: string | null;
  clienteId?: string | null;
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
  clienteNombre,
  clienteId = null,
  bachaRequerida = false,
  bachaOrigen = null,
  bachaTipo = null,
  bachaColocacion = null,
  bachaId = null,
  onChanged,
}: Props) {
  const { user } = useAuth();
  const { reloadChapas } = useStock();
  const [reservadas, setReservadas] = useState<ChapaInventarioRow[]>([]);
  const [usadas, setUsadas] = useState<ChapaInventarioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reservarOpen, setReservarOpen] = useState(false);
  const [disponibles, setDisponibles] = useState<ChapaInventarioRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [forzarMezcla, setForzarMezcla] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bloqueadas, setBloqueadas] = useState<ChapaInventarioRow[]>([]);
  const [reemplazoOpen, setReemplazoOpen] = useState(false);
  const [reemplazoId, setReemplazoId] = useState("");
  const [reemplazoOpciones, setReemplazoOpciones] = useState<ChapaInventarioRow[]>([]);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    const [r, u, rot] = await Promise.all([
      listChapasPorOt(otId, ["Reservada"]),
      listChapasPorOt(otId, ["Usada", "Baja"]),
      listChapasRoturaPorOt(otId),
    ]);
    if (r.error) toast.error(r.error.message);
    if (u.error) toast.error(u.error.message);
    if (rot.error) toast.error(rot.error.message);
    setReservadas(r.data);
    setUsadas(u.data);
    setBloqueadas(rot.data);
    setLoading(false);
  }, [otId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const reservaPendiente = requiereReservaStock && reservadas.length === 0;
  const esperaReponer = bloqueadas.length > 0 && reservadas.length === 0;

  const abrirReemplazo = async () => {
    const rota = bloqueadas[0];
    if (!rota) return;
    setReemplazoOpen(true);
    setReemplazoId("");
    const needle = rota.material_label?.trim() || (materialHint && materialHint !== "—" ? materialHint : "");
    const res = await listChapasDisponibles(needle ? { materialNeedle: needle } : undefined);
    let pool = res.data;
    if (pool.length === 0 && needle) {
      const all = await listChapasDisponibles();
      pool = all.data;
    }
    if (res.error) toast.error(res.error.message);
    setReemplazoOpciones(pool.filter((c) => c.id !== rota.id));
  };

  const onReemplazar = async () => {
    const rota = bloqueadas[0];
    if (!rota || !reemplazoId) {
      toast.error("Elegí la placa que reemplaza a la rota.");
      return;
    }
    setBusy(true);
    const res = await bajaPedazoBloqueadoYReponer({
      chapaId: rota.id,
      chapaNuevaId: reemplazoId,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("La placa nueva reemplazó a la rota. La orden sigue.");
    setReemplazoOpen(false);
    await reload();
    await reloadChapas();
    onChanged?.();
    await toastSiAgotado(res.materialId, res.materialLabel ?? materialHint);
  };

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
          Placas
        </p>
        {reservadas.length === 0 && usadas.length === 0 && !esperaReponer ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => void abrirReservar()}
          >
            Reservar
          </Button>
        ) : null}
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
          <p className="font-semibold">Esta placa se rompió</p>
          <p className="text-amber-900/80 dark:text-amber-100/80">
            Elegí la placa que la reemplaza. Esta misma orden sigue con esa placa.
          </p>
          <Button
            type="button"
            size="sm"
            className="h-7 w-full text-xs"
            disabled={busy}
            onClick={() => void abrirReemplazo()}
          >
            Elegir reemplazo
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
              <span className="shrink-0 text-[11px] text-muted-foreground">Apartada</span>
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

      <OtBachaControl
        otId={otId}
        clienteNombre={clienteNombre}
        clienteId={clienteId}
        bachaRequerida={bachaRequerida}
        bachaOrigen={bachaOrigen}
        bachaTipo={bachaTipo}
        bachaColocacion={bachaColocacion}
        bachaId={bachaId}
        onChanged={onChanged}
      />

      <Dialog open={reemplazoOpen} onOpenChange={setReemplazoOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Reemplazar mármol roto</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {reemplazoOpciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay placas disponibles para reemplazar.</p>
            ) : (
              reemplazoOpciones.map((c) => {
                const checked = reemplazoId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm",
                      checked ? "border-primary bg-muted/40" : "border-border",
                    )}
                    onClick={() => setReemplazoId(c.id)}
                  >
                    <span className="min-w-0">
                      <span className="block font-mono font-medium">{c.bulto}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.material_label} · {Number(c.largo_cm)}×{Number(c.ancho_cm)} cm
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReemplazoOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={busy || !reemplazoId} onClick={() => void onReemplazar()}>
              Reemplazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
