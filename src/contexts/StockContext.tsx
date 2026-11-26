import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  type ChapaRow,
  STOCK_CHAPAS_INICIAL,
  fetchInventorySlabs,
  deleteFirstAvailableSlabMatching,
} from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";

export type { ChapaRow };
export { STOCK_CHAPAS_INICIAL };

/** Claves del selector de rotura en producción → fragmento a buscar en material. */
const ROTURA_KEY_TO_NEEDLE: Record<string, string> = {
  "granito-negro": "Granito Negro Brasil",
  "silestone-blanco": "Silestone",
  "cuarcita-black": "Cuarcita",
  "dekton-trilium": "Dekton",
  "granito-boreal": "Boreal",
};

type StockContextValue = {
  chapas: ChapaRow[];
  slabsLoading: boolean;
  useRemoteStock: boolean;
  setChapas: Dispatch<SetStateAction<ChapaRow[]>>;
  reloadChapas: () => Promise<void>;
  /** Quita la primera chapa disponible cuyo material contenga la aguja del catálogo de roturas. */
  tryDeducirChapaPorRotura: (materialSelectKey: string) => Promise<{ removed: boolean; bulto?: string }>;
};

const StockContext = createContext<StockContextValue | null>(null);

const SIN_CHAPAS: ChapaRow[] = [];

export function StockProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const useRemoteStock = isSupabaseConfigured;

  // Placas en caché. Sin Supabase se trabaja en memoria con los datos de ejemplo.
  // (Antes arrancaba con los de ejemplo también con Supabase y se veían un instante.)
  const chapasQuery = useQuery({
    queryKey: queryKeys.stockChapas,
    queryFn: async () => {
      if (!isSupabaseConfigured) return [...STOCK_CHAPAS_INICIAL];
      try {
        return await fetchInventorySlabs();
      } catch {
        return [];
      }
    },
    // Sin Supabase no hay base que revalidar: lo que se edita en memoria no se pisa.
    staleTime: isSupabaseConfigured ? 0 : Infinity,
  });
  const chapas = chapasQuery.data ?? SIN_CHAPAS;
  const slabsLoading = chapasQuery.isFetching;

  const setChapas: Dispatch<SetStateAction<ChapaRow[]>> = useCallback(
    (action) => {
      queryClient.setQueryData<ChapaRow[]>(queryKeys.stockChapas, (prev = []) =>
        typeof action === "function" ? action(prev) : action,
      );
    },
    [queryClient],
  );

  const reloadChapas = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.stockChapas });
  }, [queryClient]);

  const tryDeducirChapaPorRotura = useCallback(
    async (materialSelectKey: string): Promise<{ removed: boolean; bulto?: string }> => {
      const needle = ROTURA_KEY_TO_NEEDLE[materialSelectKey];
      if (!needle) return { removed: false };

      if (!isSupabaseConfigured) {
        let out: { removed: boolean; bulto?: string } = { removed: false };
        setChapas((prev) => {
          const idx = prev.findIndex(
            (c) => c.estado === "Disponible" && c.material.includes(needle),
          );
          if (idx === -1) return prev;
          out = { removed: true, bulto: prev[idx]!.bulto };
          return prev.filter((_, i) => i !== idx);
        });
        return out;
      }

      const result = await deleteFirstAvailableSlabMatching(needle);
      await reloadChapas();
      return result;
    },
    [reloadChapas],
  );

  const value = useMemo(
    () => ({
      chapas,
      slabsLoading,
      useRemoteStock,
      setChapas,
      reloadChapas,
      tryDeducirChapaPorRotura,
    }),
    [chapas, slabsLoading, useRemoteStock, setChapas, reloadChapas, tryDeducirChapaPorRotura],
  );

  return <StockContext.Provider value={value}>{children}</StockContext.Provider>;
}

export function useStock(): StockContextValue {
  const ctx = useContext(StockContext);
  if (!ctx) {
    throw new Error("useStock debe usarse dentro de StockProvider");
  }
  return ctx;
}
