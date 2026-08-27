"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { OtDetalleDialog } from "@/components/produccion/OtDetalleDialog";
import { OtListRow } from "@/components/produccion/OtListRow";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getOtsPorFiltro, marcarOtEntregada, type OtProduccionItem } from "@/lib/produccion-api";

export function VistaLogistica() {
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
    const { data, error } = await getOtsPorFiltro("logistica");
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Producción · Logística</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Despacho y colocación — OTs en etapa Despacho
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-sm font-medium">
            {items.length} en logística
          </Badge>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
            No hay OTs en despacho.
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
                    <p className="text-[11px] text-muted-foreground">Obra: {item.direccionObra}</p>
                  ) : null
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
