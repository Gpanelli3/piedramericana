"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Save, FileText } from "lucide-react";

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
  cotizacionMixtaActiva: boolean;
  setCotizacionMixtaActiva: (v: boolean) => void;
  lineasResumen: LineaResumenMoneda[];
  setLineaResumen: (id: string, patch: Partial<LineaResumenMoneda>) => void;
  monedaFinal: string;
  setMonedaFinal: (v: string) => void;
  totalUsdEquivalente: number;
  totalArsEquivalente: number;
};

export function PresupuestoResumenInterior({
  dolarHoy,
  cotizacionMixtaActiva,
  setCotizacionMixtaActiva,
  lineasResumen,
  setLineaResumen,
  monedaFinal,
  setMonedaFinal,
  totalUsdEquivalente,
  totalArsEquivalente,
}: PresupuestoResumenInteriorProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-row items-start justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="space-y-0.5 pr-2">
          <Label htmlFor="cot-mixta-dialog" className="text-sm font-semibold cursor-pointer">
            Cotización multimoneda
          </Label>
          <p className="text-xs text-muted-foreground leading-snug">
            Activa consejos cortos sobre cómo cargar rubros en distintas monedas.
          </p>
        </div>
        <Switch
          id="cot-mixta-dialog"
          className="shrink-0 mt-0.5"
          checked={cotizacionMixtaActiva}
          onCheckedChange={setCotizacionMixtaActiva}
        />
      </div>

      <div className="space-y-4">
        <p className="text-sm font-semibold text-foreground">Rubros</p>
        {lineasResumen.map((ln) => (
          <div
            key={ln.id}
            className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm space-y-3"
          >
            <p className="text-sm font-semibold text-foreground leading-snug">{ln.label}</p>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Importe
                </Label>
                <Input
                  className="h-11 text-base font-semibold tabular-nums text-right px-3"
                  value={ln.monto}
                  onChange={(e) => setLineaResumen(ln.id, { monto: e.target.value })}
                  inputMode="decimal"
                  placeholder={ln.moneda === "usd" ? "850" : "400000"}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Moneda del rubro
                </Label>
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
          </div>
        ))}
      </div>

      {cotizacionMixtaActiva && (
        <p className="text-xs text-muted-foreground leading-relaxed rounded-xl border border-sky-200/80 bg-sky-50/90 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30">
          Podés tener la <span className="font-semibold text-foreground">piedra / chapa</span> en USD y{" "}
          <span className="font-semibold text-foreground">mano de obra, perforaciones y fletes</span> en
          pesos; el total inferior unifica todo con{" "}
          <span className="font-semibold">Dólar hoy ({formatUsd(dolarHoy)})</span>.
        </p>
      )}

      <Separator />

      <div className="space-y-2">
        <Label className="text-sm font-semibold">¿Cómo lo ve el cliente?</Label>
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
      </div>

      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Total unificado</p>
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

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap pt-1">
        <Button
          type="button"
          className="flex-1 min-h-11 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold"
        >
          <Save className="h-4 w-4 mr-2 shrink-0" />
          Guardar presupuesto
        </Button>
        <Button type="button" className="flex-1 min-h-11 text-sm font-medium" variant="outline">
          <FileText className="h-4 w-4 mr-2 shrink-0" />
          Generar PDF
        </Button>
      </div>
    </div>
  );
}
