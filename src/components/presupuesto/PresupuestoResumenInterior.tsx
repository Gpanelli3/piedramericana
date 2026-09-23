"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatMetraje, formatToneladas } from "@/lib/presupuesto-calculos";

export type LineaResumenMoneda = {
  id: string;
  label: string;
  monto: string;
  moneda: "usd" | "ars";
};

function formatArs(n: number): string {
  try {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(n));
  } catch {
    return String(Math.round(n));
  }
}

function formatUsd(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type PresupuestoResumenInteriorProps = {
  dolarHoy: number;
  setDolarHoy?: (n: number) => void;
  cotizacionMixtaActiva: boolean;
  setCotizacionMixtaActiva: (v: boolean) => void;
  lineasResumen: LineaResumenMoneda[];
  setLineaResumen: (id: string, patch: Partial<LineaResumenMoneda>) => void;
  monedaFinal: string;
  setMonedaFinal: (v: string) => void;
  totalUsdEquivalente: number;
  totalArsEquivalente: number;
  /** m² totales de líneas que calculan material. */
  materialM2Presupuesto?: number;
  /** Toneladas equivalentes (piedra no mármol con peso cargado). */
  materialTonEstimadoPresupuesto?: number | null;
  /** Solo lectura: impresión o resumen guardado. */
  readOnly?: boolean;
  /** Rubros cuyo importe y moneda vienen del cálculo (no editables aquí). */
  rubrosImportesBloqueados?: readonly string[];
};

export function PresupuestoResumenInterior({
  dolarHoy,
  setDolarHoy,
  cotizacionMixtaActiva,
  setCotizacionMixtaActiva,
  lineasResumen,
  setLineaResumen,
  monedaFinal,
  setMonedaFinal,
  totalUsdEquivalente,
  totalArsEquivalente,
  materialM2Presupuesto = 0,
  materialTonEstimadoPresupuesto = null,
  readOnly = false,
  rubrosImportesBloqueados,
}: PresupuestoResumenInteriorProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-row items-start justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="space-y-0.5 pr-2">
          <Label htmlFor="cot-mixta-dialog" className="text-sm font-semibold cursor-pointer">
            Cotización multimoneda
          </Label>
          <p className="text-xs text-muted-foreground leading-snug">
            Producto en la moneda de la lista e instalación (MEC) en pesos, unidos con el dólar del día.
          </p>
        </div>
        {readOnly ? (
          <span className="text-sm text-muted-foreground shrink-0">
            {cotizacionMixtaActiva ? "Activada" : "Desactivada"}
          </span>
        ) : (
          <Switch
            id="cot-mixta-dialog"
            className="shrink-0 mt-0.5"
            checked={cotizacionMixtaActiva}
            onCheckedChange={setCotizacionMixtaActiva}
          />
        )}
      </div>

      <div className="space-y-4">
        <p className="text-sm font-semibold text-foreground">Rubros</p>
        {lineasResumen.map((ln) => {
          const importeNoEditable =
            readOnly || Boolean(rubrosImportesBloqueados?.includes(ln.id));
          return (
          <div
            key={ln.id}
            className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm space-y-3"
          >
            <p className="text-sm font-semibold text-foreground leading-snug">{ln.label}</p>
            {ln.id === "piedra" && !readOnly ? (
              <p className="text-xs text-muted-foreground leading-snug">
                Monto igual al subtotal de ítems con descuento (se actualiza al cargar las líneas OT).
              </p>
            ) : null}
            {importeNoEditable ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Importe</p>
                  <p className="font-semibold tabular-nums">
                    {ln.moneda === "usd" ? `USD ${formatUsd(Number(ln.monto) || 0)}` : `$ ${formatArs(Number(ln.monto) || 0)}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Moneda del rubro</p>
                  <p className="font-medium">{ln.moneda === "usd" ? "USD" : "ARS"}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Importe</Label>
                  <Input
                    className="h-11 text-base font-semibold tabular-nums text-right px-3"
                    value={ln.monto}
                    onChange={(e) => setLineaResumen(ln.id, { monto: e.target.value })}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Moneda del rubro</Label>
                  <ToggleGroup
                    type="single"
                    value={ln.moneda}
                    onValueChange={(v) => {
                      if (v === "usd" || v === "ars") setLineaResumen(ln.id, { moneda: v });
                    }}
                    variant="outline"
                    size="sm"
                    className="flex w-full justify-stretch rounded-md"
                  >
                    <ToggleGroupItem value="usd" className="flex-1 text-xs sm:text-sm">
                      USD
                    </ToggleGroupItem>
                    <ToggleGroupItem value="ars" className="flex-1 text-xs sm:text-sm">
                      ARS
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            )}
          </div>
        );
        })}
      </div>

      {cotizacionMixtaActiva && (
        <div className="space-y-2 rounded-xl border border-sky-200/80 bg-sky-50/90 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30">
          <p className="text-xs text-muted-foreground leading-relaxed">
            La <span className="font-semibold text-foreground">piedra / producto</span> va en la moneda de la lista
            y la <span className="font-semibold text-foreground">instalación (MEC)</span> en pesos. El total se
            unifica con el dólar del día.
          </p>
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium shrink-0">Dólar del día</Label>
            {readOnly || !setDolarHoy ? (
              <span className="text-sm font-semibold tabular-nums">{formatUsd(dolarHoy)}</span>
            ) : (
              <Input
                className="h-8 w-28 text-right text-sm tabular-nums"
                inputMode="decimal"
                value={dolarHoy > 0 ? String(dolarHoy) : ""}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  setDolarHoy(Number.isFinite(n) && n > 0 ? n : 0);
                }}
              />
            )}
          </div>
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <Label className="text-sm font-semibold">¿Cómo lo ve el cliente?</Label>
        {readOnly ? (
          <p className="text-sm text-foreground">
            {monedaFinal === "pesos" ? "Total en pesos (ARS)" : "Total en dólares (USD)"}
          </p>
        ) : (
          <ToggleGroup
            type="single"
            value={monedaFinal}
            onValueChange={(v) => {
              if (v === "pesos" || v === "dolares") setMonedaFinal(v);
            }}
            variant="outline"
            className="flex w-full justify-stretch"
          >
            <ToggleGroupItem value="pesos" className="flex-1 text-sm">
              Total en pesos (ARS)
            </ToggleGroupItem>
            <ToggleGroupItem value="dolares" className="flex-1 text-sm">
              Total en dólares (USD)
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5 space-y-2">
        <p className="text-xs font-semibold text-primary">Total unificado</p>
        <p className="text-3xl font-extrabold text-primary tracking-tight break-all leading-none">
          {monedaFinal === "pesos"
            ? `$ ${formatArs(totalArsEquivalente)}`
            : `USD ${formatUsd(totalUsdEquivalente)}`}
        </p>
        <p className="text-sm text-muted-foreground">
          Equivalente{" "}
          {monedaFinal === "pesos"
            ? `≈ USD ${formatUsd(totalUsdEquivalente)}`
            : `≈ $ ${formatArs(totalArsEquivalente)} ARS`}
        </p>
      </div>

      {materialM2Presupuesto > 0 &&
      materialTonEstimadoPresupuesto != null &&
      materialTonEstimadoPresupuesto > 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-foreground">Piedra natural (no mármol) — referencia</p>
          <p className="text-sm tabular-nums text-foreground">
            <span className="text-muted-foreground">Superficie material:</span>{" "}
            {formatMetraje(materialM2Presupuesto)}{" "}
            m²
          </p>
          <p className="text-sm font-semibold tabular-nums text-primary">
            ≈{" "}
            {formatToneladas(materialTonEstimadoPresupuesto)}{" "}
            ton (según peso/kg m² del maestro)
          </p>
        </div>
      ) : null}
    </div>
  );
}
