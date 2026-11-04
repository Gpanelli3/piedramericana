"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mecAlgunoActivo } from "./validacion";

type TarjetaResumenProps = {
  monedaPresupuesto: "ars" | "usd";
  dolarHoy: number;
  subtotalItems: number;
  descuentoGlobalPct: string;
  setDescuentoGlobalPct: (v: string) => void;
  netoItems: number;
  totalMecImporte: number;
  totalMecGlobal: string;
  setTotalMecGlobal: (v: string) => void;
  mMedicionGlobal: boolean;
  mEntregaGlobal: boolean;
  mColocacionGlobal: boolean;
  mecExcluidoTodasOts: boolean;
  totalPresupuesto: number;
  totalArsEquivalente: number;
};

function formatMoney(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function prefijo(moneda: "ars" | "usd"): string {
  return moneda === "usd" ? "US$" : "$";
}

export function TarjetaResumen({
  monedaPresupuesto,
  dolarHoy,
  subtotalItems,
  descuentoGlobalPct,
  setDescuentoGlobalPct,
  netoItems,
  totalMecImporte,
  totalMecGlobal,
  setTotalMecGlobal,
  mMedicionGlobal,
  mEntregaGlobal,
  mColocacionGlobal,
  mecExcluidoTodasOts,
  totalPresupuesto,
  totalArsEquivalente,
}: TarjetaResumenProps) {
  const monedaLabel = monedaPresupuesto === "usd" ? "USD" : "ARS";
  const p = prefijo(monedaPresupuesto);
  const mecActivo =
    !mecExcluidoTodasOts &&
    mecAlgunoActivo(mMedicionGlobal, mEntregaGlobal, mColocacionGlobal);

  return (
    <aside className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="bg-zinc-900 px-4 py-4 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
          Total
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
          {p}
          {formatMoney(totalPresupuesto)}
        </p>
        {monedaPresupuesto === "usd" && dolarHoy > 0 ? (
          <p className="mt-1 text-xs text-white/55 tabular-nums">
            ${formatMoney(totalArsEquivalente)} ARS
          </p>
        ) : (
          <p className="mt-1 text-xs text-white/55">{monedaLabel}</p>
        )}
      </div>

      <div className="space-y-4 px-4 py-4">
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Ítems</dt>
            <dd className="tabular-nums font-medium">
              {p}
              {formatMoney(subtotalItems)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="desc-global-resumen" className="text-muted-foreground font-normal">
              Descuento
            </Label>
            <div className="flex w-24 items-center gap-1">
              <Input
                id="desc-global-resumen"
                className="h-8 text-right text-sm tabular-nums"
                inputMode="decimal"
                placeholder="0"
                value={descuentoGlobalPct}
                onChange={(e) => setDescuentoGlobalPct(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
          {descuentoGlobalPct.trim() && Number(descuentoGlobalPct.replace(",", ".")) > 0 ? (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Neto ítems</dt>
              <dd className="tabular-nums font-medium">
                {p}
                {formatMoney(netoItems)}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="mec-resumen" className="text-muted-foreground font-normal">
              Servicios MEC
            </Label>
            {mecActivo ? (
              <div className="flex w-28 items-center gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <Input
                  id="mec-resumen"
                  className="h-8 text-right text-sm tabular-nums"
                  inputMode="decimal"
                  value={totalMecGlobal}
                  onChange={(e) => setTotalMecGlobal(e.target.value)}
                />
              </div>
            ) : (
              <dd className="tabular-nums text-muted-foreground">$0,00</dd>
            )}
          </div>
          {mecActivo ? (
            <p className="text-right text-[11px] tabular-nums text-muted-foreground">
              ${formatMoney(totalMecImporte)} ARS
            </p>
          ) : null}
        </dl>
      </div>
    </aside>
  );
}
