"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMetraje, formatToneladas } from "@/lib/presupuesto-calculos";
import { cn } from "@/lib/utils";
import { mecAlgunoActivo } from "./validacion";
import { SectionPresupuesto } from "./fields";

type PorOtTot = {
  key: string;
  titulo: string;
  subtotal: number;
  m2: number;
  ml: number;
  ton: number;
  cantLineas: number;
};

type StepConfirmacionProps = {
  clienteNombre: string;
  listaPrecioLabel: string;
  origenLabel: string;
  monedaPresupuesto: "ars" | "usd";
  dolarHoy: number;
  setDolarHoy: (n: number) => void;
  totalArsEquivalente: number;
  ordenesCount: number;
  lineItemsCount: number;
  faltaPesoNonMarmol: boolean;
  totalesPorOt: PorOtTot[];
  mMedicionGlobal: boolean;
  setMMedicionGlobal: (v: boolean) => void;
  mEntregaGlobal: boolean;
  setMEntregaGlobal: (v: boolean) => void;
  mColocacionGlobal: boolean;
  setMColocacionGlobal: (v: boolean) => void;
  totalMecGlobal: string;
  setTotalMecGlobal: (v: string) => void;
  obsServiciosMec: string;
  setObsServiciosMec: (v: string) => void;
  totalesItemsSubtotal: number;
  descuentoGlobalPct: string;
  setDescuentoGlobalPct: (v: string) => void;
  totalesItemsTotalConDesc: number;
  totalMecImporte: number;
  totalPresupuesto: number;
  totalesTotalM2: number;
  totalesTotalMl: number;
  totalesTotalTon: number;
  mecExcluidoTodasOts?: boolean;
};

