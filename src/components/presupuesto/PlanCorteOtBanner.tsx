"use client";

import { Button } from "@/components/ui/button";
import { confirmarPlanCorte, type PlanCorte } from "@/lib/plan-corte";
import { PlanCorteCroquis } from "@/components/presupuesto/PlanCorteCroquis";
import { PickChapaParaOt } from "@/components/presupuesto/wizard/PickChapaParaOt";

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

  return (
    <div className="space-y-2 border-t border-border/40 bg-muted/10 px-3 py-3">
      {sinPlancha ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          No hay plancha disponible para estas piezas. Cargá stock o cambiá el material.
        </p>
      ) : primera ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-foreground">
            <span className="font-mono font-medium">{primera.bulto}</span>
            {" · "}
            {Math.round(plan.pctAprovechado)} % aprovechado
            {" · sobra "}
            {formatM2(plan.m2TotalSobrante)} m²
            {plan.planchas.length > 1 ? ` · ${plan.planchas.length} planchas` : ""}
          </p>
          {plan.confirmado ? (
            <span className="text-[11px] font-medium text-emerald-700">Plancha confirmada</span>
          ) : (
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChangePlan(confirmarPlanCorte(plan))}
            >
              Confirmar plancha
            </Button>
          )}
        </div>
      ) : null}

      {empalme > 0 ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          {empalme} pieza{empalme === 1 ? "" : "s"} no entra{empalme === 1 ? "" : "n"} en el stock
          disponible (hace falta empalme o más planchas).
        </p>
      ) : null}

      {primera ? (
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <PlanCorteCroquis plancha={primera} className="h-36 w-full" />
        </div>
      ) : null}

      <PickChapaParaOt
        materialNombre={materialNombre}
        valueId={chapaSugeridaId}
        onChange={onElegirChapa}
      />
    </div>
  );
}
