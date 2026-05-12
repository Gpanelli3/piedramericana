import { useCallback, useEffect, useState } from "react";
import {
  fetchInventoryLotesList,
  registerCanteraIngreso,
  type InventoryLoteListItem,
  type RegisterCanteraLineInput,
} from "@/lib/cantera-stock-api";

export function useCanteraLotes(enabled = true) {
  const [lotes, setLotes] = useState<InventoryLoteListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) {
      setLotes([]);
      return;
    }
    setLoading(true);
    try {
      setLotes(await fetchInventoryLotesList());
    } catch {
      setLotes([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const register = useCallback(
    async (lines: RegisterCanteraLineInput[]) => {
      await registerCanteraIngreso(lines);
      await reload();
    },
    [reload],
  );

  return { lotes, loading, reload, register };
}
