"use client";

import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  Download,
  Landmark,
  Plus,
  Scale,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SaldoCuentaRow } from "@/lib/finanzas-api";
import {
  etiquetaCajon,
  exportarCsv,
  formatMonto,
  totalesPorMoneda,
} from "@/components/finanzas/finanzas-helpers";
import type { LucideIcon } from "lucide-react";

type Props = {
  saldos: SaldoCuentaRow[];
  cargando: boolean;
  onTransferir: () => void;
  onNuevaCuenta: () => void;
};

function iconoTipo(tipo: SaldoCuentaRow["tipo"]): LucideIcon {
  switch (tipo) {
    case "banco":
      return Landmark;
    case "tarjeta":
      return CreditCard;
    case "cheque":
      return Banknote;
    case "caja":
      return Wallet;
    default:
      return Scale;
  }
}

export function FinanzasDisponibilidad({
  saldos,
  cargando,
  onTransferir,
  onNuevaCuenta,
}: Props) {
  const totales = totalesPorMoneda(saldos);
  const ars = saldos.filter((s) => s.moneda === "ars");
  const usd = saldos.filter((s) => s.moneda === "usd");

  function onExportar() {
    exportarCsv(
      `disponibilidad-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Cuenta", "Tipo", "Moneda", "Saldo"],
      saldos.map((s) => [etiquetaCajon(s), s.tipo, s.moneda.toUpperCase(), String(s.saldo_actual)]),
    );
    toast.success("Exportación lista.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Dónde está la plata: cajas, bancos, cheques y tarjetas — con su saldo.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onExportar} disabled={saldos.length === 0}>
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onTransferir}>
            <ArrowLeftRight className="h-4 w-4" />
            Transferir
          </Button>
          <Button type="button" size="sm" onClick={onNuevaCuenta}>
            <Plus className="h-4 w-4" />
            Nueva cuenta
          </Button>
        </div>
      </div>

      <SeccionCuentas
        titulo="Pesos (ARS)"
        totalLabel={cargando ? "…" : formatMonto(totales.ars, "ars")}
        filas={ars}
        cargando={cargando}
      />
      <SeccionCuentas
        titulo="Dólares (USD)"
        totalLabel={cargando ? "…" : formatMonto(totales.usd, "usd")}
        filas={usd}
        cargando={cargando}
      />
    </div>
  );
}

function SeccionCuentas({
  titulo,
  totalLabel,
  filas,
  cargando,
}: {
  titulo: string;
  totalLabel: string;
  filas: SaldoCuentaRow[];
  cargando: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <p className="text-sm font-medium tabular-nums text-muted-foreground">Total {totalLabel}</p>
      </div>
      {filas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {cargando ? "Cargando…" : "No hay cuentas en esta moneda."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filas.map((s) => {
            const Icon = iconoTipo(s.tipo);
            return (
              <Card key={s.cuenta_id} className="gap-0 py-0">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{etiquetaCajon(s)}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {formatMonto(Number(s.saldo_actual), s.moneda)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
