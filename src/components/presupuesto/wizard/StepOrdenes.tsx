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
  ordenes: OrdenTrabajoWizard[];
  materials: MaterialWizardRow[];
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
  ordenes,
  materials,
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
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
          Cargando materiales y técnicos…
        </p>
      ) : null}

      <SectionPresupuesto borderAccentClass="border-t-4 border-t-sky-500">
        <div className="space-y-3">
          {totalesItems.faltaPesoNonMarmol ? (
            <p className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              Alguna OT tiene material <span className="font-semibold">no mármol</span> pero sin{" "}
              <span className="font-semibold">peso (kg/m²)</span> cargado en el maestro (menú lateral →{" "}
              <span className="font-semibold">Cantera</span>). El total en toneladas puede quedar incompleto.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={addOrdenTrabajo}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              Agregar OT
            </Button>
          </div>
          {ordenes.map((ot, idx) => {
            const materialRow = materials.find((m) => m.id === ot.materialId);
            const materialNombre = materialRow
              ? `${materialRow.name}${materialRow.unit ? ` (${materialRow.unit})` : ""}`
              : "Material";

            return (
              <section
                key={ot.key}
                className="min-w-0 rounded-lg border border-border bg-card shadow-sm overflow-hidden border-l-4 border-l-sky-500"
              >
                <Collapsible
                  open={ot.panelExpandido}
                  onOpenChange={(open) => patchOrden(ot.key, { panelExpandido: open })}
                >
                  <div className="flex items-stretch gap-0 border-b border-border bg-muted/30">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      >
                        <span className="inline-flex shrink-0 items-center rounded-md bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white">
                          OT Nro. {idx + 1}
                        </span>
                        <div className="min-w-0 flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {ot.titulo.trim() || "Sin título"}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">{materialNombre}</span>
                        </div>
                        <ChevronDown
                          className={cn(
                            "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                            ot.panelExpandido && "rotate-180",
                          )}
                          aria-hidden
                        />
                      </button>
                    </CollapsibleTrigger>
                    {ordenes.length > 1 ? (
                      <div className="flex shrink-0 items-center border-l border-border/80 bg-muted/20 pr-2 pl-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
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
                      <div className="p-3 sm:p-4 space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
                          <div className="space-y-1 min-w-0">
                            <Label className="text-xs">Título</Label>
                            <Input
                              className="h-9 text-sm"
                              placeholder="titulo"
                              value={ot.titulo}
                              onChange={(e) => patchOrden(ot.key, { titulo: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <Label className="text-xs">Material (chapa)</Label>
                            <PickMaterial
                              materials={materials}
                              value={ot.materialId}
                              onChange={(id) => patchOrden(ot.key, { materialId: id })}
                            />
                            <ConversionesMaestroHints parentMaterialId={ot.materialId} />
                          </div>
                        </div>

                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-muted-foreground px-0 text-xs"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                              Más datos de la OT (bacha, fechas, técnico, colocación)
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-dashed border-border mt-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Bacha</Label>
                                <PickBacha
                                  value={ot.bachaId}
                                  onChange={(id) => patchOrden(ot.key, { bachaId: id })}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Fecha OT</Label>
                                <Input
                                  type="date"
                                  className="h-9 text-sm"
                                  value={ot.fecha}
                                  onChange={(e) => patchOrden(ot.key, { fecha: e.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Técnico a medir</Label>
                                <PickTecnico
                                  tecnicos={tecnicos}
                                  value={ot.tecnicoId}
                                  onChange={(id) => patchOrden(ot.key, { tecnicoId: id })}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Fecha medición</Label>
                                <Input
                                  type="date"
                                  className="h-9 text-sm"
                                  value={ot.fechaMedicion}
                                  onChange={(e) =>
                                    patchOrden(ot.key, { fechaMedicion: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Fecha entrega estimada</Label>
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
                                <Label className="text-xs">Colocación en obra (referencia)</Label>
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

                        <Separator className="my-1" />

                        <div className="rounded-xl border border-border/90 bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                          <div className="overflow-x-auto bg-muted/10">
                            <Table className="text-xs min-w-[58rem]">
                              <TableHeader>
                                <TableRow className="border-b border-border/80 bg-muted/50 hover:bg-muted/50 [&_th]:h-10 [&_th]:py-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:text-foreground [&_th]:tracking-wide first:[&_th]:pl-3 last:[&_th]:pr-3">
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
                                  <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                                      <span className="mb-1 block font-medium text-foreground/85">
                                        Todavía no hay ítems en esta OT
                                      </span>
                                      Tocá{" "}
                                      <button
                                        type="button"
                                        className="font-medium text-primary underline-offset-2 hover:underline"
                                        onClick={() => addItem(ot.key)}
                                      >
                                        agregar ítem
                                      </button>{" "}
                                      abajo para cargar la primera línea.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  ot.items.map((line) => renderLineaCells(ot, line))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                          <div className="flex justify-center border-t border-border/60 bg-muted/15 px-3 py-3">
                            <Button
                              type="button"
                              size="sm"
                              className="h-9 gap-2 rounded-lg px-4 shadow-sm bg-emerald-600 text-white hover:bg-emerald-700"
                              onClick={() => addItem(ot.key)}
                            >
                              <Plus className="h-4 w-4" />
                              Agregar ítem
                            </Button>
                          </div>
                        </div>

                        <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
                          Con MEC <span className="font-medium">único para todo el presupuesto</span>, medición /
                          entrega / colocación se cargan al final, en{" "}
                          <span className="font-medium">Totales y descuento</span>.
                        </p>

                        <div className="flex flex-wrap gap-6 text-xs border-t border-border pt-3 justify-between sm:justify-start">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Cantidad</p>
                            <p className="font-semibold tabular-nums">
                              {totalesItems.porOt.find((p) => p.key === ot.key)?.cantLineas ?? 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Subtotal ($)</p>
                            <p className="font-semibold tabular-nums">
                              {totalesItems.porOt
                                .find((p) => p.key === ot.key)
                                ?.subtotal.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                }) ?? "0"}
                            </p>
                          </div>
                          <div className="sm:ml-auto">
                            <p className="text-[10px] text-muted-foreground">Total m²</p>
                            <p className="font-semibold tabular-nums text-primary">
                              {totalesItems.porOt
                                .find((p) => p.key === ot.key)
                                ?.m2.toLocaleString("es-AR", {
                                  minimumFractionDigits: 3,
                                }) ?? "0"}
                            </p>
                          </div>
                          {(totalesItems.porOt.find((p) => p.key === ot.key)?.ton ?? 0) > 0 ? (
                            <div>
                              <p className="text-[10px] text-muted-foreground">Ton piedra (~)</p>
                              <p className="font-semibold tabular-nums text-sky-800 dark:text-sky-100">
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
      </SectionPresupuesto>
    </div>
  );
}
