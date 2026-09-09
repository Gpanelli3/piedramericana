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
  monedaPresupuesto: string;
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

function TotRow({
  label,
  value,
  muted,
  strong,
  className,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 py-1.5",
        muted && "text-muted-foreground",
        className,
      )}
    >
      <span className={cn("text-xs", strong && "font-semibold text-foreground")}>{label}</span>
      <span
        className={cn(
          "tabular-nums text-sm",
          strong ? "font-bold text-foreground" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function StepConfirmacion(props: StepConfirmacionProps) {
  const {
    clienteNombre,
    listaPrecioLabel,
    origenLabel,
    monedaPresupuesto,
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
  const mecActivo =
    !mecExcluidoTodasOts && mecAlgunoActivo(mMedicionGlobal, mEntregaGlobal, mColocacionGlobal);

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

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* 2. Columna izquierda: OT */}
          <div className="space-y-4 lg:col-span-3">
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
                      ${formatMoney(p.subtotal)}
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
          </div>

          {/* 3. Columna derecha: MEC + totales */}
          <div className="space-y-4 lg:col-span-2">
            <section className="space-y-3 rounded-md border border-emerald-600/25 bg-emerald-50/40 px-3 py-3 dark:bg-emerald-950/20">
              <div>
                <h3 className="text-xs font-semibold text-foreground">Servicios MEC</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                  {mecExcluidoTodasOts
                    ? "Todas las OTs están marcadas sin MEC: el importe pasa a $0."
                    : "Marcá lo que se cobra. Si hay alguno activo, el importe es obligatorio."}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
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
              <div className="space-y-1">
                <Label className="text-xs">Importe MEC ($)</Label>
                <Input
                  className="h-9 text-sm tabular-nums"
                  inputMode="decimal"
                  value={totalMecGlobal}
                  onChange={(e) => setTotalMecGlobal(e.target.value)}
                  disabled={!mecActivo}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observaciones MEC</Label>
                <Textarea
                  className="min-h-[56px] max-h-28 resize-y py-1.5 text-sm"
                  placeholder="Notas sobre medición, entrega o colocación…"
                  maxLength={500}
                  value={obsServiciosMec}
                  onChange={(e) => setObsServiciosMec(e.target.value)}
                />
                <p className="text-right text-[10px] text-muted-foreground">
                  {obsServiciosMec.length}/500
                </p>
              </div>
            </section>

            <section className="rounded-md border border-border/80 bg-card">
              <header className="border-b border-border/60 px-3 py-2">
                <h3 className="text-xs font-semibold text-foreground">Totales</h3>
              </header>

              <div className="space-y-0 px-3 py-2">
                <TotRow label="Subtotal ítems" value={`$${formatMoney(totalesItemsSubtotal)}`} />
                <div className="flex items-end justify-between gap-3 py-1.5">
                  <Label htmlFor="desc-global" className="text-xs text-muted-foreground">
                    Descuento
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id="desc-global"
                      className="h-8 w-20 text-right text-sm tabular-nums"
                      inputMode="decimal"
                      placeholder="0"
                      value={descuentoGlobalPct}
                      onChange={(e) => setDescuentoGlobalPct(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <TotRow
                  label="Neto ítems"
                  value={`$${formatMoney(totalesItemsTotalConDesc)}`}
                  muted
                />
                <TotRow
                  label="MEC"
                  value={`$${formatMoney(totalMecImporte)}`}
                  muted
                />
                <div className="mt-1 border-t border-border/70 pt-2">
                  <TotRow
                    label={`Total (${monedaLabel})`}
                    value={`$${formatMoney(totalPresupuesto)}`}
                    strong
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px border-t border-border/60 bg-border/40">
                <div className="bg-muted/25 px-2.5 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    m²
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-primary">
                    {formatMetraje(totalesTotalM2)}
                  </p>
                </div>
                <div className="bg-muted/25 px-2.5 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    ml
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
                    {formatMetraje(totalesTotalMl)}
                  </p>
                </div>
                <div className="bg-muted/25 px-2.5 py-2.5 text-center">
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
            </section>
          </div>
        </div>
      </div>
    </SectionPresupuesto>
  );
}
