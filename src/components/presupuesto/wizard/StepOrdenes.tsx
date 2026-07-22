"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { MaterialWizardRow } from "@/types/material-catalog";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { ConversionesMaestroHints } from "@/features/cantera/ConversionesMaestroHints";
import {
  PickMaterial,
  PickTecnico,
  PickBacha,
  SectionPresupuesto,
} from "./fields";
import { TIPOS_COLOCACION, type LineaItemOT, type OrdenTrabajoWizard } from "./types";

type PorOtRes = {
  key: string;
  titulo: string;
  subtotal: number;
  m2: number;
  ton: number;
  cantLineas: number;
};

export type StepOrdenesProps = {
  catalogoCargando: boolean;
  listaPrecioLabel: string;
  articulosDisponibles: number;
  ordenes: OrdenTrabajoWizard[];
  materials: MaterialWizardRow[];
  materialesCargando?: boolean;
  tecnicos: { id: string; full_name: string | null }[];
  totalesItems: {
    faltaPesoNonMarmol: boolean;
    porOt: PorOtRes[];
  };
  patchOrden: (key: string, patch: Partial<OrdenTrabajoWizard>) => void;
  addOrdenTrabajo: () => void;
  removeOrdenTrabajo: (key: string) => void;
  addItem: (otKey: string) => void;
  renderLineaCells: (ot: OrdenTrabajoWizard, line: LineaItemOT) => ReactNode;
};

