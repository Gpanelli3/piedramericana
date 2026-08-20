import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  fetchReportesDashboard,
  type ReportesDashboard,
  type ReportesPeriodo,
} from "@/lib/reportes-api";

const REALTIME_TABLES = [
  "presupuestos",
  "ventas",
  "ventas_pagos",
  "ordenes_trabajo",
  "chapas_inventario",
  "stock_movimientos",
] as const;

const DEBOUNCE_MS = 400;
const POLL_MS = 45_000;

export type UseReportesLiveResult = {
  data: ReportesDashboard | null;
  cargando: boolean;
  error: string | null;
  live: boolean;
  lastUpdatedAt: number | null;
  refrescar: () => Promise<void>;
};

export function useReportesLive(periodo: ReportesPeriodo): UseReportesLiveResult {
  const [data, setData] = useState<ReportesDashboard | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const periodoRef = useRef(periodo);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    periodoRef.current = periodo;
  }, [periodo]);

  const cargar = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isSupabaseConfigured) {
      setData(null);
      setError(null);
      setCargando(false);
      return;
    }
    if (inFlightRef.current && opts?.silent) return;
    inFlightRef.current = true;
    if (!opts?.silent) setCargando(true);
    const res = await fetchReportesDashboard(periodoRef.current);
    if (res.error) {
      setError(res.error.message);
      if (!opts?.silent) setData(null);
    } else {
      setError(null);
      setData(res.data);
      setLastUpdatedAt(Date.now());
    }
    setCargando(false);
    inFlightRef.current = false;
  }, []);

  const scheduleReload = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void cargar({ silent: true });
    }, DEBOUNCE_MS);
  }, [cargar]);

  useEffect(() => {
    void cargar();
  }, [cargar, periodo]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase.channel("reportes-live");
    for (const table of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => scheduleReload(),
      );
    }

    channel.subscribe((status) => {
      setLive(status === "SUBSCRIBED");
    });

    const poll = setInterval(() => {
      void cargar({ silent: true });
    }, POLL_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearInterval(poll);
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [cargar, scheduleReload]);

  return {
    data,
    cargando,
    error,
    live,
    lastUpdatedAt,
    refrescar: () => cargar(),
  };
}
