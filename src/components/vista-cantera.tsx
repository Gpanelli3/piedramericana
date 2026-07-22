"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mountain } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStock } from "@/contexts/StockContext";
import { CanteraIngresoTab } from "@/features/cantera/CanteraIngresoTab";
import { fetchMaterialsForStock, type MaterialOption } from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";

export function VistaCantera() {
  const { user } = useAuth();
  const { chapas } = useStock();
  const [materialesCatalogo, setMaterialesCatalogo] = useState<MaterialOption[]>([]);
  const [catalogBump, setCatalogBump] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setMaterialesCatalogo([]);
      return;
    }
    let cancel = false;
    void fetchMaterialsForStock()
      .then((m) => {
        if (!cancel) setMaterialesCatalogo(m);
      })
      .catch(() => {
        if (!cancel) setMaterialesCatalogo([]);
      });
    return () => {
      cancel = true;
    };
  }, [chapas.length, catalogBump]);

  const materialesOpciones = useMemo(() => {
    return materialesCatalogo.length > 0
      ? materialesCatalogo
      : [
          ...new Map(
            chapas.map((c) => [
              c.material,
              {
                id: c.material,
                name: c.material,
                unit: "u.",
                material_kind: "marmol" as MaterialOption["material_kind"],
                peso_por_m2_kg: null as number | null,
                bulk_stock_kg: 0,
                stock_qty: 0,
              } satisfies MaterialOption,
            ]),
          ).values(),
        ];
  }, [materialesCatalogo, chapas]);

  const onCatalogStale = useCallback(() => {
    setCatalogBump((n) => n + 1);
  }, []);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
              <Mountain className="h-6 w-6 text-sky-700 dark:text-sky-300" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Cantera / materia prima</p>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Ingreso y procesamiento
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Registrá piedra a granel por peso, procesala en productos vendibles por cantidad, o ingresá
                planchas con medidas desde Stock.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        <CanteraIngresoTab materiales={materialesOpciones} userId={user?.id} onCatalogStale={onCatalogStale} />
      </div>
    </div>
  );
}