function formatMoney(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function MetaCard({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/15 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground" title={title ?? value}>
        {value || "—"}
      </p>
    </div>
  );
}

function TotMetric({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex min-w-[7.5rem] flex-1 flex-col gap-1.5">
      <p
        className={cn(
          "text-[11px] leading-none text-muted-foreground",
          strong && "font-semibold text-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "flex h-8 items-center truncate text-sm tabular-nums",
          strong ? "text-base font-bold text-foreground" : "font-medium",
          muted && !strong && "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function StepConfirmacion(props: StepConfirmacionProps) {
  const {
    clienteNombre,
    listaPrecioLabel,
    origenLabel,
    monedaPresupuesto,
    dolarHoy,
    setDolarHoy,
    totalArsEquivalente,
    ordenesCount,
    lineItemsCount,
    faltaPesoNonMarmol,
    totalesPorOt,
    mMedicionGlobal,
    setMMedicionGlobal,
    mEntregaGlobal,
    setMEntregaGlobal,
    mColocacionGlobal,
    setMColocacionGlobal,
    totalMecGlobal,
    setTotalMecGlobal,
    obsServiciosMec,
    setObsServiciosMec,
    totalesItemsSubtotal,
    descuentoGlobalPct,
    setDescuentoGlobalPct,
    totalesItemsTotalConDesc,
    totalMecImporte,
    totalPresupuesto,
    totalesTotalM2,
    totalesTotalMl,
    totalesTotalTon,
    mecExcluidoTodasOts = false,
  } = props;

  const monedaLabel = monedaPresupuesto === "usd" ? "USD" : "ARS";
  const prefijoItems = monedaPresupuesto === "usd" ? "US$" : "$";
  const mecActivo =
    !mecExcluidoTodasOts && mecAlgunoActivo(mMedicionGlobal, mEntregaGlobal, mColocacionGlobal);
  const mixta = monedaPresupuesto === "usd";

  return (
    <SectionPresupuesto borderAccentClass="border-t-4 border-t-violet-500">
      <div className="space-y-5">
        {/* 1. Resumen cabecera */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetaCard label="Cliente" value={clienteNombre} />
          <MetaCard
            label="Lista / moneda"
            value={`${listaPrecioLabel} · ${monedaLabel}`}
          />
          <MetaCard label="Origen" value={origenLabel} />
          <MetaCard
            label="OT / líneas"
            value={`${ordenesCount} OT · ${lineItemsCount} líneas`}
          />
        </div>

        <section className="rounded-md border border-border/70 bg-card">
          <header className="border-b border-border/60 px-3 py-2">
            <h3 className="text-xs font-semibold text-foreground">Órdenes de trabajo</h3>
          </header>
          <ul className="max-h-56 divide-y divide-border/50 overflow-y-auto">
            {totalesPorOt.map((p, i) => (
              <li key={p.key} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    <span className="mr-1.5 text-muted-foreground">OT {i + 1}</span>
                    {p.titulo}
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {p.cantLineas} líneas · {formatMetraje(p.m2)} m² · {formatMetraje(p.ml)} ml
                    {p.ton > 0 ? ` · ${formatToneladas(p.ton)} ton` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {prefijoItems}{formatMoney(p.subtotal)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {faltaPesoNonMarmol ? (
          <p className="rounded-md border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            Alguna OT con material no mármol sin kg/m² en el maestro (Cantera). Las toneladas
            pueden quedar incompletas.
          </p>
        ) : null}

        <section className="rounded-md border border-emerald-600/25 bg-emerald-50/40 px-3 py-3 dark:bg-emerald-950/20 sm:px-4">
          <div className="grid items-end gap-x-5 gap-y-3 md:grid-cols-[minmax(0,1.15fr)_11rem_minmax(0,1.15fr)]">
            <div className="space-y-2.5">
              <div>
                <h3 className="text-xs font-semibold text-foreground">Servicios MEC</h3>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {mecExcluidoTodasOts
                    ? "Todas las OTs están marcadas sin MEC: el importe pasa a $0."
                    : monedaPresupuesto === "usd"
                      ? "Marcá lo que se cobra. El MEC se carga en pesos y se pasa a dólares con el tipo de cambio."
                      : "Marcá lo que se cobra. Ítems y MEC van en pesos."}
                </p>
              </div>
              <div className="flex h-9 flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="mg-m-step"
                    checked={mMedicionGlobal}
                    onCheckedChange={(c) => setMMedicionGlobal(Boolean(c))}
                    disabled={mecExcluidoTodasOts}
                  />
                  <Label htmlFor="mg-m-step" className="text-xs font-medium">
                    Medición
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="mg-e-step"
                    checked={mEntregaGlobal}
                    onCheckedChange={(c) => setMEntregaGlobal(Boolean(c))}
                    disabled={mecExcluidoTodasOts}
                  />
                  <Label htmlFor="mg-e-step" className="text-xs font-medium">
                    Entrega
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="mg-c-step"
                    checked={mColocacionGlobal}
                    onCheckedChange={(c) => setMColocacionGlobal(Boolean(c))}
                    disabled={mecExcluidoTodasOts}
                  />
                  <Label htmlFor="mg-c-step" className="text-xs font-medium">
                    Colocación
                  </Label>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] leading-none text-muted-foreground">Importe MEC (ARS)</Label>
              <Input
                className="h-9 text-sm tabular-nums"
                inputMode="decimal"
                value={totalMecGlobal}
                onChange={(e) => setTotalMecGlobal(e.target.value)}
                disabled={!mecActivo}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label className="text-[11px] leading-none text-muted-foreground">Observaciones MEC</Label>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {obsServiciosMec.length}/500
                </span>
              </div>
              <Textarea
                className="h-9 min-h-9 resize-none py-2 text-sm"
                placeholder="Notas sobre medición, entrega o colocación…"
                maxLength={500}
                value={obsServiciosMec}
                onChange={(e) => setObsServiciosMec(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-md border border-border/80 bg-card">
          <header className="border-b border-border/60 px-3 py-2">
            <h3 className="text-xs font-semibold text-foreground">Totales</h3>
          </header>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-3 px-4 py-3">
            <TotMetric
              label={`Subtotal ítems (${monedaLabel})`}
              value={`${prefijoItems}${formatMoney(totalesItemsSubtotal)}`}
            />
            <div className="flex w-28 shrink-0 flex-col gap-1.5">
              <Label htmlFor="desc-global" className="text-[11px] leading-none text-muted-foreground">
                Descuento
              </Label>
              <div className="flex h-8 items-center gap-1">
                <Input
                  id="desc-global"
                  className="h-8 text-right text-sm tabular-nums"
                  inputMode="decimal"
                  placeholder="0"
                  value={descuentoGlobalPct}
                  onChange={(e) => setDescuentoGlobalPct(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <TotMetric
              label={`Neto ítems (${monedaLabel})`}
              value={`${prefijoItems}${formatMoney(totalesItemsTotalConDesc)}`}
              muted
            />
            <TotMetric label="MEC (ARS)" value={`$${formatMoney(totalMecImporte)}`} muted />
            {mixta ? (
              <div className="flex w-28 shrink-0 flex-col gap-1.5">
                <Label htmlFor="dolar-hoy-conf" className="text-[11px] leading-none text-muted-foreground">
                  Dólar del día
                </Label>
                <Input
                  id="dolar-hoy-conf"
                  className="h-8 text-right text-sm tabular-nums"
                  inputMode="decimal"
                  value={dolarHoy > 0 ? String(dolarHoy) : ""}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    setDolarHoy(Number.isFinite(n) && n > 0 ? n : 0);
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid w-full max-w-sm grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">m²</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-primary">
                  {formatMetraje(totalesTotalM2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">ml</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
                  {formatMetraje(totalesTotalMl)}
                </p>
              </div>
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  title="Solo piedra no mármol con peso en maestro"
                >
                  ton ~
                </p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-sky-900 dark:text-sky-100">
                  {totalesTotalTon > 0 ? formatToneladas(totalesTotalTon) : "—"}
                </p>
              </div>
            </div>
            <dl className="w-full max-w-xs space-y-1.5 border-border/60 text-right sm:border-l sm:pl-6">
              <div className="flex items-baseline justify-between gap-8">
                <dt className="text-xs font-semibold text-foreground">Total ({monedaLabel})</dt>
                <dd className="text-base font-bold tabular-nums text-foreground">
                  {prefijoItems}{formatMoney(totalPresupuesto)}
                </dd>
              </div>
              {mixta ? (
                <div className="flex items-baseline justify-between gap-8">
                  <dt className="text-[11px] text-muted-foreground">Equivalente ARS</dt>
                  <dd className="text-sm font-medium tabular-nums text-muted-foreground">
                    ${formatMoney(totalArsEquivalente)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>
      </div>
    </SectionPresupuesto>
  );
}
