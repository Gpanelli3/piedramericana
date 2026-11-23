"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { OtListRow } from "@/components/produccion/OtListRow";
import { OtSeccionHeader } from "@/components/produccion/OtFiltroActivoPill";
import { OtsGruposAccordion } from "@/components/produccion/OtsGruposAccordion";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getOtsAgrupadasPorFiltro, type VentaGrupoOt } from "@/lib/produccion-api";

export function VistaProduccionTab() {
  const [grupos, setGrupos] = useState<VentaGrupoOt[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setGrupos([]);
      return;
    }
    setLoading(true);
    const { data, error } = await getOtsAgrupadasPorFiltro("produccion");
    setLoading(false);
    if (error) {
      toast.error(error.message);
      setGrupos([]);
      return;
    }
    setGrupos(data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalOts = grupos.reduce((acc, g) => acc + g.ots.length, 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <OtSeccionHeader
        filtro="produccion"
        count={`${grupos.length} ventas · ${totalOts} en producción`}
      />

      <main className="p-4 sm:p-6">
        <OtsGruposAccordion
          grupos={grupos}
          loading={loading}
          emptyText="No hay OTs en producción."
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
