import { useCallback, useEffect, useState } from "react";
import {
  fetchProcesamientosRecientes,
  registerCanteraProcesamiento,
  type ProcesamientoListItem,
  type RegisterCanteraProcesamientoInput,
} from "@/lib/cantera-stock-api";

export function useCanteraProcesamientos(enabled = true) {
  const [procesamientos, setProcesamientos] = useState<ProcesamientoListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) {
      setProcesamientos([]);
      return;
    }
    setLoading(true);
    try {
      setProcesamientos(await fetchProcesamientosRecientes());
    } catch {
      setProcesamientos([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const register = useCallback(
    async (input: RegisterCanteraProcesamientoInput) => {
      await registerCanteraProcesamiento(input);
      await reload();
    },
    [reload],
  );

  return { procesamientos, loading, reload, register };
}
