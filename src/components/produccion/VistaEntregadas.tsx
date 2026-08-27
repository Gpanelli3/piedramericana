"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { OtDetalleDialog } from "@/components/produccion/OtDetalleDialog";
import { OtListRow } from "@/components/produccion/OtListRow";
import { formatFechaCorta } from "@/components/produccion/ot-ui";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getOtsPorFiltro, type OtProduccionItem } from "@/lib/produccion-api";

export function VistaEntregadas() {
  const [items, setItems] = useState<OtProduccionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [navIndex, setNavIndex] = useState(0);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data, error } = await getOtsPorFiltro("entregadas");
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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white px-6 py-4 sm:px-8 dark:bg-background">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Producción · Entregadas</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Histórico de OTs cerradas (solo lectura)
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-sm font-medium">
            {items.length} entregadas
          </Badge>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
            Todavía no hay OTs entregadas.
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
                  <p className="text-[11px] text-muted-foreground">
                    Cerrada {formatFechaCorta(item.orden.actualizado_en)} · Presupuesto{" "}
                    {item.presupuestoNumero}
                  </p>
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
        permitirEntregar={false}
        navItems={items}
        navIndex={navIndex}
        onNavChange={setNavIndex}
      />
    </div>
  );
}
