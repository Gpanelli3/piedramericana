"use client";

import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PresupuestoResumenInterior } from "@/components/presupuesto/PresupuestoResumenInterior";
import type { LineaResumenMoneda } from "@/components/presupuesto/PresupuestoResumenInterior";
import { getPresupuestoById } from "@/lib/presupuestos-api";
import type { Database } from "@/types/database";
import { isPresupuestoPayloadV1 } from "@/types/presupuesto-payload";

type PresupuestoRow = Database["public"]["Tables"]["presupuestos"]["Row"];

export function PresupuestoPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cargando, setCargando] = useState(true);
  const [fila, setFila] = useState<PresupuestoRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCargando(true);
      if (!id) {
        setFila(null);
        setCargando(false);
        return;
      }
      const res = await getPresupuestoById(id);
      if (cancelled) return;
      setCargando(false);
      if (res.error || !res.data) {
        toast.error(res.error?.message ?? "No encontramos ese presupuesto.");
        setFila(null);
        return;
      }
      setFila(res.data as PresupuestoRow);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const noopStr = useCallback((_v: string) => {}, []);
  const noopBool = useCallback((_v: boolean) => {}, []);
  const noopLinea = useCallback((_id: string, _patch: Partial<LineaResumenMoneda>) => {}, []);

  const payloadRaw = fila?.payload ?? null;
  const ok = payloadRaw !== null && isPresupuestoPayloadV1(payloadRaw);

  const volverVentas = useCallback(() => {
    navigate("/?ws=ventas&pv=list&ft=pendientes");
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="print:hidden sticky top-0 z-30 border-b bg-background/95 backdrop-blur flex flex-wrap items-center gap-2 px-6 py-3">
        <Button type="button" size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden />
          Imprimir
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={volverVentas}>
          Volver a presupuestos
        </Button>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Generando vista de impresión…</p>
        ) : !fila ? (
          <p className="text-sm text-muted-foreground">
            Presupuesto no disponible para imprimir.
          </p>
        ) : (
          <>
            <div className="space-y-1 border-b pb-6">
              <p className="text-xs text-muted-foreground">
                {new Date(fila.created_at).toLocaleDateString("es-AR")}
              </p>
              <h1 className="text-2xl font-bold tracking-tight">{fila.numero}</h1>
              <p className="text-sm text-muted-foreground">
                Cliente: <span className="text-foreground font-medium">{fila.cliente || "—"}</span>
                {" · "}
                Estado:{" "}
                <span className="font-medium text-foreground">
                  {fila.status === "pendiente"
                    ? "Pendiente"
                    : fila.status === "aprobado"
                      ? "Aprobado"
                      : "Rechazado"}
                </span>
              </p>
            </div>

            {!ok ? (
              <p className="text-sm text-muted-foreground">
                El detalle de este presupuesto no permite renderizar esta versión para impresión.
              </p>
            ) : (
              <PresupuestoResumenInterior
                readOnly
                dolarHoy={payloadRaw.dolarHoy}
                cotizacionMixtaActiva={payloadRaw.cotizacionMixtaActiva}
                setCotizacionMixtaActiva={noopBool}
                lineasResumen={payloadRaw.lineasResumen}
                setLineaResumen={noopLinea}
                monedaFinal={payloadRaw.monedaFinal}
                setMonedaFinal={noopStr}
                totalUsdEquivalente={payloadRaw.totalUsdEquivalente}
                totalArsEquivalente={payloadRaw.totalArsEquivalente}
                materialM2Presupuesto={payloadRaw.materialM2Presupuesto}
                materialTonEstimadoPresupuesto={payloadRaw.materialTonEstimadoPresupuesto}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
