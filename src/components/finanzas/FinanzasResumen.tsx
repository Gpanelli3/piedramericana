"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Landmark,
  Scale,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  hayCierreEnFecha,
  listMovimientos,
  listTarjetaPendiente,
  registrarCierreCaja,
  resumenCajaDelDia,
  resumenMesPorMetodo,
  resumenPorCobrar,
  resumenPorPagarMes,
  etiquetaMetodo,
  type CuentaFinancieraRow,
  type MovimientoCajaRow,
  type SaldoCuentaRow,
  type SaldoMesPorMetodo,
} from "@/lib/finanzas-api";
import type { FinanzasSeccion } from "@/types/workspace";
import {
  contraparteDesdeMovimiento,
  esSalida,
  etiquetaCajon,
  formatMonto,
  totalesPorMoneda,
} from "@/components/finanzas/finanzas-helpers";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Props = {
  saldos: SaldoCuentaRow[];
  cuentas: CuentaFinancieraRow[];
  cargandoSaldos: boolean;
  suppliersById: Map<string, string>;
  onGoto: (seccion: FinanzasSeccion) => void;
  onAbrirMovimiento: (m: MovimientoCajaRow) => void;
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

function totalGrande(n: number, moneda: "ars" | "usd"): string {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: moneda === "usd" ? 0 : 0,
    maximumFractionDigits: moneda === "usd" ? 2 : 0,
  };
  return `${moneda.toUpperCase()} $${n.toLocaleString("es-AR", opts)}`;
}

