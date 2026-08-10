"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChapaReservaPendiente } from "@/lib/ventas-api";
import { listChapasDisponibles, reservarChapasAOt } from "@/lib/stock-ot-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendientes: ChapaReservaPendiente[];
  onResuelto: () => Promise<void>;
};

type Opcion = {
  id: string;
  bulto: string;
  dims: string;
};

export function ElegirChapaReemplazoDialog({
  open,
  onOpenChange,
  pendientes,
  onResuelto,
}: Props) {
  const [opcionesPorKey, setOpcionesPorKey] = useState<Record<string, Opcion[]>>({});
  const [seleccion, setSeleccion] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || pendientes.length === 0) return;
    let cancel = false;
    setLoading(true);
    setSeleccion({});
    void (async () => {
      const map: Record<string, Opcion[]> = {};
      for (const p of pendientes) {
        const res = await listChapasDisponibles({ materialNeedle: p.materialLabel });
        const needle = p.materialLabel.trim().toLowerCase();
        const opts = (res.data ?? [])
          .filter((c) => (c.material_label ?? "").toLowerCase().includes(needle))
          .map((c) => ({
            id: c.id,
            bulto: c.bulto,
            dims: `${c.largo_cm}×${c.ancho_cm} cm`,
          }));
        map[p.ordenKey] = opts;
      }
      if (!cancel) {
        setOpcionesPorKey(map);
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, pendientes]);

  const onConfirmar = async () => {
    for (const p of pendientes) {
      if (!seleccion[p.ordenKey]) {
        toast.error(`Elegí una chapa de reemplazo para ${p.materialLabel} (${p.bulto}).`);
        return;
      }
    }
    setBusy(true);
    try {
      for (const p of pendientes) {
        const chapaId = seleccion[p.ordenKey]!;
        const res = await reservarChapasAOt({
          otId: p.otId,
          chapaIds: [chapaId],
          permitirMezclaLotes: true,
        });
        if (res.error) {
          toast.error(res.error.message);
          setBusy(false);
          return;
        }
      }
      toast.success("Chapas de reemplazo reservadas para la OT.");
      onOpenChange(false);
      await onResuelto();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && pendientes.length > 0) {
          toast.message("Elegí chapas de reemplazo para completar la reserva.");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>Chapa ya no disponible</DialogTitle>
          <DialogDescription className="text-left">
            La chapa señalada en el presupuesto ya no está Disponible. Elegí otra del mismo material
            para reservarla a la OT.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Cargando chapas…</p>
        ) : (
          <div className="space-y-4">
            {pendientes.map((p) => {
              const opts = opcionesPorKey[p.ordenKey] ?? [];
              return (
                <div key={p.ordenKey} className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-foreground">{p.materialLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    Señalada: <span className="font-mono">{p.bulto}</span> (ya no disponible)
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nueva chapa</Label>
                    <Select
                      value={seleccion[p.ordenKey] ?? ""}
                      onValueChange={(v) => setSeleccion((s) => ({ ...s, [p.ordenKey]: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={opts.length ? "Elegir chapa…" : "Sin stock disponible"} />
                      </SelectTrigger>
                      <SelectContent>
                        {opts.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.bulto} · {o.dims}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button type="button" disabled={busy || loading} onClick={() => void onConfirmar()}>
            Reservar reemplazo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
