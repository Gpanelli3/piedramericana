"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FileText, Paperclip, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  abrirComprobanteMovimiento,
  adjuntarComprobanteMovimiento,
  getOrigenMovimiento,
  etiquetaConcepto,
  etiquetaMetodo,
  type CuentaFinancieraRow,
  type MovimientoCajaRow,
  type OrigenMovimiento,
} from "@/lib/finanzas-api";
import { validateFinanzasComprobanteFile } from "@/lib/finanzas-documentos-storage";
import {
  contraparteDesdeMovimiento,
  esSalida,
  etiquetaCajon,
  etiquetaOrigen,
  etiquetaTipoMov,
  formatFechaCorta,
  formatFechaHora,
  formatMonto,
} from "@/components/finanzas/finanzas-helpers";
import { cn } from "@/lib/utils";

type Props = {
  movimiento: MovimientoCajaRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentas: CuentaFinancieraRow[];
  suppliersById: Map<string, string>;
  onChanged: () => void;
};

export function MovimientoDetallePanel({
  movimiento,
  open,
  onOpenChange,
  cuentas,
  suppliersById,
  onChanged,
}: Props) {
  const [origen, setOrigen] = useState<OrigenMovimiento | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !movimiento) {
      setOrigen(null);
      return;
    }
    let cancelled = false;
    void getOrigenMovimiento(movimiento).then((res) => {
      if (cancelled) return;
      if (res.error) toast.error(res.error.message);
      setOrigen(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, movimiento]);

  const m = movimiento;
  if (!m) return null;

  const cuenta = cuentas.find((c) => c.id === m.cuenta_id) ?? null;
  const salida = esSalida(m.tipo);
  const contraparte = origen?.contraparte || contraparteDesdeMovimiento(m, suppliersById);

  async function onAdjuntar(file: File | null) {
    if (!file || !m) return;
    const err = validateFinanzasComprobanteFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    const res = await adjuntarComprobanteMovimiento(m.id, file);
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Comprobante adjunto.");
    onChanged();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border pr-10">
          <div className="flex items-center gap-2">
            <SheetTitle className="truncate text-base">{contraparte}</SheetTitle>
            <Badge variant={salida ? "soft" : "success"}>{etiquetaTipoMov(m.tipo)}</Badge>
          </div>
          <SheetDescription>{formatFechaCorta(m.fecha)}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4">
          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {salida ? "Egreso" : "Ingreso"}
            </p>
            <p
              className={cn(
                "mt-1 text-3xl font-semibold tabular-nums",
                salida ? "text-destructive" : "text-green-700 dark:text-green-400",
              )}
            >
              {salida ? "−" : "+"}
              {formatMonto(Number(m.monto), m.moneda)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{etiquetaMetodo(m.metodo)}</span>
              <span>·</span>
              <span>{cuenta ? etiquetaCajon(cuenta) : "Sin cuenta"}</span>
              {m.moneda === "usd" ? (
                <>
                  <span>·</span>
                  <span>USD</span>
                </>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registro</p>
            <dl className="mt-3 space-y-2 text-sm">
              <Fila label="Registrado por">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {origen?.registradoPor ?? "—"}
                </span>
              </Fila>
              <Fila label="Cargado el">{formatFechaHora(m.created_at)}</Fila>
              <Fila label="Concepto">{etiquetaConcepto(m.concepto)}</Fila>
              <Fila label="Comprobante">
                <span className="inline-flex items-center gap-1">
                  {m.comprobante_path ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() =>
                        void abrirComprobanteMovimiento(m.comprobante_path as string).then((r) => {
                          if (r.error) toast.error(r.error.message);
                        })
                      }
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Ver
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">Sin archivo</span>
                  )}
                  <label className="inline-flex">
                    <input
                      type="file"
                      className="hidden"
                      disabled={busy}
                      accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        void onAdjuntar(f);
                      }}
                    />
                    <span className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs hover:bg-muted">
                      <Paperclip className="h-3.5 w-3.5" />
                      {m.comprobante_path ? "Cambiar" : "Adjuntar"}
                    </span>
                  </label>
                </span>
              </Fila>
            </dl>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Origen</p>
            <dl className="mt-3 space-y-2 text-sm">
              <Fila label="Tipo">{etiquetaOrigen(m.referencia_tipo)}</Fila>
              {origen?.presupuestoNumero ? (
                <Fila label="Presupuesto">
                  <span className="font-medium text-amber-800 dark:text-amber-300">
                    {origen.presupuestoNumero}
                    {origen.otTitulo ? ` · ${origen.otTitulo}` : ""}
                  </span>
                </Fila>
              ) : null}
              {m.descripcion ? <Fila label="Detalle">{m.descripcion}</Fila> : null}
            </dl>
          </section>

          {origen?.saldoObra != null && origen.monedaObra ? (
            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Saldo de esta obra
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatMonto(origen.saldoObra, origen.monedaObra)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Total {formatMonto(origen.totalObra ?? 0, origen.monedaObra)} · Cobrado{" "}
                {formatMonto(origen.cobradoObra ?? 0, origen.monedaObra)}
              </p>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Fila({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}
