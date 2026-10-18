"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FechaInput } from "@/components/ui/fecha-input";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { PickMaterial, SectionPresupuesto } from "./fields";
import { PickChapaParaOt } from "./PickChapaParaOt";
import { AvisoRetazoPiezas } from "@/components/stock/AvisoRetazoPiezas";
import { parseDecimalInput } from "@/lib/presupuesto-calculos";
import { OtUbicacionYPlano } from "./OtUbicacionYPlano";
import {
  TIPOS_COLOCACION,
  type LineaItemOT,
  type OrdenTrabajoWizard,
} from "./types";
import { Switch } from "@/components/ui/switch";
import { NafeCampo } from "@/components/produccion/NafeCampo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PorOtRes = {
  key: string;
  titulo: string;
  subtotal: number;
  m2: number;
  ml: number;
  ton: number;
  cantLineas: number;
};

export type StepOrdenesProps = {
  catalogoCargando: boolean;
  ordenes: OrdenTrabajoWizard[];
  materials: MaterialWizardRow[];
  materialesCargando?: boolean;
  totalesItems: {
    faltaPesoNonMarmol: boolean;
    porOt: PorOtRes[];
  };
  patchOrden: (key: string, patch: Partial<OrdenTrabajoWizard>) => void;
  addOrdenTrabajo: () => void;
  removeOrdenTrabajo: (key: string) => void;
  addItem: (otKey: string) => void;
  renderLineaCells: (
    ot: OrdenTrabajoWizard,
    line: LineaItemOT,
    index: number,
  ) => ReactNode;
};

