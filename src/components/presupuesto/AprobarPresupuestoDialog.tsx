"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FechaInput } from "@/components/ui/fecha-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { METODOS_COBRO_UI } from "@/lib/finanzas-api";
import { calcularRetencion, metodoAplicaRetencion } from "@/lib/retencion-reglas";
import { validateFinanzasComprobanteFile } from "@/lib/finanzas-documentos-storage";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type PresupuestoRowAprobacion = {
  id: string;
  numero: string;
  cliente: string;
  total: number;
  moneda: "ars" | "usd";
};

export type AprobarPresupuestoPayload = {
  totalAprobado: number;
  montoSenia: number;
  fecha: string;
  metodo: string;
  nota: string;
  retencionPorcentaje?: number;
  retencionMonto?: number;
  comprobante?: File | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PresupuestoRowAprobacion | null;
  busy: boolean;
  onConfirm: (payload: AprobarPresupuestoPayload) => Promise<void>;
};

function parseMontoCampo(raw: string): number | null {
  const t = String(raw).replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function AprobarPresupuestoDialog({ open, onOpenChange, row, busy, onConfirm }: Props) {
  const [totalStr, setTotalStr] = useState("");
  const [senaStr, setSenaStr] = useState("");
  const [fecha, setFecha] = useState("");
  const [metodo, setMetodo] = useState("transferencia");
  const [nota, setNota] = useState("");
  const [esAgente, setEsAgente] = useState(false);
  const [pctCliente, setPctCliente] = useState<number | null>(null);
  const [retencionPctStr, setRetencionPctStr] = useState("");
  const [retencionMontoStr, setRetencionMontoStr] = useState("");
  const [retencionMontoManual, setRetencionMontoManual] = useState(false);
  const [comprobante, setComprobante] = useState<File | null>(null);

  useEffect(() => {
    if (!open || !row) return;
    setTotalStr(String(row.total));
    setSenaStr("0");
    setFecha(new Date().toISOString().slice(0, 10));
    setMetodo("transferencia");
    setNota("");
    setComprobante(null);
    setRetencionMontoManual(false);
    setEsAgente(false);
    setPctCliente(null);
    setRetencionPctStr("");
    setRetencionMontoStr("");

    if (!isSupabaseConfigured) return;
    let cancelled = false;
    void (async () => {
      const pres = await supabase
        .from("presupuestos")
        .select("client_id")
        .eq("id", row.id)
        .maybeSingle();
      if (cancelled || pres.error || !pres.data?.client_id) return;
      const cli = await supabase
        .from("clients")
        .select("es_agente_retencion, retencion_porcentaje")
        .eq("id", pres.data.client_id)
        .maybeSingle();
      if (cancelled || cli.error || !cli.data) return;
      const agente = Boolean(cli.data.es_agente_retencion);
      const n = Number(cli.data.retencion_porcentaje);
      const pct = agente && Number.isFinite(n) ? n : null;
      setEsAgente(agente);
      setPctCliente(pct);
      setRetencionPctStr(pct != null ? String(pct) : "");
    })();
    return () => {
      cancelled = true;
    };
  }, [open, row?.id]);

  const monedaLabel = row?.moneda === "usd" ? "USD" : "ARS";
  const senaNum = parseMontoCampo(senaStr) ?? 0;
  const muestraRetencion = esAgente && metodoAplicaRetencion(metodo) && senaNum > 0;
  const retencionPreview = useMemo(
    () =>
      calcularRetencion({
        bruto: senaNum,
        esAgente,
        metodo,
        porcentajeCliente: pctCliente,
        porcentajeOverride: parseMontoCampo(retencionPctStr),
        retencionMontoOverride: retencionMontoManual ? parseMontoCampo(retencionMontoStr) : undefined,
      }),
    [senaNum, esAgente, metodo, pctCliente, retencionPctStr, retencionMontoStr, retencionMontoManual],
  );

  const handleSubmit = async () => {
    if (!row) return;
    const total = Number(String(totalStr).replace(",", "."));
    const sena = Number(String(senaStr).replace(",", "."));
    if (!Number.isFinite(total) || total < 0) return;
    if (!Number.isFinite(sena) || sena < 0) return;
    if (sena > total) return;
    if (sena > 0 && retencionPreview.error) {
      toast.error(retencionPreview.error);
      return;
    }
    if (comprobante) {
      const fileErr = validateFinanzasComprobanteFile(comprobante);
      if (fileErr) {
        toast.error(fileErr);
        return;
      }
    }
    await onConfirm({
      totalAprobado: total,
      montoSenia: sena,
      fecha,
      metodo: metodo || "transferencia",
      nota: nota.trim(),
      retencionPorcentaje: retencionPreview.aplica ? retencionPreview.porcentaje : undefined,
      retencionMonto: retencionPreview.aplica ? retencionPreview.retencionMonto : undefined,
      comprobante,
    });
  };

  const senaInvalida =
    Number.isFinite(Number(String(senaStr).replace(",", "."))) &&
    Number(String(senaStr).replace(",", ".")) > Number(String(totalStr).replace(",", "."));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>Aprobar presupuesto</DialogTitle>
          <DialogDescription className="text-left">
            Confirmá el total del trabajo y la seña que ingresa ahora (puede ser el monto total o una parte). Los
            cobros posteriores se registran solo en{" "}
            <span className="font-medium text-foreground">Ventas</span> (menú lateral).
          </DialogDescription>
        </DialogHeader>

        {row ?
          <div className="space-y-4 text-sm">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
              <p className="font-medium text-foreground">{row.numero}</p>
              <p className="text-muted-foreground">{row.cliente}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ap-total">Total aprobado ({monedaLabel})</Label>
              <Input
                id="ap-total"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={totalStr}
                onChange={(e) => setTotalStr(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ap-sena">Seña que ingresa ahora ({monedaLabel})</Label>
              <Input
                id="ap-sena"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={senaStr}
                onChange={(e) => setSenaStr(e.target.value)}
              />
              {senaInvalida ?
                <p className="text-xs text-destructive">La seña no puede superar el total aprobado.</p>
              : (
                <p className="text-xs text-muted-foreground leading-snug">
                  Si ponés 0, la venta queda sin cobros hasta que cargues el primer pago en Ventas.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ap-fecha">Fecha del pago</Label>
                <FechaInput id="ap-fecha" value={fecha} onChange={setFecha} />
              </div>
              <div className="space-y-1.5">
                <Label>Cómo se paga</Label>
                <Select
                  value={metodo}
                  onValueChange={(v) => {
                    setMetodo(v);
                    setRetencionMontoManual(false);
                    setRetencionPctStr(pctCliente != null ? String(pctCliente) : "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METODOS_COBRO_UI.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {muestraRetencion ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ap-ret-pct">Retención %</Label>
                  <Input
                    id="ap-ret-pct"
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={retencionPctStr}
                    onChange={(e) => {
                      setRetencionPctStr(e.target.value);
                      setRetencionMontoManual(false);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-ret-monto">Retención</Label>
                  <Input
                    id="ap-ret-monto"
                    type="number"
                    min={0}
                    step="any"
                    value={
                      retencionMontoManual
                        ? retencionMontoStr
                        : String(retencionPreview.retencionMonto || "")
                    }
                    onChange={(e) => {
                      setRetencionMontoManual(true);
                      setRetencionMontoStr(e.target.value);
                    }}
                  />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  Entra a caja: {retencionPreview.neto.toLocaleString("es-AR")} {monedaLabel}
                </p>
              </div>
            ) : esAgente && senaNum > 0 ? (
              <p className="text-xs text-muted-foreground">
                En efectivo, tarjeta y Mercado Pago no se descuenta retención.
              </p>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="ap-nota">Nota (opcional)</Label>
              <Textarea id="ap-nota" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ap-comp">Comprobante (opcional)</Label>
              <Input
                id="ap-comp"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f) {
                    const err = validateFinanzasComprobanteFile(f);
                    if (err) {
                      toast.error(err);
                      e.target.value = "";
                      setComprobante(null);
                      return;
                    }
                  }
                  setComprobante(f);
                }}
              />
            </div>
          </div>
        : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy || !row || senaInvalida}
          >
            {busy ? "Guardando…" : "Aprobar y pasar a ventas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
