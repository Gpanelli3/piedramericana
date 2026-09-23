import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { fetchArticulos, fetchListasPrecio } from "@/lib/articulos-api";
import type { ArticuloConPrecio, ListaPrecioRow } from "@/types/articulos";
import { toast } from "sonner";

/**
 * Carga listas (para materiales/stock) y trabajos con precio fijo.
 * El precio del trabajo no cambia al elegir lista.
 */
export function useArticulos(_listaPrecioId?: string | null) {
  const [listas, setListas] = useState<ListaPrecioRow[]>([]);
  const [articulos, setArticulos] = useState<ArticuloConPrecio[]>([]);
  const [cargando, setCargando] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const lastToastRef = useRef<string | null>(null);

  const notifyError = useCallback((message: string) => {
    setError(message);
    if (lastToastRef.current !== message) {
      toast.error(message);
      lastToastRef.current = message;
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCargando(false);
      setListas([]);
      setArticulos([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setCargando(true);
      setError(null);
      try {
        const [listasRes, artsRes] = await Promise.all([
          fetchListasPrecio(),
          fetchArticulos(),
        ]);
        if (cancelled) return;
        if (listasRes.error) {
          notifyError(`No se pudieron cargar las listas de precio: ${listasRes.error.message}`);
        } else {
          setListas(listasRes.data ?? []);
        }
        if (artsRes.error) {
          notifyError(`No se pudieron cargar los trabajos: ${artsRes.error.message}`);
          setArticulos([]);
        } else {
          setArticulos(artsRes.data ?? []);
        }
      } catch (err) {
        if (cancelled) return;
        notifyError(
          err instanceof Error ? err.message : "No se pudieron cargar los trabajos.",
        );
        setArticulos([]);
      } finally {
        if (!cancelled) setCargando(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [notifyError]);

  const getArticuloById = useCallback(
    (id: string) => articulos.find((a) => a.id === id),
    [articulos],
  );

  return { listas, articulos, cargando, error, getArticuloById };
}