export function StepOrdenes({
  catalogoCargando,
  ordenes,
  materials,
  materialesCargando = false,
  totalesItems,
  patchOrden,
  addOrdenTrabajo,
  removeOrdenTrabajo,
  addItem,
  renderLineaCells,
}: StepOrdenesProps) {
  return (
    <div className="space-y-6">
      {ordenes.map((ot, idx) => (
        <div key={`${ot.key}-ubicacion`} className="space-y-2">
          {ordenes.length > 1 ? (
            <p className="text-xs font-medium text-muted-foreground">
              OT {idx + 1}
              {ot.titulo.trim() ? ` · ${ot.titulo.trim()}` : ""}
            </p>
          ) : null}
          <OtUbicacionYPlano ot={ot} patchOrden={patchOrden} />
        </div>
      ))}

      {catalogoCargando ? (
        <p className="text-sm text-muted-foreground border-b border-dashed border-border/80 pb-3">
          Cargando materiales…
        </p>
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
          <div className="mb-3 rounded-lg border border-border/70 bg-card/90 px-3 py-3 shadow-sm backdrop-blur-sm dark:bg-card/75">
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
              Órdenes de trabajo
            </h3>
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
                  className="min-w-0 scroll-mt-2 overflow-hidden rounded-lg border border-sky-200/70 border-l-[3px] border-l-sky-400 bg-sky-50/80 shadow-sm ring-1 ring-sky-900/[0.03] dark:border-sky-800/50 dark:border-l-sky-500 dark:bg-sky-950/25 dark:ring-white/[0.04]"
                >
                  <Collapsible
                    open={ot.panelExpandido}
                    onOpenChange={(open) => patchOrden(ot.key, { panelExpandido: open })}
                  >
                    <div className="flex min-w-0 items-stretch gap-0 border-b border-sky-200/60 bg-sky-100/45 pl-3 dark:border-sky-800/40 dark:bg-sky-950/40">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2.5 border-l-2 border-l-sky-500/70 py-2.5 pl-2.5 pr-1 text-left -ml-px hover:bg-sky-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-sky-900/30"
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
                      <div className="space-y-4 bg-sky-50/40 px-3 py-4 sm:px-4 sm:py-5 dark:bg-sky-950/20">
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
                            <Label className="text-xs font-medium">Material</Label>
                            <PickMaterial
                              materials={materials}
                              value={ot.materialId}
                              onChange={(id) =>
                                patchOrden(ot.key, {
                                  materialId: id,
                                  chapaSugeridaId: null,
                                  chapaSugeridaBulto: "",
                                  chapaSugeridaLabel: "",
                                })
                              }
                              loading={materialesCargando}
                            />
                            <ConversionesMaestroHints parentMaterialId={ot.materialId} />
                          </div>
                          <div className="space-y-1.5 min-w-0">
                            <Label htmlFor={`${ot.key}-fecha-entrega`} className="text-xs font-medium">
                              Fecha compromiso de entrega
                            </Label>
                            <FechaInput
                              id={`${ot.key}-fecha-entrega`}
                              className="h-9 text-sm"
                              value={ot.fechaEntrega}
                              onChange={(iso) => patchOrden(ot.key, { fechaEntrega: iso })}
                            />
                          </div>
                          <PickChapaParaOt
                            materialNombre={materialRow?.name}
                            valueId={ot.chapaSugeridaId}
                            onChange={(ch) =>
                              patchOrden(ot.key, {
                                chapaSugeridaId: ch.id,
                                chapaSugeridaBulto: ch.bulto,
                                chapaSugeridaLabel: ch.label,
                              })
                            }
                          />
                          <div className="sm:col-span-2">
                            <AvisoRetazoPiezas
                              materialId={ot.materialId || null}
                              materialLabel={materialRow?.name ?? null}
                              piezas={ot.items
                                .map((line) => ({
                                  label: line.articuloId || "Pieza",
                                  largoCm: parseDecimalInput(line.altoM) * 100,
                                  anchoCm: parseDecimalInput(line.anchoM) * 100,
                                }))
                                .filter((p) => p.largoCm > 0 && p.anchoCm > 0)}
                            />
                          </div>
                        </div>

                        <div className="rounded-md border border-border/55 bg-background/90 p-3 shadow-sm dark:bg-background/80 sm:p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground">Bacha</p>
                              <p className="text-[11px] text-muted-foreground">
                                Colocación y si es nuestra o la trae el cliente. El origen se puede cambiar después.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label
                                htmlFor={`${ot.key}-lleva-bacha`}
                                className="text-xs text-muted-foreground"
                              >
                                Lleva bacha
                              </Label>
                              <Switch
                                id={`${ot.key}-lleva-bacha`}
                                checked={ot.llevaBacha}
                                onCheckedChange={(v) =>
                                  patchOrden(ot.key, { llevaBacha: v === true })
                                }
                              />
                            </div>
                          </div>
                          {ot.llevaBacha ? (
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="min-w-0 space-y-1.5">
                                <Label className="text-xs font-medium">Colocación</Label>
                                <Select
                                  value={ot.tipoColocacion}
                                  onValueChange={(v) =>
                                    patchOrden(ot.key, {
                                      tipoColocacion: v as OrdenTrabajoWizard["tipoColocacion"],
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-9 w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIPOS_COLOCACION.map((t) => (
                                      <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="min-w-0 space-y-1.5">
                                <Label className="text-xs font-medium">Origen</Label>
                                <Select
                                  value={ot.bachaOrigen}
                                  onValueChange={(v) =>
                                    patchOrden(ot.key, {
                                      bachaOrigen: v === "cliente" ? "cliente" : "propia",
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-9 w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="propia">Nuestra</SelectItem>
                                    <SelectItem value="cliente">Del cliente</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-md border border-border/55 bg-background/90 p-3 shadow-sm dark:bg-background/80 sm:p-4">
                          <p className="text-xs font-medium text-foreground">NAFE</p>
                          <p className="mb-2 text-[11px] text-muted-foreground">
                            Lo preguntan en el taller. Escribí el valor; queda en el rótulo.
                          </p>
                          <NafeCampo
                            id={`${ot.key}-nafe`}
                            compact
                            value={ot.nafe}
                            onChange={(v) => patchOrden(ot.key, { nafe: v })}
                          />
                        </div>

                        <div className="rounded-md border border-border/55 bg-background/90 p-3 shadow-sm dark:bg-background/80">
                          <div className="mb-2">
                            <p className="text-xs font-medium text-foreground">Sub-ítems de la OT</p>
                          </div>
                          <div className="overflow-hidden rounded-md border border-border/60 bg-card">
                            <div className="overflow-x-auto bg-muted/20">
                              <Table className="text-xs min-w-[58rem]">
                                <TableHeader>
                                  <TableRow className="border-b border-border/60 bg-muted/45 hover:bg-muted/45 [&_th]:h-8 [&_th]:py-1.5 [&_th]:text-[10px] [&_th]:font-medium [&_th]:text-muted-foreground [&_th]:uppercase [&_th]:tracking-wide first:[&_th]:pl-3 last:[&_th]:pr-3">
                                    <TableHead className="w-8 whitespace-nowrap">#</TableHead>
                                    <TableHead className="min-w-[8.5rem]">Sub-item</TableHead>
                                    <TableHead
                                      className="whitespace-nowrap"
                                      title="Largo en metros (m² por dimensiones)."
                                    >
                                      Largo
                                    </TableHead>
                                    <TableHead
                                      className="whitespace-nowrap"
                                      title="Ancho en metros (solo m² por dimensiones)."
                                    >
                                      Ancho
                                    </TableHead>
                                    <TableHead
                                      className="whitespace-nowrap"
                                      title="m² calculados o cantidad según el tipo de artículo."
                                    >
                                      m² / Cant
                                    </TableHead>
                                    <TableHead
                                      className="whitespace-nowrap"
                                      title="Unidades (piezas) o tipo de unidad del artículo."
                                    >
                                      Unid.
                                    </TableHead>
                                    <TableHead title="Desperdicio: % extra de material. Vacío = 0%.">
                                      Desp
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap">Precio</TableHead>
                                    <TableHead className="text-right">Subtotal</TableHead>
                                    <TableHead className="w-12 p-1.5 text-center">
                                      <span className="sr-only">Quitar</span>
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {ot.items.length === 0 ? (
                                    <TableRow className="hover:bg-transparent bg-muted/10">
                                      <TableCell colSpan={10} className="py-6 px-4 text-center">
                                        <p className="text-sm text-muted-foreground">Todavía no hay sub-ítems</p>
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    ot.items.map((line, lineIdx) =>
                                      renderLineaCells(ot, line, lineIdx),
                                    )
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
                                Agregar sub-ítem
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-md border border-border/55 bg-background/90 p-3 shadow-sm dark:bg-background/80 space-y-2">
                          <div className="flex items-start gap-2">
                            <Checkbox
                              id={`${ot.key}-excluir-mec`}
                              checked={ot.excluirMec}
                              onCheckedChange={(c) =>
                                patchOrden(ot.key, {
                                  excluirMec: Boolean(c),
                                  obsMec: Boolean(c) ? ot.obsMec : "",
                                })
                              }
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <Label
                                htmlFor={`${ot.key}-excluir-mec`}
                                className="text-xs font-medium leading-snug"
                              >
                                Esta OT no incluye MEC
                              </Label>
                            </div>
                          </div>
                          {ot.excluirMec ? (
                            <div className="space-y-1 pl-6">
                              <Label htmlFor={`${ot.key}-obs-mec`} className="text-[10px]">
                                Motivo (opcional)
                              </Label>
                              <Textarea
                                id={`${ot.key}-obs-mec`}
                                rows={2}
                                className="resize-none text-xs"
                                maxLength={200}
                                placeholder="Ej. mesa redonda — el cliente retira"
                                value={ot.obsMec}
                                onChange={(e) => patchOrden(ot.key, { obsMec: e.target.value })}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </section>
              );
            })}
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-dashed border-border bg-background/80 text-muted-foreground hover:text-foreground"
                onClick={addOrdenTrabajo}
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                Agregar OT
              </Button>
            </div>
          </div>
        </div>
      </SectionPresupuesto>
    </div>
  );
}
