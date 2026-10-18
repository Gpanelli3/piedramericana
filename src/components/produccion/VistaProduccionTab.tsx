"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { OtListRow } from "@/components/produccion/OtListRow";
import { OtsGruposAccordion } from "@/components/produccion/OtsGruposAccordion";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  avanzarEtapaOt,
  coalesceEtapaOt,
  getOtsAgrupadasPorFiltro,
  siguienteEtapaOt,
  type OtProduccionItem,
  type VentaGrupoOt,
} from "@/lib/produccion-api";
import { etiquetaAvanceEtapa, etiquetaEtapaKanban } from "@/lib/etiquetas-ot";
import { frenaAvancePorBacha } from "@/lib/bacha-reglas";

export function VistaProduccionTab() {
  const [grupos, setGrupos] = useState<VentaGrupoOt[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const onAvanzar = async (item: OtProduccionItem) => {
    setBusyId(item.orden.id);
    const res = await avanzarEtapaOt(item.orden.id);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    const etapa = coalesceEtapaOt(item.orden.etapa);
    const next = siguienteEtapaOt(etapa);
    toast.success(next ? `Pasó a ${etiquetaEtapaKanban(next)}.` : "Etapa actualizada.");
    await refresh();
  };

  const totalOts = grupos.reduce((acc, g) => acc + g.ots.length, 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white px-6 py-4 sm:px-8 dark:bg-background">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Producción · Producción</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Cola de corte y producción, agrupada por venta
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-sm font-medium">
            {grupos.length} ventas · {totalOts} en producción
          </Badge>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        <OtsGruposAccordion
          grupos={grupos}
          loading={loading}
          emptyText="No hay OTs en corte ni producción."
          onChanged={() => void refresh()}
          renderRow={(item, { onVer }) => {
            const etapa = coalesceEtapaOt(item.orden.etapa);
            const next = siguienteEtapaOt(etapa);
            const frenaBacha = frenaAvancePorBacha({
              bachaRequerida: Boolean(item.orden.bacha_requerida),
              bachaAsignada: Boolean(item.orden.bacha_id),
              nextEtapa: next,
            });
            return (
              <OtListRow
                key={item.orden.id}
                item={item}
                onVer={onVer}
                primaryAction={{
                  label: next ? etiquetaAvanceEtapa(next) : "Avanzar",
                  disabled:
                    busyId === item.orden.id ||
                    Boolean(item.orden.bloqueada) ||
                    Boolean(item.orden.pausada) ||
                    frenaBacha,
                  onClick: () => void onAvanzar(item),
                }}
                extra={
                  item.orden.requiere_reserva_stock ? (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      Requiere reserva de stock
                    </p>
                  ) : null
                }
              />
            );
          }}
        />
      </main>
    </div>
  );
}
