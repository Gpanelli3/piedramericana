"use client";

import { PresupuestoWizard } from "@/components/presupuesto/PresupuestoWizard";

export function VistaVentas() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <main className="min-h-0 flex-1 overflow-hidden">
        <PresupuestoWizard />
      </main>
    </div>
  );
}
