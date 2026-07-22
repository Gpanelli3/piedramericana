"use client";

import { Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HistorialRemitosTab } from "@/components/stock/HistorialRemitosTab";

type IngresosTabProps = {
  onRegistrarIngreso: () => void;
  historialBump: number;
};

export function IngresosTab({ onRegistrarIngreso, historialBump }: IngresosTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
            <Truck className="h-5 w-5 text-sky-700 dark:text-sky-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Ingresos de stock</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Remitos de proveedores: al registrar un ingreso se crean las chapas en inventario.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 gap-1.5 shrink-0"
          onClick={onRegistrarIngreso}
        >
          <Plus className="h-4 w-4" />
          Registrar ingreso
        </Button>
      </div>

      <HistorialRemitosTab reloadToken={historialBump} />
    </div>
  );
}