export function FinanzasResumen({
  saldos,
  cuentas,
  cargandoSaldos,
  suppliersById,
  onGoto,
  onAbrirMovimiento,
}: Props) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [movimientos, setMovimientos] = useState<MovimientoCajaRow[]>([]);
  const [resumenDia, setResumenDia] = useState<{
    ingresos: number;
    egresos: number;
    neto: number;
    porMetodo: Record<string, number>;
  } | null>(null);
  const [porCobrar, setPorCobrar] = useState({ usd: 0, ars: 0, ventasConSaldo: 0 });
  const [porPagar, setPorPagar] = useState({ ars: 0, usd: 0, cantidad: 0 });
  const [mesMetodo, setMesMetodo] = useState<SaldoMesPorMetodo[]>([]);
  const [tarjetaPendiente, setTarjetaPendiente] = useState(0);
  const [cajaCerrada, setCajaCerrada] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cerrando, setCerrando] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    const [m, r, cob, pag, mes, tar, cie] = await Promise.all([
      listMovimientos({ limit: 10 }),
      resumenCajaDelDia(hoy),
      resumenPorCobrar(),
      resumenPorPagarMes(hoy),
      resumenMesPorMetodo(hoy),
      listTarjetaPendiente(),
      hayCierreEnFecha(hoy),
    ]);
    if (m.error) toast.error(m.error.message);
    if (r.error) toast.error(r.error.message);
    if (cob.error) toast.error(cob.error.message);
    if (pag.error) toast.error(pag.error.message);
    if (mes.error) toast.error(mes.error.message);
    if (tar.error) toast.error(tar.error.message);
    if (cie.error) toast.error(cie.error.message);
    setMovimientos(m.data);
    setResumenDia(r.data);
    setPorCobrar(cob.data);
    setPorPagar(pag.data);
    setMesMetodo(mes.data);
    setTarjetaPendiente(tar.data.length);
    setCajaCerrada(cie.cerrado);
    setCargando(false);
  }, [hoy]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const totales = useMemo(() => totalesPorMoneda(saldos), [saldos]);
  const cuentasLista = useMemo(
    () => [...saldos.filter((s) => s.moneda === "ars"), ...saldos.filter((s) => s.moneda === "usd")],
    [saldos],
  );

  async function onCerrarCaja() {
    const cajas = cuentas.filter((c) => c.tipo === "caja" && c.activa);
    if (cajas.length === 0) {
      toast.error("No hay una caja para cerrar.");
      return;
    }
    setCerrando(true);
    try {
      for (const c of cajas) {
        const res = await registrarCierreCaja({ cuentaId: c.id, fecha: hoy });
        if (res.error) {
          toast.error(res.error.message);
          return;
        }
      }
      toast.success("Caja del día cerrada.");
      setCajaCerrada(true);
    } finally {
      setCerrando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        <div className="space-y-3">
          <Card className="gap-0 py-0">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">Disponibilidad</p>
                <button
                  type="button"
                  className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onGoto("disponibilidad")}
                >
                  Ver todo
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <p className="text-xl font-semibold tabular-nums tracking-tight">
                  {cargandoSaldos ? "…" : totalGrande(totales.ars, "ars")}
                </p>
                <p className="text-sm font-semibold tabular-nums text-muted-foreground">
                  {cargandoSaldos ? "" : totalGrande(totales.usd, "usd")}
                </p>
              </div>
              <ul className="mt-2.5">
                {cuentasLista.map((s) => {
                  const Icon = iconoTipo(s.tipo);
                  return (
                    <li key={s.cuenta_id} className="flex items-center justify-between gap-2 py-[5px] text-[13px]">
                      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{etiquetaCajon(s)}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-foreground">
                        {formatMonto(Number(s.saldo_actual), s.moneda)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-2">
            <Card className="gap-0 py-0">
              <CardContent className="p-3">
                <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  Hoy
                </p>
                <p
                  className={cn(
                    "mt-1 text-lg font-semibold tabular-nums",
                    (resumenDia?.neto ?? 0) < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400",
                  )}
                >
                  {cargando || !resumenDia
                    ? "…"
                    : `${(resumenDia.neto ?? 0) < 0 ? "−" : "+"}${formatMonto(Math.abs(resumenDia.neto), "ars")}`}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 h-6 px-2 text-[11px]"
                  disabled={cerrando || cajaCerrada}
                  onClick={() => void onCerrarCaja()}
                >
                  {cajaCerrada ? "Cerrada" : "Sin cerrar"}
                </Button>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Por cobrar</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {cargando ? "…" : formatMonto(porCobrar.usd, "usd")}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {porCobrar.ventasConSaldo} {porCobrar.ventasConSaldo === 1 ? "venta con saldo" : "ventas con saldo"}
                </p>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Por pagar</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-destructive">
                  {cargando ? "…" : formatMonto(porPagar.ars, "ars")}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {porPagar.cantidad === 0
                    ? "Al día"
                    : `${porPagar.cantidad} pendiente${porPagar.cantidad === 1 ? "" : "s"}`}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="gap-0 py-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Últimos movimientos</p>
              <button
                type="button"
                className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onGoto("movimientos")}
              >
                Ver todos
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="mt-1">
              {movimientos.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  {cargando ? "Cargando…" : "Sin movimientos."}
                </li>
              ) : (
                movimientos.slice(0, 8).map((m) => {
                  const salida = esSalida(m.tipo);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 py-1.5 text-left hover:bg-muted/40"
                        onClick={() => onAbrirMovimiento(m)}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                            salida ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700",
                          )}
                        >
                          {salida ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium leading-tight">
                            {contraparteDesdeMovimiento(m, suppliersById)}
                          </span>
                          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                            {etiquetaCajon(
                              cuentas.find((c) => c.id === m.cuenta_id) ?? {
                                tipo: "otro",
                                moneda: m.moneda,
                              },
                            )}
                            {m.descripcion ? ` · ${m.descripcion}` : ""}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-[13px] font-semibold tabular-nums",
                            salida ? "text-destructive" : "text-emerald-700 dark:text-emerald-400",
                          )}
                        >
                          {salida ? "−" : "+"}
                          {formatMonto(Number(m.monto), m.moneda)}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {tarjetaPendiente > 0 ? (
        <button
          type="button"
          onClick={() => onGoto("movimientos")}
          className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
        >
          Hay {tarjetaPendiente} cobro{tarjetaPendiente === 1 ? "" : "s"} con tarjeta pendiente
          {tarjetaPendiente === 1 ? "" : "s"} de acreditar.
        </button>
      ) : null}

      <Card className="gap-0 py-0">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Saldo de caja por forma de pago</p>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </div>
          {mesMetodo.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {cargando ? "Cargando…" : "Sin movimientos este mes."}
            </p>
          ) : (
            <ul className="mt-1">
              {mesMetodo.map((row) => (
                <li
                  key={`${row.metodo}-${row.moneda}`}
                  className="flex items-center justify-between gap-3 py-1.5 text-[13px]"
                >
                  <span>
                    {etiquetaMetodo(row.metodo)}{" "}
                    <span className="uppercase text-muted-foreground">{row.moneda}</span>
                  </span>
                  <span className="tabular-nums">{formatMonto(row.neto, row.moneda)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
