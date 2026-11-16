"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { PlanchaBuscadorRow } from "@/lib/stock-api";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { OtUbicacionYPlano } from "./OtUbicacionYPlano";
import { BuscadorMaterial } from "./fields";
import { PlanCorteOtBanner } from "@/components/presupuesto/PlanCorteOtBanner";
import type { PlanCorte } from "@/lib/plan-corte";
import {
  TIPOS_COLOCACION,
  type LineaItemOT,
  type OrdenTrabajoWizard,
} from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StepOrdenesProps = {
  catalogoCargando: boolean;
  ordenes: OrdenTrabajoWizard[];
  materials: MaterialWizardRow[];
  planchas?: PlanchaBuscadorRow[];
  materialesCargando?: boolean;
  monedaMaterial?: "ars" | "usd";
  patchOrden: (key: string, patch: Partial<OrdenTrabajoWizard>) => void;
  addOrdenTrabajo: () => void;
  removeOrdenTrabajo: (key: string) => void;
  addItem: (otKey: string) => void;
  renderLineaCells: (
    ot: OrdenTrabajoWizard,
    line: LineaItemOT,
    index: number,
  ) => ReactNode;
  /** Si true, la ubicación se carga en la cabecera y no se repite por OT. */
  ocultarUbicacion?: boolean;
  planCorteLoading?: boolean;
};

