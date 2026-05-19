import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchArticulos,
  fetchArticulosConPrecios,
  fetchListasPrecio,
} from "@/lib/articulos-api";
import type { ArticuloConPrecio, ListaPrecioRow } from "@/types/articulos";
import { toast } from "sonner";

/**
 * Hook que carga listas de precio y artículos desde Supabase.
 * Cuando cambia listaPrecioId, recarga los artículos con los precios de esa lista.
 */
export function useArticulos(listaPrecioId: string | null) {
  const [listas, setListas] = useState<ListaPrecioRow[]>([]);
  const [articulos, setArticulos] = useState<ArticuloConPrecio[]>([]);
  const [cargando, setCargando] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const prevListaId = useRef<string | null>(null);
  const lastToastRef = useRef<string | null>(null);

  const notifyError = useCallback((message: string) => {
    setError(message);
    if (lastToastRef.current !== message) {
      toast.error(message);
      lastToastRef.current = message;
    }
  }, []);

  // Cargar listas de precio una sola vez
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCargando(false);
      setListas([]);
      return;
    }
    let cancelled = false;
    async function loadListas() {
      try {
        const { data, error: err } = await fetchListasPrecio();
        if (cancelled) return;
        if (err) {
          notifyError(`No se pudieron cargar las listas de precio: ${err.message}`);
          return;
        }
        setListas(data ?? []);
      } catch (error) {
        if (cancelled) return;
        notifyError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las listas de precio.",
        );
      }
    }
    void loadListas();
    return () => {
      cancelled = true;
    };
  }, [notifyError]);

  // Cargar artículos cuando cambia la lista seleccionada
  const cargarArticulos = useCallback(
    async (listaId: string | null) => {
      if (!isSupabaseConfigured) {
        setArticulos([]);
        setCargando(false);
        return;
      }

      setCargando(true);
      setError(null);

      try {
        if (listaId) {
          const { data, error: err } = await fetchArticulosConPrecios(listaId);
          if (err) {
            const { data: plain, error: plainErr } = await fetchArticulos();
            if (plainErr) {
              notifyError(`No se pudieron cargar los artículos: ${plainErr.message}`);
              setArticulos([]);
            } else {
              notifyError(
                `No se pudieron cargar los precios de la lista seleccionada: ${err.message}`,
              );
              setArticulos(plain ?? []);
            }
            return;
          }

          setArticulos(data ?? []);
          return;
        }

        const { data, error: err } = await fetchArticulos();
        if (err) {
          notifyError(`No se pudieron cargar los artículos: ${err.message}`);
          setArticulos([]);
          return;
        }

        setArticulos(data ?? []);
      } catch (error) {
        notifyError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los artículos.",
        );
        setArticulos([]);
      } finally {
        setCargando(false);
      }
    },
    [notifyError],
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCargando(false);
      return;
    }
    if (prevListaId.current === listaPrecioId) return;
    prevListaId.current = listaPrecioId;
    void cargarArticulos(listaPrecioId);
  }, [listaPrecioId, cargarArticulos]);

  const getArticuloById = useCallback(
    (id: string) => articulos.find((a) => a.id === id),
    [articulos],
  );

  return { listas, articulos, cargando, error, getArticuloById };
}
