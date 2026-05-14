"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { mecAlgunoActivo } from "./validacion";
import type { LogisticaPresupuesto } from "./types";
import { SectionPresupuesto } from "./fields";

type PorOtTot = {
  key: string;
  titulo: string;
  subtotal: number;
  m2: number;
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
  logistica: LogisticaPresupuesto;
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
  totalesTotalTon: number;
};

function formatListaFecha(iso?: string): string {
  if (!iso || !iso.trim()) return "—";
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR");
  } catch {
    return iso;
  }
}

export function StepConfirmacion(props: StepConfirmacionProps) {
  const {
    clienteNombre,
    listaPrecioLabel,
    origenLabel,
    monedaPresupuesto,
    ordenesCount,
    lineItemsCount,
    logistica,
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
    totalesTotalTon,
  } = props;

  return (
    <SectionPresupuesto borderAccentClass="border-t-4 border-t-violet-500">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm mb-4">
          <div className="rounded-md border border-border/80 bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-semibold text-muted-foreground">Cliente</p>
            <p className="font-medium truncate" title={clienteNombre}>{clienteNombre || "—"}</p>
          </div>
          <div className="rounded-md border border-border/80 bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-semibold text-muted-foreground">Lista / moneda</p>
            <p className="font-medium truncate">
              {listaPrecioLabel} ·{" "}
              <span>{monedaPresupuesto === "usd" ? "USD" : "ARS"}</span>
            </p>
          </div>
          <div className="rounded-md border border-border/80 bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-semibold text-muted-foreground">Origen</p>
            <p className="font-medium truncate" title={origenLabel}>{origenLabel}</p>
          </div>
          <div className="rounded-md border border-border/80 bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-semibold text-muted-foreground">OT / líneas</p>
            <p className="font-medium tabular-nums">{ordenesCount} OT · {lineItemsCount} líneas</p>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="mb-4">
          <p className="text-xs font-semibold text-foreground mb-2">Órdenes de trabajo</p>
          <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto pr-1">
            {totalesPorOt.map((p, i) => (
              <li
                key={p.key}
                className="flex justify-between gap-2 rounded-md bg-muted/15 px-2 py-1.5 border border-border/50"
              >
                <span className="min-w-0 truncate font-medium">{i}: {p.titulo}</span>
                <span className="tabular-nums shrink-0 text-muted-foreground text-xs">
                  {p.cantLineas} líneas · {p.m2.toLocaleString("es-AR", { minimumFractionDigits: 3 })} m²
                  {p.ton > 0
                    ? ` · ${p.ton.toLocaleString("es-AR", { minimumFractionDigits: 3 })} ton ~`
                    : ""}{" "}
                  · ${p.subtotal.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Separator className="my-4" />

        <div className="mb-4 rounded-md border border-border/70 bg-muted/10 px-3 py-3">
          <p className="text-xs font-semibold text-foreground mb-2">Logística</p>
          <p className="text-[11px] text-muted-foreground mb-3">
            Definida en el paso anterior; solo lectura acá.
          </p>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <p className="min-w-0">
              <span className="text-muted-foreground text-xs">Coordinación: </span>
              <span className="font-medium">{formatListaFecha(logistica.fechaCoord)}</span>
            </p>
            <p className="min-w-0">
              <span className="text-muted-foreground text-xs">Entrega: </span>
              <span className="font-medium">{formatListaFecha(logistica.fechaEntrega)}</span>
            </p>
            <p className="min-w-0 sm:col-span-2 border-t border-border/50 pt-2 mt-1">
              <span className="text-muted-foreground text-xs">Obs.: </span>
              <span className="break-words text-foreground">{logistica.observacion.trim() || "—"}</span>
            </p>
          </div>
        </div>

        {faltaPesoNonMarmol ? (
          <p className="mb-4 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            Revisión: alguna OT con material no mármol sin kg/m² en maestro (
            menú lateral → Cantera). Las ton pueden quedar incompletas.
          </p>
        ) : null}

        <Separator className="my-4" />

        <p className="text-xs text-muted-foreground mb-3">
          <span className="font-medium text-foreground">MEC global:</span> un solo importe para medición, entrega y/o colocación en todo el presupuesto (opciones abajo).
        </p>

        <div className="mb-4 space-y-3 rounded-md border border-emerald-600/30 bg-emerald-50/50 px-3 py-3 dark:bg-emerald-950/20">
            <p className="text-xs font-medium text-foreground">Servicios MEC en el total</p>
            <p className="text-xs text-muted-foreground">
              Marcá medición, entrega y/o colocación si se cobran en este presupuesto. Si alguno está activo, el importe es obligatorio. Desmarcá todo para no sumar MEC al total.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="mg-m-step"
                  checked={mMedicionGlobal}
                  onCheckedChange={(c) => setMMedicionGlobal(Boolean(c))}
                />
                <Label htmlFor="mg-m-step" className="text-xs font-medium">
                  M Medición
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="mg-e-step" checked={mEntregaGlobal} onCheckedChange={(c) => setMEntregaGlobal(Boolean(c))} />
                <Label htmlFor="mg-e-step" className="text-xs font-medium">
                  E Entrega
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="mg-c-step"
                  checked={mColocacionGlobal}
                  onCheckedChange={(c) => setMColocacionGlobal(Boolean(c))}
                />
                <Label htmlFor="mg-c-step" className="text-xs font-medium">
                  C Colocación
                </Label>
              </div>
            </div>
            <div className="space-y-1 max-w-xs">
              <Label className="text-xs">Importe total MEC ($)</Label>
              <Input
                className="h-9 text-sm tabular-nums"
                inputMode="decimal"
                value={totalMecGlobal}
                onChange={(e) => setTotalMecGlobal(e.target.value)}
                disabled={!mecAlgunoActivo(mMedicionGlobal, mEntregaGlobal, mColocacionGlobal)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observaciones MEC</Label>
              <Textarea
                className="min-h-[56px] max-h-32 resize-y py-1.5 text-sm"
                placeholder="Notas sobre medición, entrega o colocación…"
                maxLength={500}
                value={obsServiciosMec}
                onChange={(e) => setObsServiciosMec(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {obsServiciosMec.length}/500
              </p>
            </div>
          </div>

        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div className="space-y-1">
            <Label className="text-xs">Subtotal ítems ($)</Label>
            <Input readOnly className="h-9 text-sm font-semibold tabular-nums" value={totalesItemsSubtotal.toFixed(2)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descuento (%)</Label>
            <Input
              className="h-9 text-sm w-28"
              inputMode="decimal"
              placeholder="%"
              value={descuentoGlobalPct}
              onChange={(e) => setDescuentoGlobalPct(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" title="Suma de ítems después de aplicar el descuento (sin MEC).">
              Neto ítems ($)
            </Label>
            <Input readOnly className="h-9 text-sm font-semibold tabular-nums" value={totalesItemsTotalConDesc.toFixed(2)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">MEC ($)</Label>
            <Input
              readOnly
              className="h-9 text-sm tabular-nums text-emerald-900 dark:text-emerald-100"
              value={totalMecImporte.toFixed(2)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Total ($)</Label>
            <Input readOnly className="h-9 text-sm font-bold tabular-nums" value={totalPresupuesto.toFixed(2)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Total (m²)</Label>
            <Input
              readOnly
              className="h-9 text-sm font-bold tabular-nums text-primary"
              value={totalesTotalM2.toLocaleString("es-AR", { minimumFractionDigits: 3 })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" title="Solo piedra no mármol con peso cargado en maestro">
              Total ton (~)
            </Label>
            <Input
              readOnly
              className="h-9 text-sm font-semibold tabular-nums text-sky-900 dark:text-sky-50"
              value={
                totalesTotalTon > 0
                  ? totalesTotalTon.toLocaleString("es-AR", {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 4,
                    })
                  : "—"
              }
            />
          </div>
        </div>
      </SectionPresupuesto>
  );
}
