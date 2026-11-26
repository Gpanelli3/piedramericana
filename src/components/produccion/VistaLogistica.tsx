"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useOtsGrupos } from "@/hooks/useOtsGrupos";
import { OtListRow } from "@/components/produccion/OtListRow";
import { OtSeccionHeader } from "@/components/produccion/OtFiltroActivoPill";
import { OtsGruposAccordion } from "@/components/produccion/OtsGruposAccordion";
import {
  marcarOtEntregada,
  type OtProduccionItem,
} from "@/lib/produccion-api";
export function VistaLogistica() {
  const { grupos, loading, refresh } = useOtsGrupos("logistica");
  const [busyId, setBusyId] = useState<string | null>(null);

  const onEntregar = async (item: OtProduccionItem) => {
    setBusyId(item.orden.id);
    const res = await marcarOtEntregada(item.orden.id);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("OT marcada como entregada.");
    await refresh();
  };

  const totalOts = grupos.reduce((acc, g) => acc + g.ots.length, 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <OtSeccionHeader filtro="logistica" count={`${totalOts} en instalaciones`} />

      <main className="p-4 sm:p-6">
        <OtsGruposAccordion
          grupos={grupos}
          loading={loading}
          emptyText="No hay OTs en instalaciones."
          onChanged={() => void refresh()}
          renderRow={(item, { onVer, numero }) => (
            <OtListRow
              key={item.orden.id}
              item={item}
              onVer={onVer}
              numero={numero}
              primaryAction={{
                label: "Entregar",
                disabled:
                  busyId === item.orden.id ||
                  Boolean(item.orden.bloqueada) ||
                  Boolean(item.orden.pausada),
                onClick: () => void onEntregar(item),
              }}
              extra={
                item.direccionObra !== "—" ? (
                  <p className="text-[11px] text-muted-foreground">{item.direccionObra}</p>
                ) : null
              }
            />
          )}
        />
      </main>
    </div>
  );
}