export function StepOrdenes({
  catalogoCargando,
  ordenes,
  materials,
  planchas = [],
  materialesCargando = false,
  monedaMaterial = "ars",
  patchOrden,
  addOrdenTrabajo,
  removeOrdenTrabajo,
  addItem,
  renderLineaCells,
  ocultarUbicacion = false,
  planCorteLoading = false,
}: StepOrdenesProps) {
  const totalSubItems = ordenes.reduce((acc, ot) => acc + ot.items.length, 0);
  const nArt = ordenes.length;
  const articulosLabel = `${nArt} artículo${nArt === 1 ? "" : "s"} · ${totalSubItems} sub-ítem${totalSubItems === 1 ? "" : "s"}`;

  return (
    <div className="space-y-6">
      {ocultarUbicacion
        ? null
        : ordenes.map((ot, idx) => (
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

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border/70 px-4 py-3 sm:px-5">
          <h3 className="text-sm font-semibold text-foreground">Artículos</h3>
          <span className="text-xs text-muted-foreground">{articulosLabel}</span>
        </div>
        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="space-y-3">
            {ordenes.map((ot, idx) => {
              return (
                <section
                  key={ot.key}
                  className="min-w-0 scroll-mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                >
                  <Collapsible
                    open={ot.panelExpandido}
                    onOpenChange={(open) => patchOrden(ot.key, { panelExpandido: open })}
                  >
                    <div className="flex min-w-0 items-center gap-2 bg-zinc-900 px-3 py-2 text-white">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                          aria-label={ot.panelExpandido ? "Contraer artículo" : "Desplegar artículo"}
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              ot.panelExpandido && "rotate-180",
                            )}
                            aria-hidden
                          />
                        </button>
                      </CollapsibleTrigger>
                      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/70">
                        OT {idx + 1}
                      </span>
                      <Input
                        id={`${ot.key}-titulo`}
                        className="h-8 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-white shadow-none placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/30"
                        placeholder="Nombre"
                        value={ot.titulo}
                        onChange={(e) => patchOrden(ot.key, { titulo: e.target.value })}
                      />
                      <BuscadorMaterial
                        materials={materials}
                        planchas={planchas}
                        value={ot.materialId}
                        chapaSugeridaId={ot.chapaSugeridaId}
                        textoLibre={ot.materialLibre ?? ""}
                        loading={materialesCargando}
                        moneda={monedaMaterial}
                        soloTextoLibre={ot.piedraDelCliente === true}
                        onChange={(next) =>
                          patchOrden(ot.key, {
                            materialId: next.materialId,
                            materialLibre: next.materialLibre,
                            chapaSugeridaId: next.chapaSugeridaId,
                            chapaSugeridaBulto: next.chapaSugeridaBulto,
                            chapaSugeridaLabel: next.chapaSugeridaLabel,
                            planCorte: null,
                          })
                        }
                      />
                      {ordenes.length > 1 ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-white/60 hover:bg-white/10 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeOrdenTrabajo(ot.key);
                          }}
                          aria-label="Quitar artículo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>

                    <CollapsibleContent>
                      <div className="bg-card">
                        <div className="overflow-x-auto">
                          <Table className="text-xs min-w-[58rem]">
                            <TableHeader>
                              <TableRow className="border-b border-border/60 bg-muted/45 hover:bg-muted/45 [&_th]:h-8 [&_th]:py-1.5 [&_th]:text-[10px] [&_th]:font-medium [&_th]:text-muted-foreground [&_th]:uppercase [&_th]:tracking-wide first:[&_th]:pl-3 last:[&_th]:pr-3">
                                <TableHead className="w-8 whitespace-nowrap">#</TableHead>
                                <TableHead className="w-72 min-w-72">Sub-item</TableHead>
                                <TableHead className="whitespace-nowrap">Largo</TableHead>
                                <TableHead className="whitespace-nowrap">Ancho</TableHead>
                                <TableHead className="whitespace-nowrap">m² / Cant</TableHead>
                                <TableHead className="whitespace-nowrap">Unid.</TableHead>
                                <TableHead>Desp</TableHead>
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

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/40 bg-muted/10 px-3 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 px-1.5 text-amber-800 hover:text-amber-900"
                            onClick={() => addItem(ot.key)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar sub-ítem
                          </Button>
                          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              id={`${ot.key}-lleva-bacha`}
                              checked={ot.llevaBacha}
                              onCheckedChange={(c) =>
                                patchOrden(ot.key, { llevaBacha: Boolean(c) })
                              }
                            />
                            Lleva bacha
                          </label>
                          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              id={`${ot.key}-piedra-cliente`}
                              checked={ot.piedraDelCliente === true}
                              onCheckedChange={(c) => {
                                const on = Boolean(c);
                                if (!on) {
                                  patchOrden(ot.key, { piedraDelCliente: false });
                                  return;
                                }
                                const nombreCatalogo =
                                  materials.find((m) => m.id === ot.materialId)?.name ?? "";
                                patchOrden(ot.key, {
                                  piedraDelCliente: true,
                                  materialId: "",
                                  materialLibre:
                                    (ot.materialLibre ?? "").trim() || nombreCatalogo,
                                  chapaSugeridaId: null,
                                  chapaSugeridaBulto: "",
                                  chapaSugeridaLabel: "",
                                  planCorte: null,
                                });
                              }}
                            />
                            La piedra la pone el cliente
                          </label>
                        </div>

                        <PlanCorteOtBanner
                          plan={ot.planCorte ?? null}
                          loading={planCorteLoading}
                          materialNombre={
                            materials.find((m) => m.id === ot.materialId)?.name ??
                            ot.materialLibre ??
                            ""
                          }
                          piedraDelCliente={ot.piedraDelCliente === true}
                          chapaSugeridaId={ot.chapaSugeridaId}
                          onChangePlan={(plan: PlanCorte | null) => {
                            const first = plan?.planchas[0];
                            patchOrden(ot.key, {
                              planCorte: plan,
                              chapaSugeridaId: first?.chapaId ?? ot.chapaSugeridaId,
                              chapaSugeridaBulto: first?.bulto ?? ot.chapaSugeridaBulto,
                              chapaSugeridaLabel:
                                plan?.materialLabel || ot.chapaSugeridaLabel,
                            });
                          }}
                          onElegirChapa={(chapa) =>
                            patchOrden(ot.key, {
                              chapaSugeridaId: chapa.id,
                              chapaSugeridaBulto: chapa.bulto,
                              chapaSugeridaLabel: chapa.label,
                              planCorte: ot.planCorte
                                ? { ...ot.planCorte, confirmado: false }
                                : ot.planCorte,
                            })
                          }
                        />

                        {ot.llevaBacha ? (
                          <div className="grid grid-cols-1 gap-3 border-t border-border/40 px-3 py-3 sm:grid-cols-2">
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
                    </CollapsibleContent>
                  </Collapsible>
                </section>
              );
            })}
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-amber-800 hover:text-amber-900"
                onClick={addOrdenTrabajo}
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                Agregar artículo
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
