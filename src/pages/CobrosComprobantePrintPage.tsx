"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CobrosComprobanteDocumento } from "@/components/venta/CobrosComprobanteDocumento";
import {
  loadCobrosComprobante,
  type CobrosComprobanteDatos,
} from "@/lib/cobros-comprobante";

export function CobrosComprobantePrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoDescargar = searchParams.get("descargar") === "1";
  const autoPrintDone = useRef(false);

  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState<CobrosComprobanteDatos | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCargando(true);
      if (!id) {
        setDatos(null);
        setCargando(false);
        return;
      }

      const res = await loadCobrosComprobante(id);
      if (cancelled) return;
      if (res.error) {
        toast.error(res.error.message);
        setDatos(null);
      } else {
        setDatos(res.data);
      }
      setCargando(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!autoDescargar || cargando || !datos || autoPrintDone.current) return;
    autoPrintDone.current = true;
    const t = window.setTimeout(() => {
      window.print();
    }, 350);
    return () => window.clearTimeout(t);
  }, [autoDescargar, cargando, datos]);

  const volver = useCallback(() => {
    navigate("/?ws=administracion");
  }, [navigate]);

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

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 print:px-0 print:py-0">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Generando comprobante…</p>
        ) : !datos ? (
          <p className="text-sm text-muted-foreground">
            Presupuesto no disponible para imprimir el comprobante.
          </p>
        ) : (
          <CobrosComprobanteDocumento
            className="border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 print:border-0 print:p-0 print:shadow-none"
            numeroPresupuesto={datos.numeroPresupuesto}
            clienteNombre={datos.clienteNombre}
            contacto={datos.contacto}
            tel={datos.tel}
            email={datos.email}
            etapaLabel={datos.etapaLabel}
            moneda={datos.moneda}
            total={datos.total}
            cobrado={datos.cobrado}
            saldo={datos.saldo}
            pagos={datos.pagos}
            fechaEmision={new Date().toLocaleDateString("es-AR")}
          />
        )}
      </div>
    </div>
  );
}
