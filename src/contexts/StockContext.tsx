import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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

export function StockProvider({ children }: { children: ReactNode }) {
  const [chapas, setChapas] = useState<ChapaRow[]>(STOCK_CHAPAS_INICIAL);
  const [slabsLoading, setSlabsLoading] = useState(false);

  const useRemoteStock = isSupabaseConfigured;

  const reloadChapas = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setSlabsLoading(true);
    try {
      const rows = await fetchInventorySlabs();
      setChapas(rows);
    } catch {
      setChapas([]);
    } finally {
      setSlabsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void reloadChapas();
  }, [reloadChapas]);

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

  const setChapasSafe: Dispatch<SetStateAction<ChapaRow[]>> = useCallback((action) => {
    setChapas(action);
  }, []);

  const value = useMemo(
    () => ({
      chapas,
      slabsLoading,
      useRemoteStock,
      setChapas: setChapasSafe,
      reloadChapas,
      tryDeducirChapaPorRotura,
    }),
    [chapas, slabsLoading, useRemoteStock, setChapasSafe, reloadChapas, tryDeducirChapaPorRotura],
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
