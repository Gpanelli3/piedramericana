"use client";

import { PresupuestoWizard } from "@/components/presupuesto/PresupuestoWizard";

export function VistaVentas() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border bg-white">
        <div className="px-8 pt-5 pb-5 flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Home &rsaquo; Presupuestos</p>
            <h1 className="text-xl font-bold text-foreground">Presupuestos</h1>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <PresupuestoWizard />
      </main>
    </div>
  );
}
