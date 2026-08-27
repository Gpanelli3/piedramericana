"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OtDetalleDialog } from "@/components/produccion/OtDetalleDialog";
import { OtListRow } from "@/components/produccion/OtListRow";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getOtsPorFiltro,
  setOtDesbloqueada,
  setOtPausada,
  type OtProduccionItem,
} from "@/lib/produccion-api";
import { Pause, Unlock } from "lucide-react";

export function VistaVentaRetenida() {
  const [items, setItems] = useState<OtProduccionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [navIndex, setNavIndex] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data, error } = await getOtsPorFiltro("venta_retenida");
    setLoading(false);
    if (error) {
      toast.error(error.message);
      setItems([]);
      return;
    }
    setItems(data);
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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white px-6 py-4 sm:px-8 dark:bg-background">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Producción · Venta retenida</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              OTs bloqueadas o pausadas (plata, bacha, rotura u otro motivo)
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-sm font-medium">
            {items.length} retenidas
          </Badge>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
            No hay OTs retenidas en este momento.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            {items.map((item) => (
              <OtListRow
                key={item.orden.id}
                item={item}
                onVer={() => {
                  setNavIndex(items.findIndex((i) => i.orden.id === item.orden.id));
                  setDetalleOpen(true);
                }}
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
            ))}
          </div>
        )}
      </main>

      <OtDetalleDialog
        item={items[navIndex] ?? null}
        open={detalleOpen}
        onOpenChange={setDetalleOpen}
        onChanged={() => void refresh()}
        navItems={items}
        navIndex={navIndex}
        onNavChange={setNavIndex}
      />
    </div>
  );
}
