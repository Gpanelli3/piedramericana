"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { confirmarPlanCorte, type PlanCorte } from "@/lib/plan-corte";
import { PlanCorteCroquis } from "@/components/presupuesto/PlanCorteCroquis";
import { PickChapaParaOt } from "@/components/presupuesto/wizard/PickChapaParaOt";
import { cn } from "@/lib/utils";

function formatM2(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Props = {
  plan: PlanCorte | null;
  loading?: boolean;
  materialNombre?: string;
  piedraDelCliente?: boolean;
  chapaSugeridaId: string | null;
  onChangePlan: (plan: PlanCorte | null) => void;
  onElegirChapa: (chapa: { id: string | null; bulto: string; label: string }) => void;
};

export function PlanCorteOtBanner({
  plan,
  loading = false,
  materialNombre,
  piedraDelCliente = false,
  chapaSugeridaId,
  onChangePlan,
  onElegirChapa,
}: Props) {
  const [abierto, setAbierto] = useState(false);

  if (piedraDelCliente) return null;
  if (!materialNombre?.trim() && !plan) return null;

  if (loading && !plan) {
    return (
      <div className="border-t border-border/40 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
        Calculando plan de corte…
      </div>
    );
  }

  if (!plan || (!plan.requiereConfirmacion && plan.planchas.length === 0)) return null;

  const primera = plan.planchas[0];
  const sinPlancha = plan.requiereConfirmacion && plan.planchas.length === 0;
  const empalme = plan.piezasSinCabida.length;
  const hayAviso = sinPlancha || empalme > 0;
  const textoEmpalme = `${empalme} pieza${empalme === 1 ? "" : "s"} no entra${empalme === 1 ? "" : "n"} en el stock disponible (hace falta empalme o más planchas).`;

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/40 px-3 py-2.5",
          hayAviso ? "bg-amber-50/60" : "bg-muted/10",
        )}
      >
        {!primera ? <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden /> : null}

        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          Plan de corte
          {hayAviso ? (
            <span className="ml-2 text-xs font-normal text-amber-800">
              {sinPlancha ? "Sin plancha disponible" : `${empalme} pieza${empalme === 1 ? "" : "s"} sin cabida`}
            </span>
          ) : null}
        </p>

        {primera ? (
          plan.confirmado ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Confirmada
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
              Sin confirmar
            </span>
          )
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setAbierto(true)}
        >
          Ver plan
        </Button>
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>Plan de corte</DialogTitle>
            <DialogDescription>
              {materialNombre?.trim() || plan.materialLabel || "Distribución de las piezas en la plancha"}
              {primera
                ? ` · ${Math.round(plan.pctAprovechado)} % aprovechado · sobra ${formatM2(plan.m2TotalSobrante)} m²`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {sinPlancha ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No hay plancha disponible para estas piezas. Cargá stock o cambiá el material.
              </p>
            ) : null}
            {empalme > 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{textoEmpalme}</p>
            ) : null}

            {plan.planchas.map((p, i) => (
              <div key={`${p.chapaId}-${i}`} className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Plancha {i + 1}
                  {plan.planchas.length > 1 ? ` de ${plan.planchas.length}` : ""} ·{" "}
                  <span className="font-mono font-medium text-foreground">{p.bulto}</span>
                </p>
                <div className="overflow-hidden rounded-xl border border-border bg-muted/20 p-2">
                  <PlanCorteCroquis plancha={p} className="mx-auto h-64 w-full" />
                </div>
              </div>
            ))}

            <PickChapaParaOt
              materialNombre={materialNombre}
              valueId={chapaSugeridaId}
              onChange={onElegirChapa}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cerrar
              </Button>
            </DialogClose>
            {primera && !plan.confirmado ? (
              <Button
                type="button"
                onClick={() => {
                  onChangePlan(confirmarPlanCorte(plan));
                  setAbierto(false);
                }}
              >
                Confirmar plancha
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
