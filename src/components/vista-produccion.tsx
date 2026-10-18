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
  getOtsAgrupadas,
  marcarOtEntregada,
  siguienteEtapaOt,
  type OtProduccionItem,
  type VentaGrupoOt,
} from "@/lib/produccion-api";
import { frenaAvancePorBacha } from "@/lib/bacha-reglas";
import { Clock } from "lucide-react";

export function VistaProduccion() {
  const [grupos, setGrupos] = useState<VentaGrupoOt[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setGrupos([]);
      return;
    }
    setLoading(true);
    const { data, error } = await getOtsAgrupadas();
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

  const hoyFmt = new Date().toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const onAvanzar = async (item: OtProduccionItem) => {
    setBusyId(item.orden.id);
    const res = await avanzarEtapaOt(item.orden.id);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Etapa avanzada.");
    await refresh();
  };

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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white px-6 py-4 sm:px-8 dark:bg-background">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Producción · General</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Todas las ventas con OT, agrupadas (incluye entregadas)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="capitalize">{hoyFmt}</span>
            </div>
            <Badge variant="outline" className="text-sm font-medium">
              {grupos.length} ventas · {totalOts} OTs
            </Badge>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        <OtsGruposAccordion
          grupos={grupos}
          loading={loading}
          emptyText="No hay órdenes de trabajo. Se generan cuando registrás la primera seña sobre un presupuesto aprobado en Ventas."
          onChanged={() => void refresh()}
          renderRow={(item, { onVer }) => (
            <OtListRow
              key={item.orden.id}
              item={item}
              onVer={onVer}
              primaryAction={
                item.orden.estado === "done"
                  ? undefined
                  : coalesceEtapaOt(item.orden.etapa) === "despacho"
                    ? {
                        label: "Entregar",
                        disabled:
                          busyId === item.orden.id ||
                          Boolean(item.orden.bloqueada) ||
                          Boolean(item.orden.pausada),
                        onClick: () => void onEntregar(item),
                      }
                    : {
                        label: "Avanzar",
                        disabled:
                          busyId === item.orden.id ||
                          Boolean(item.orden.bloqueada) ||
                          Boolean(item.orden.pausada) ||
                          frenaAvancePorBacha({
                            bachaRequerida: Boolean(item.orden.bacha_requerida),
                            bachaAsignada: Boolean(item.orden.bacha_id),
                            nextEtapa: siguienteEtapaOt(coalesceEtapaOt(item.orden.etapa)),
                          }),
                        onClick: () => void onAvanzar(item),
                      }
              }
            />
          )}
        />
      </main>
    </div>
  );
}
