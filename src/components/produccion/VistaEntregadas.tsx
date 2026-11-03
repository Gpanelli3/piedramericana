"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { OtListRow } from "@/components/produccion/OtListRow";
import { OtsGruposAccordion } from "@/components/produccion/OtsGruposAccordion";
import { formatFechaCorta } from "@/components/produccion/ot-ui";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getOtsAgrupadasPorFiltro, type VentaGrupoOt } from "@/lib/produccion-api";

export function VistaEntregadas() {
  const [grupos, setGrupos] = useState<VentaGrupoOt[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setGrupos([]);
      return;
    }
    setLoading(true);
    const { data, error } = await getOtsAgrupadasPorFiltro("entregadas");
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
      <header className="border-b border-border bg-white px-5 py-4 sm:px-6 dark:bg-background">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Producción · Entregadas</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Histórico de OTs cerradas (solo lectura)
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-sm font-medium">
            {totalOts} entregadas
          </Badge>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        <OtsGruposAccordion
          grupos={grupos}
          loading={loading}
          emptyText="Todavía no hay OTs entregadas."
          onChanged={() => void refresh()}
          permitirEntregar={false}
          renderRow={(item, { onVer }) => (
            <OtListRow
              key={item.orden.id}
              item={item}
              onVer={onVer}
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
