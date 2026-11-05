"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OtListRow } from "@/components/produccion/OtListRow";
import { OtsGruposAccordion } from "@/components/produccion/OtsGruposAccordion";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getOtsAgrupadasPorFiltro,
  setOtDesbloqueada,
  setOtPausada,
  type OtProduccionItem,
  type VentaGrupoOt,
} from "@/lib/produccion-api";
import { Pause, Unlock } from "lucide-react";

export function VistaVentaRetenida() {
  const [grupos, setGrupos] = useState<VentaGrupoOt[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setGrupos([]);
      return;
    }
    setLoading(true);
    const { data, error } = await getOtsAgrupadasPorFiltro("venta_retenida");
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

  const onDesbloquear = async (item: OtProduccionItem) => {
    setBusyId(item.orden.id);
    const res = await setOtDesbloqueada(item.orden.id);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("OT desbloqueada.");
    await refresh();
  };

  const onReanudar = async (item: OtProduccionItem) => {
    setBusyId(item.orden.id);
    const res = await setOtPausada(item.orden.id, false);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("OT reanudada.");
    await refresh();
  };

  const totalOts = grupos.reduce((acc, g) => acc + g.ots.length, 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white px-5 py-4 sm:px-6 dark:bg-background">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Órdenes de Trabajo · Venta Retenida</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              OTs bloqueadas o pausadas (plata, bacha, rotura u otro motivo)
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-sm font-medium">
            {totalOts} retenidas
          </Badge>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        <OtsGruposAccordion
          grupos={grupos}
          loading={loading}
          emptyText="No hay OTs retenidas en este momento."
          onChanged={() => void refresh()}
          renderRow={(item, { onVer }) => (
            <OtListRow
              key={item.orden.id}
              item={item}
              onVer={onVer}
              extra={
                <div className="flex flex-wrap gap-2 pt-1">
                  {item.orden.bloqueada ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.orden.id}
                      onClick={() => void onDesbloquear(item)}
                    >
                      <Unlock className="mr-1 h-3.5 w-3.5" />
                      Desbloquear
                    </Button>
                  ) : null}
                  {item.orden.pausada ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.orden.id}
                      onClick={() => void onReanudar(item)}
                    >
                      <Pause className="mr-1 h-3.5 w-3.5" />
                      Reanudar
                    </Button>
                  ) : null}
                </div>
              }
            />
          )}
        />
      </main>
    </div>
  );
}
