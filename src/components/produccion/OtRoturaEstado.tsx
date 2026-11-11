"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { bajaPedazoBloqueadoYReponer, registrarRoturaBloqueo } from "@/lib/produccion-api";
import type { RoturaMomento } from "@/lib/rotura-reglas";
import {
  listChapasDisponibles,
  listChapasPorOt,
  listChapasRoturaPorOt,
  type ChapaInventarioRow,
} from "@/lib/stock-ot-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Props = {
  otId: string;
  etapa: string;
  materialHint?: string | null;
  clienteNombre?: string | null;
  onChanged?: () => void;
  onPausada?: () => void;
  onReanudada?: () => void;
  soloLectura?: boolean;
};

function momentoDeEtapa(etapa: string): RoturaMomento {
  if (etapa === "corte") return "corte";
  if (etapa === "despacho") return "viaje";
  return "otro";
}

export function OtRoturaEstado({
  otId,
  etapa,
  materialHint,
  clienteNombre,
  onChanged,
  onPausada,
  onReanudada,
  soloLectura = false,
}: Props) {
  const { user } = useAuth();
  const [placas, setPlacas] = useState<ChapaInventarioRow[]>([]);
  const [bloqueadas, setBloqueadas] = useState<ChapaInventarioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [marcarOpen, setMarcarOpen] = useState(false);
  const [chapaId, setChapaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [reemplazoOpen, setReemplazoOpen] = useState(false);
  const [reemplazoId, setReemplazoId] = useState("");
  const [reemplazoOpciones, setReemplazoOpciones] = useState<ChapaInventarioRow[]>([]);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    const [reservadas, usadas, rotas] = await Promise.all([
      listChapasPorOt(otId, ["Reservada"]),
      listChapasPorOt(otId, ["Usada"]),
      listChapasRoturaPorOt(otId),
    ]);
    if (reservadas.error) toast.error(reservadas.error.message);
    if (usadas.error) toast.error(usadas.error.message);
    if (rotas.error) toast.error(rotas.error.message);
    const asignadas = [...reservadas.data, ...usadas.data];
    setPlacas(asignadas);
    setBloqueadas(rotas.data);
    setChapaId((prev) =>
      asignadas.some((c) => c.id === prev) ? prev : (asignadas[0]?.id ?? ""),
    );
    setLoading(false);
  }, [otId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const esperaReponer = bloqueadas.length > 0 && placas.every((c) => c.estado !== "Reservada");
  const placa = placas.find((c) => c.id === chapaId) ?? placas[0] ?? null;

  const onMarcar = async () => {
    const texto = motivo.trim();
    if (!texto) {
      toast.error("Indicá el motivo de la rotura.");
      return;
    }
    if (!placa) {
      toast.error("Esta orden no tiene una placa para marcar.");
      return;
    }
    setBusy(true);
    const res = await registrarRoturaBloqueo({
      otOrigenId: otId,
      tipo: "chapa",
      momento: momentoDeEtapa(etapa),
      motivo: texto,
      chapaId: placa.id,
      clienteNombre,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Rotura marcada. La orden queda pausada hasta elegir el reemplazo.");
    setMarcarOpen(false);
    setMotivo("");
    onPausada?.();
    onChanged?.();
    await reload();
  };

  const abrirReemplazo = async () => {
    const rota = bloqueadas[0];
    if (!rota) return;
    setReemplazoOpen(true);
    setReemplazoId("");
    const needle =
      rota.material_label?.trim() || (materialHint && materialHint !== "—" ? materialHint : "");
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
    onReanudada?.();
    onChanged?.();
    await reload();
  };

  const dialogs = (
    <>
      <Dialog open={marcarOpen} onOpenChange={setMarcarOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Marcar rotura</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {placas.length > 1 ? (
              <div className="space-y-1">
                <Label className="text-xs">Placa</Label>
                <Select value={chapaId} onValueChange={setChapaId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Elegí la placa…" />
                  </SelectTrigger>
                  <SelectContent>
                    {placas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.bulto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="font-mono text-sm">{placa?.bulto}</p>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Motivo</Label>
              <Input
                className="h-8 text-sm"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Quebrada al cortar, golpe, veta…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMarcarOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={busy || !motivo.trim()} onClick={() => void onMarcar()}>
              Marcar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button type="button" variant="outline" onClick={() => setReemplazoOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={busy || !reemplazoId} onClick={() => void onReemplazar()}>
              Reemplazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (loading) {
    return soloLectura ? null : (
      <p className="text-xs text-muted-foreground">Cargando…</p>
    );
  }

  if (esperaReponer) {
    return (
      <div className="space-y-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-red-900 dark:text-red-100">La placa se rompió</p>
          {soloLectura ? null : (
            <Button type="button" size="sm" disabled={busy} onClick={() => void abrirReemplazo()}>
              Elegir reemplazo
            </Button>
          )}
        </div>
        {dialogs}
      </div>
    );
  }

  if (soloLectura || !placa) {
    return null;
  }

  return (
    <div className="border-t border-border pt-4">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => {
          setMotivo("");
          setMarcarOpen(true);
        }}
      >
        Marcar rotura de placa
      </Button>
      {dialogs}
    </div>
  );
}
