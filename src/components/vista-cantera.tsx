"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
                familia: null,
                codigo: null,
                costo_usd: null,
                espesor_mm: null,
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
      <header className="border-b border-border bg-card px-4 py-4 sm:px-8 sm:py-5">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Ingreso y procesamiento
        </h1>
      </header>

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        <CanteraIngresoTab materiales={materialesOpciones} userId={user?.id} onCatalogStale={onCatalogStale} />
      </div>
    </div>
  );
}
