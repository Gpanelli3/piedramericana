import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-client";
import { listPresupuestosResumen, type PresupuestoRowList } from "@/lib/presupuestos-api";

/**
 * Presupuestos con resumen de venta (saldo, cobrado, etapa de OT), en caché compartida.
 * Ventas y Clientes usan la misma entrada: si se visitó una, la otra abre con datos.
 */
export function usePresupuestosResumen<T = PresupuestoRowList[]>(
  select?: (rows: PresupuestoRowList[]) => T,
) {
  const query = useQuery({
    queryKey: queryKeys.ventasResumen,
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await listPresupuestosResumen();
      if (error) throw error;
      return data ?? [];
    },
    select,
  });

  useEffect(() => {
    if (query.error) toast.error(query.error.message);
  }, [query.error]);

  return query;
}
