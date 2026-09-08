"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listPresupuestosResumen,
  type PresupuestoRowList,
} from "@/lib/presupuestos-api";
import { etiquetaEtapaOt } from "@/lib/etiquetas-ot";
import { cn } from "@/lib/utils";

function formatMonto(n: number, moneda: "ars" | "usd") {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: moneda === "usd" ? 2 : 0,
  };
  if (moneda === "usd") {
    return `USD ${n.toLocaleString("es-AR", opts)}`;
  }
  return `$ ${n.toLocaleString("es-AR", opts)}`;
}

function formatoFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Listado imprimible de obras y cobros (PDF vía diálogo del navegador). */
export function ObrasCobrosPrintPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoDescargar = searchParams.get("descargar") === "1";
  const autoPrintDone = useRef(false);

  const [cargando, setCargando] = useState(true);
  const [filas, setFilas] = useState<PresupuestoRowList[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCargando(true);
      const { data, error } = await listPresupuestosResumen();
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setFilas([]);
      } else {
        setFilas((data ?? []).filter((r) => r.status === "aprobado"));
      }
      setCargando(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!autoDescargar || cargando || autoPrintDone.current) return;
    autoPrintDone.current = true;
    const t = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(t);
  }, [autoDescargar, cargando]);

  const totales = useMemo(() => {
    let totalUsd = 0;
    let cobradoUsd = 0;
    let saldoUsd = 0;
    let totalArs = 0;
    let cobradoArs = 0;
    let saldoArs = 0;
    for (const r of filas) {
      const cob = r.total_pagado_misma_moneda ?? 0;
      const sal = r.saldo_misma_moneda ?? r.total;
      if (r.moneda === "usd") {
        totalUsd += r.total;
        cobradoUsd += cob;
        if (sal > 0) saldoUsd += sal;
      } else {
        totalArs += r.total;
        cobradoArs += cob;
        if (sal > 0) saldoArs += sal;
      }
    }
    return { totalUsd, cobradoUsd, saldoUsd, totalArs, cobradoArs, saldoArs };
  }, [filas]);

  const volver = useCallback(() => {
    navigate("/?ws=administracion");
  }, [navigate]);

  const fechaEmision = new Date().toLocaleDateString("es-AR");

  return (
    <div className="min-h-dvh bg-neutral-100 text-foreground print:bg-white">
      <div className="print:hidden flex flex-wrap items-center gap-2 border-b bg-background px-6 py-3">
        <Button type="button" size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Download className="h-4 w-4" aria-hidden />
          Descargar PDF
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" aria-hidden />
          Imprimir
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={volver}>
          Volver a ventas
        </Button>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 print:px-0 print:py-0">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Generando listado…</p>
        ) : (
          <div
            className={cn(
              "border border-neutral-200 bg-white p-4 text-neutral-900 shadow-sm sm:p-5",
              "print:border-0 print:p-0 print:shadow-none",
            )}
          >
            <header className="mb-4 grid grid-cols-[1fr_auto] items-end gap-3 border-b border-neutral-800 pb-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-900">
                  Piedra Americana
                </p>
                <h1 className="mt-1 text-lg font-semibold">Obras y cobros</h1>
                <p className="text-xs text-neutral-600">
                  Cuentas corrientes · {filas.length} venta{filas.length === 1 ? "" : "s"}
                </p>
              </div>
              <p className="text-xs tabular-nums text-neutral-600">{fechaEmision}</p>
            </header>

            <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div className="rounded border border-neutral-300 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">Saldo USD</p>
                <p className="font-semibold tabular-nums">{formatMonto(totales.saldoUsd, "usd")}</p>
              </div>
              <div className="rounded border border-neutral-300 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">Saldo ARS</p>
                <p className="font-semibold tabular-nums">{formatMonto(totales.saldoArs, "ars")}</p>
              </div>
              <div className="rounded border border-neutral-300 px-3 py-2 sm:col-span-1 col-span-2">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">Cobrado</p>
                <p className="font-semibold tabular-nums">
                  {formatMonto(totales.cobradoUsd, "usd")} · {formatMonto(totales.cobradoArs, "ars")}
                </p>
              </div>
            </div>

            {filas.length === 0 ? (
              <p className="text-sm text-neutral-600">No hay presupuestos aprobados.</p>
            ) : (
              <table className="w-full border-collapse text-left text-[11px] leading-snug">
                <thead>
                  <tr className="bg-neutral-100">
                    <th className="border border-neutral-300 px-2 py-1.5 font-semibold">Presup.</th>
                    <th className="border border-neutral-300 px-2 py-1.5 font-semibold">Cliente</th>
                    <th className="border border-neutral-300 px-2 py-1.5 font-semibold">Etapa</th>
                    <th className="border border-neutral-300 px-2 py-1.5 text-right font-semibold">
                      Total
                    </th>
                    <th className="border border-neutral-300 px-2 py-1.5 text-right font-semibold">
                      Cobrado
                    </th>
                    <th className="border border-neutral-300 px-2 py-1.5 text-right font-semibold">
                      Saldo
                    </th>
                    <th className="border border-neutral-300 px-2 py-1.5 font-semibold">Vendedor</th>
                    <th className="border border-neutral-300 px-2 py-1.5 font-semibold">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((r) => {
                    const cobrado = r.total_pagado_misma_moneda ?? 0;
                    const saldo = r.saldo_misma_moneda ?? r.total;
                    return (
                      <tr key={r.id}>
                        <td className="border border-neutral-200 px-2 py-1.5 font-medium tabular-nums">
                          {r.numero}
                        </td>
                        <td className="border border-neutral-200 px-2 py-1.5">{r.cliente || "—"}</td>
                        <td className="border border-neutral-200 px-2 py-1.5">
                          {etiquetaEtapaOt(r.ot_etapa, r.ot_estado)}
                        </td>
                        <td className="border border-neutral-200 px-2 py-1.5 text-right tabular-nums">
                          {formatMonto(r.total, r.moneda)}
                        </td>
                        <td className="border border-neutral-200 px-2 py-1.5 text-right tabular-nums">
                          {formatMonto(cobrado, r.moneda)}
                        </td>
                        <td className="border border-neutral-200 px-2 py-1.5 text-right font-medium tabular-nums">
                          {saldo <= 0.009 ? "Pagado" : formatMonto(saldo, r.moneda)}
                        </td>
                        <td className="border border-neutral-200 px-2 py-1.5">
                          {r.vendedor_nombre?.trim() || "—"}
                        </td>
                        <td className="border border-neutral-200 px-2 py-1.5 tabular-nums">
                          {formatoFecha(r.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <p className="mt-4 text-[10px] text-neutral-500">
              Documento informativo · Piedra Americana
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
