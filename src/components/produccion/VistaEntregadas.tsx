"use client";

import { useOtsGrupos } from "@/hooks/useOtsGrupos";
import { OtListRow } from "@/components/produccion/OtListRow";
import { OtSeccionHeader } from "@/components/produccion/OtFiltroActivoPill";
import { OtsGruposAccordion } from "@/components/produccion/OtsGruposAccordion";
import { formatFechaCorta } from "@/components/produccion/ot-ui";

export function VistaEntregadas() {
  const { grupos, loading, refresh } = useOtsGrupos("entregadas");

  const totalOts = grupos.reduce((acc, g) => acc + g.ots.length, 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <OtSeccionHeader filtro="entregadas" count={`${totalOts} entregadas`} />

      <main className="p-4 sm:p-6">
        <OtsGruposAccordion
          grupos={grupos}
          loading={loading}
          emptyText="Todavía no hay OTs entregadas."
          onChanged={() => void refresh()}
          permitirEntregar={false}
          renderRow={(item, { onVer, numero }) => (
            <OtListRow
              key={item.orden.id}
              item={item}
              onVer={onVer}
              numero={numero}
              extra={
                <p className="text-[11px] text-muted-foreground">
                  Cerrada {formatFechaCorta(item.orden.actualizado_en)}
                </p>
              }
            />
          )}
        />
      </main>
    </div>
  );
}
