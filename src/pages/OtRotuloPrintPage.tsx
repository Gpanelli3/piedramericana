"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RotuloOtDocumento } from "@/components/produccion/RotuloOtDocumento";
import { leerRetornoOt } from "@/lib/retorno-ot-dialog";
import { fetchRotuloOt, type RotuloOtDatos } from "@/lib/rotulo-ot-api";

export function OtRotuloPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState<RotuloOtDatos | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCargando(true);
      if (!id) {
        setDatos(null);
        setCargando(false);
        return;
      }
      const res = await fetchRotuloOt(id);
      if (cancelled) return;
      if (res.error || !res.data) {
        toast.error(res.error?.message ?? "No se pudo armar el rótulo.");
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

  const volver = useCallback(() => {
    const back = leerRetornoOt(location.state);
    if (back?.otDialogReturn && back.reabrirOtId) {
      navigate(back.otDialogReturn, { state: { reabrirOtId: back.reabrirOtId } });
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate("/?ws=produccion");
  }, [location.state, navigate]);

  return (
    <div className="min-h-dvh bg-neutral-100 text-foreground print:bg-white">
      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } }`}</style>
      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-6 py-3 print:hidden">
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={cargando || !datos}
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" aria-hidden />
          Imprimir
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={volver}>
          Volver
        </Button>
      </div>

      <div className="mx-auto max-w-[210mm] px-4 py-6 print:max-w-none print:px-0 print:py-0">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Armando el rótulo…</p>
        ) : !datos ? (
          <p className="text-sm text-muted-foreground">OT no disponible para imprimir.</p>
        ) : (
          <div className="border border-neutral-200 bg-white p-4 shadow-sm sm:p-[10mm] print:border-0 print:p-0 print:shadow-none">
            <RotuloOtDocumento datos={datos} />
          </div>
        )}
      </div>
    </div>
  );
}
