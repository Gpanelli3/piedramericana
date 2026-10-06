"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { OtListRow } from "@/components/produccion/OtListRow";
import { OtsGruposAccordion } from "@/components/produccion/OtsGruposAccordion";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getOtsAgrupadasPorFiltro,
  marcarOtEntregada,
  type OtProduccionItem,
  type VentaGrupoOt,
} from "@/lib/produccion-api";

export function VistaLogistica() {
  const [grupos, setGrupos] = useState<VentaGrupoOt[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setGrupos([]);
      return;
    }
    setLoading(true);
    const { data, error } = await getOtsAgrupadasPorFiltro("logistica");
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
      <header className="border-b border-border bg-white px-6 py-4 sm:px-8 dark:bg-background">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Producción · Logística</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              OTs en logística, listas para entrega
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-sm font-medium">
            {totalOts} en logística
          </Badge>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        <OtsGruposAccordion
          grupos={grupos}
          loading={loading}
          emptyText="No hay OTs en logística."
          onChanged={() => void refresh()}
          renderRow={(item, { onVer }) => (
            <OtListRow
              key={item.orden.id}
              item={item}
              onVer={onVer}
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
