"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FechaInput } from "@/components/ui/fecha-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  acreditarMovimientoTarjeta,
  listTarjetaPendiente,
  validarMontoAcreditado,
  type MovimientoCajaRow,
} from "@/lib/finanzas-api";
import { formatFechaCorta, formatMonto } from "@/components/finanzas/finanzas-helpers";

type Props = {
  recargaKey: number;
  onAcreditado: () => void;
};

export function FinanzasTarjetaPendiente({ recargaKey, onAcreditado }: Props) {
  const [rows, setRows] = useState<MovimientoCajaRow[]>([]);
  const [draft, setDraft] = useState<Record<string, { checked: boolean; monto: string }>>({});
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);

  const recargar = useCallback(async () => {
    const res = await listTarjetaPendiente();
    if (res.error) toast.error(res.error.message);
    setRows(res.data);
    setDraft((prev) => {
      const next: Record<string, { checked: boolean; monto: string }> = {};
      for (const row of res.data) {
        next[row.id] = prev[row.id] ?? { checked: false, monto: String(row.monto) };
      }
      return next;
    });
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar, recargaKey]);

  async function onAcreditar() {
    const seleccion = rows.filter((m) => draft[m.id]?.checked);
    if (seleccion.length === 0) {
      toast.error("Tildá al menos un cobro pendiente.");
      return;
    }
    if (!fecha.trim()) {
      toast.error("Indicá la fecha de acreditación.");
      return;
    }
    setBusy(true);
    try {
      for (const m of seleccion) {
        const n = Number(String(draft[m.id]?.monto ?? "").replace(",", "."));
        const check = validarMontoAcreditado(Number(m.monto), n);
        if (!check.ok) {
          toast.error(check.error);
          return;
        }
        const res = await acreditarMovimientoTarjeta({
          movimientoId: m.id,
          montoAcreditado: n,
          fecha,
        });
        if (res.error) {
          toast.error(res.error.message);
          return;
        }
      }
      toast.success(
        seleccion.length === 1
          ? "Acreditación registrada."
          : `${seleccion.length} acreditaciones registradas.`,
      );
      await recargar();
      onAcreditado();
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" className="text-sm font-semibold" onClick={() => setOpen((v) => !v)}>
            Tarjeta por acreditar ({rows.length})
          </button>
          <p className="text-xs text-muted-foreground">
            Se cobró con tarjeta: la plata entra cuando la ves en el banco. Cargá cuánto ingresó de verdad.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Fecha de acreditación</Label>
            <FechaInput value={fecha} onChange={setFecha} />
          </div>
          <Button type="button" size="sm" disabled={busy} onClick={() => void onAcreditar()}>
            Registrar acreditación
          </Button>
        </div>
      </div>
      {open ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Fecha cobro</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="w-40 text-right">Ingresó</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => {
              const d = draft[m.id] ?? { checked: false, monto: String(m.monto) };
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <Checkbox
                      checked={d.checked}
                      onCheckedChange={(v) =>
                        setDraft((prev) => ({ ...prev, [m.id]: { ...d, checked: v === true } }))
                      }
                      aria-label={`Seleccionar cobro ${m.fecha}`}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">{formatFechaCorta(m.fecha)}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                    {m.descripcion ?? "Cobro con tarjeta"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatMonto(Number(m.monto), m.moneda)}
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-right"
                      inputMode="decimal"
                      value={d.monto}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, [m.id]: { ...d, monto: e.target.value } }))
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
