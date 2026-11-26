import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-client";
import {
  getOtsAgrupadas,
  getOtsAgrupadasPorFiltro,
  type VentaGrupoOt,
} from "@/lib/produccion-api";
import type { ProduccionOtFiltro } from "@/types/workspace";

const SIN_DATOS: VentaGrupoOt[] = [];

/**
 * OTs agrupadas por venta para una pestaña de Órdenes de Trabajo, con caché.
 *
 * - `loading` solo es true la primera vez (sin datos guardados): al volver a la
 *   pestaña se muestra lo último y se actualiza por detrás.
 * - `refresh` invalida todas las listas de OTs, porque un cambio en una OT
 *   la puede mover de pestaña.
 */
export function useOtsGrupos(filtro: ProduccionOtFiltro) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.otsGrupos(filtro),
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const res =
        filtro === "general" ? await getOtsAgrupadas() : await getOtsAgrupadasPorFiltro(filtro);
      if (res.error) throw res.error;
      return res.data;
    },
  });

  useEffect(() => {
    if (query.error) toast.error(query.error.message);
  }, [query.error]);

  const refresh = useCallback(() => {
    // La lista de Ventas muestra la etapa de la OT: también queda para revalidar.
    void queryClient.invalidateQueries({ queryKey: queryKeys.ventas });
    return queryClient.invalidateQueries({ queryKey: queryKeys.ots });
  }, [queryClient]);

  return {
    grupos: query.data ?? SIN_DATOS,
    loading: query.isPending && query.fetchStatus !== "idle",
    refresh,
  };
}