export function StepOrdenes({
  catalogoCargando,
  listaPrecioLabel,
  articulosDisponibles,
  ordenes,
  materials,
  materialesCargando = false,
  tecnicos,
  totalesItems,
  patchOrden,
  addOrdenTrabajo,
  removeOrdenTrabajo,
  addItem,
  renderLineaCells,
}: StepOrdenesProps) {
  return (
    <div className="space-y-6">
      {catalogoCargando ? (
        <p className="text-sm text-muted-foreground border-b border-dashed border-border/80 pb-3">
          Cargando materiales y técnicos…
        </p>
      ) : null}

      {!catalogoCargando ? (
        <div className="rounded-md border border-border/70 bg-card px-3 py-2 text-xs text-muted-foreground">
          Precios cargados desde <span className="font-medium text-foreground">{listaPrecioLabel || "sin lista"}</span>.
          {articulosDisponibles > 0 ? (
            <span className="ml-1">Artículos disponibles: {articulosDisponibles}.</span>
          ) : null}
        </div>
      ) : null}

      <SectionPresupuesto
        borderAccentClass="border-t-2 border-t-sky-500/90"
        className="rounded-md border-border bg-muted/30 shadow-sm dark:bg-muted/20"
        contentClassName="px-4 py-4 sm:px-5"
      >
        <div className="space-y-0">
          {totalesItems.faltaPesoNonMarmol ? (
            <p className="mb-3 rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
              Alguna OT tiene material <span className="font-semibold">no mármol</span> pero sin{" "}
              <span className="font-semibold">peso (kg/m²)</span> en el maestro (menú lateral →{" "}
              <span className="font-semibold">Cantera</span>). El total en toneladas puede quedar incompleto.
            </p>
          ) : null}
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-border/70 bg-card/90 px-3 py-3 shadow-sm backdrop-blur-sm dark:bg-card/75">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                Órdenes de trabajo
              </h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0 border-dashed border-border bg-background/80 text-muted-foreground hover:text-foreground"
              onClick={addOrdenTrabajo}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              Agregar OT
            </Button>
          </div>

          <div className="space-y-3">
            {ordenes.map((ot, idx) => {
              const materialRow = materials.find((m) => m.id === ot.materialId);
              const materialNombre = materialRow
                ? `${materialRow.name}${materialRow.unit ? ` (${materialRow.unit})` : ""}`
                : "Sin material";

              return (
                <section
                  key={ot.key}
                  className="min-w-0 scroll-mt-2 overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                >
                  <Collapsible
                    open={ot.panelExpandido}
                    onOpenChange={(open) => patchOrden(ot.key, { panelExpandido: open })}
                  >
                    <div className="flex min-w-0 items-stretch gap-0 border-b border-border/70 bg-muted/35 pl-3">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2.5 border-l-2 border-l-sky-500/70 py-2.5 pl-2.5 pr-1 text-left -ml-px hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200",
                              ot.panelExpandido && "rotate-180",
                            )}
                            aria-hidden
                          />
                          <span className="inline-flex shrink-0 items-center rounded border border-sky-500/25 bg-sky-500/[0.08] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-800 dark:text-sky-200">
                            OT {idx + 1}
                          </span>
                          <div className="min-w-0 flex flex-1 flex-col gap-0 sm:flex-row sm:items-baseline sm:gap-x-2 sm:gap-y-0">
                            <span className="truncate text-sm font-medium text-foreground">
                              {ot.titulo.trim() || "Sin título"}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">{materialNombre}</span>
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      {ordenes.length > 1 ? (
                        <div className="flex shrink-0 items-center pl-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeOrdenTrabajo(ot.key);
                            }}
                            aria-label="Quitar orden de trabajo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <CollapsibleContent>
                      <div className="space-y-4 bg-muted/20 px-3 py-4 sm:px-4 sm:py-5 dark:bg-muted/10">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-md border border-border/55 bg-background/90 p-3 sm:p-4 shadow-sm dark:bg-background/80">
                          <div className="space-y-1.5 min-w-0">
                            <Label htmlFor={`${ot.key}-titulo`} className="text-xs font-medium">
                              Título
                            </Label>
                            <Input
                              id={`${ot.key}-titulo`}
                              className="h-9 text-sm"
                              placeholder="Ej. Cocina — mesada principal"
                              value={ot.titulo}
                              onChange={(e) => patchOrden(ot.key, { titulo: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5 min-w-0">
                            <Label className="text-xs font-medium">Material (chapa)</Label>
                            <PickMaterial
                              materials={materials}
                              value={ot.materialId}
                              onChange={(id) => patchOrden(ot.key, { materialId: id })}
                              loading={materialesCargando}
                            />
                            <ConversionesMaestroHints parentMaterialId={ot.materialId} />
                          </div>
                        </div>

                        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-3 sm:px-4 dark:bg-muted/25">
                          <Collapsible>
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 text-left text-xs font-medium text-foreground py-0.5 [&[data-state=open]>svg]:rotate-180"
                              >
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200" />
                                <span>Más datos</span>
                                <span className="font-normal text-muted-foreground">
                                  · bacha, fechas, técnico, colocación
                                </span>
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 pt-4 mt-3 border-t border-border/40">
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">Bacha</Label>
                                  <PickBacha
                                    value={ot.bachaId}
                                    onChange={(id) => patchOrden(ot.key, { bachaId: id })}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">Fecha OT</Label>
                                  <Input
                                    type="date"
                                    className="h-9 text-sm"
                                    value={ot.fecha}
                                    onChange={(e) => patchOrden(ot.key, { fecha: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">Técnico a medir</Label>
                                  <PickTecnico
                                    tecnicos={tecnicos}
                                    value={ot.tecnicoId}
                                    onChange={(id) => patchOrden(ot.key, { tecnicoId: id })}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">Fecha medición</Label>
                                  <Input
                                    type="date"
                                    className="h-9 text-sm"
                                    value={ot.fechaMedicion}
                                    onChange={(e) =>
                                      patchOrden(ot.key, { fechaMedicion: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">Fecha entrega estimada</Label>
                                  <Input
                                    type="date"
                                    className="h-9 text-sm"
                                    value={ot.fechaEntrega}
                                    onChange={(e) =>
                                      patchOrden(ot.key, { fechaEntrega: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                  <Label className="text-xs font-medium">Colocación en obra</Label>
                                  <RadioGroup
                                    value={ot.tipoColocacion}
                                    onValueChange={(v) =>
                                      patchOrden(ot.key, {
                                        tipoColocacion:
                                          v as (typeof TIPOS_COLOCACION)[number]["value"],
                                      })
                                    }
                                    className="flex flex-wrap gap-4"
                                  >
                                    {TIPOS_COLOCACION.map((opt) => (
                                      <div key={opt.value} className="flex items-center gap-2">
                                        <RadioGroupItem value={opt.value} id={`${ot.key}-${opt.value}-step`} />
                                        <Label htmlFor={`${ot.key}-${opt.value}-step`} className="text-sm font-normal">
                                          {opt.label}
                                        </Label>
                                      </div>
                                    ))}
                                  </RadioGroup>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>

                        <Separator className="bg-border/60" />

                        <div className="rounded-md border border-border/55 bg-background/90 p-3 shadow-sm dark:bg-background/80">
                          <div className="mb-2">
                            <p className="text-xs font-medium text-foreground">Ítems de la OT</p>
                          </div>
                          <div className="overflow-hidden rounded-md border border-border/60 bg-card">
                            <div className="overflow-x-auto bg-muted/20">
                              <Table className="text-xs min-w-[58rem]">
                                <TableHeader>
                                  <TableRow className="border-b border-border/60 bg-muted/45 hover:bg-muted/45 [&_th]:h-8 [&_th]:py-1.5 [&_th]:text-[10px] [&_th]:font-medium [&_th]:text-muted-foreground [&_th]:uppercase [&_th]:tracking-wide first:[&_th]:pl-3 last:[&_th]:pr-3">
                                    <TableHead className="whitespace-nowrap">Cód.</TableHead>
                                    <TableHead className="min-w-[8.5rem]">Descripción</TableHead>
                                    <TableHead>Unidad</TableHead>
                                    <TableHead>Cant.</TableHead>
                                    <TableHead>P. unit.</TableHead>
                                    <TableHead className="text-right">Total $</TableHead>
                                    <TableHead
                                      className="whitespace-nowrap"
                                      title="m² por dimensiones: centímetros. Metro lineal: metros."
                                    >
                                      Alto
                                    </TableHead>
                                    <TableHead
                                      className="whitespace-nowrap"
                                      title="Solo m² por dimensiones (centímetros)."
                                    >
                                      Ancho
                                    </TableHead>
                                    <TableHead title="Desperdicio: % extra de material. Vacío = 0%.">
                                      Desp.%
                                    </TableHead>
                                    <TableHead className="text-right" title="Superficie de material calculada.">
                                      m²
                                    </TableHead>
                                    <TableHead className="w-12 p-1.5 text-center">
                                      <span className="sr-only">Quitar</span>
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {ot.items.length === 0 ? (
                                    <TableRow className="hover:bg-transparent bg-muted/10">
                                      <TableCell colSpan={11} className="py-6 px-4 text-center">
                                        <p className="text-sm text-foreground/90">Todavía no hay ítems</p>
                                        <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                                          Usá <span className="font-medium text-foreground/80">Agregar ítem</span> abajo
                                          para cargar la primera línea de esta OT.
                                        </p>
                                        <button
                                          type="button"
                                          className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
                                          onClick={() => addItem(ot.key)}
                                        >
                                          Agregar ítem ahora
                                        </button>
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    ot.items.map((line) => renderLineaCells(ot, line))
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                            <div className="flex justify-center border-t border-border/40 px-3 py-2 bg-muted/[0.06]">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 border-dashed text-muted-foreground hover:text-foreground"
                                onClick={() => addItem(ot.key)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Agregar ítem
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-6 text-xs rounded-md border border-border/55 bg-muted/25 px-3 py-2.5 dark:bg-muted/20 justify-between sm:justify-start">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Líneas</p>
                            <p className="font-medium tabular-nums text-foreground">
                              {totalesItems.porOt.find((p) => p.key === ot.key)?.cantLineas ?? 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Subtotal</p>
                            <p className="font-medium tabular-nums text-foreground">
                              $
                              {totalesItems.porOt
                                .find((p) => p.key === ot.key)
                                ?.subtotal.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                }) ?? "0"}
                            </p>
                          </div>
                          <div className="sm:ml-auto">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">m²</p>
                            <p className="font-medium tabular-nums text-primary">
                              {totalesItems.porOt
                                .find((p) => p.key === ot.key)
                                ?.m2.toLocaleString("es-AR", {
                                  minimumFractionDigits: 3,
                                }) ?? "0"}
                            </p>
                          </div>
                          {(totalesItems.porOt.find((p) => p.key === ot.key)?.ton ?? 0) > 0 ? (
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ton (~)</p>
                              <p className="font-medium tabular-nums text-sky-800 dark:text-sky-200">
                                {(totalesItems.porOt.find((p) => p.key === ot.key)?.ton ?? 0).toLocaleString("es-AR", {
                                  minimumFractionDigits: 3,
                                  maximumFractionDigits: 3,
                                })}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </section>
              );
            })}
          </div>
        </div>
      </SectionPresupuesto>
    </div>
  );
}
