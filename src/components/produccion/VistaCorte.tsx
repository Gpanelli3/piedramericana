"use client";

import { useOtsGrupos } from "@/hooks/useOtsGrupos";
import { OtListRow } from "@/components/produccion/OtListRow";
import { OtSeccionHeader } from "@/components/produccion/OtFiltroActivoPill";
import { OtsGruposAccordion } from "@/components/produccion/OtsGruposAccordion";

export function VistaCorte() {
  const { grupos, loading, refresh } = useOtsGrupos("corte");

  const totalOts = grupos.reduce((acc, g) => acc + g.ots.length, 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <OtSeccionHeader
        filtro="corte"
        count={`${grupos.length} ventas · ${totalOts} en corte`}
      />

      <main className="p-4 sm:p-6">
        <OtsGruposAccordion
          grupos={grupos}
          loading={loading}
          emptyText="No hay OTs en corte."
          onChanged={() => void refresh()}
          renderRow={(item, { onVer, numero }) => (
            <OtListRow
              key={item.orden.id}
              item={item}
              onVer={onVer}
              numero={numero}
              primaryAction={{
                label: "Abrir",
                onClick: onVer,
              }}
              extra={
                item.orden.requiere_reserva_stock ? (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Requiere reserva de stock
                  </p>
                ) : null
              }
            />
          )}
        />
      </main>
    </div>
  );
}
