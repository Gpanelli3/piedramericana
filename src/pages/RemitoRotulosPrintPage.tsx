"use client";

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RotuloPlacaDocumento } from "@/components/stock/RotuloPlacaDocumento";
import { fetchRotulosRemito, type RotulosRemitoDatos } from "@/lib/rotulo-placa-api";

export function RemitoRotulosPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState<RotulosRemitoDatos | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCargando(true);
      if (!id) {
        setDatos(null);
        setCargando(false);
        return;
      }
      const res = await fetchRotulosRemito(id);
      if (cancelled) return;
      if (res.error || !res.data) {
        toast.error(res.error?.message ?? "No se pudieron armar los rótulos.");
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
    if (window.history.length > 1) navigate(-1);
    else navigate("/?ws=stock");
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-neutral-100 text-foreground print:bg-white">
      <style>{`@media print { @page { size: A4 portrait; margin: 8mm; } }`}</style>
      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-6 py-3 print:hidden">
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={cargando || !datos || datos.placas.length === 0}
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" aria-hidden />
          Imprimir
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={volver}>
          Volver
        </Button>
        {datos ? (
          <p className="text-sm text-muted-foreground">
            Remito {datos.remitoNumero} · {datos.placas.length} placa(s)
          </p>
        ) : null}
      </div>

      <div className="px-4 py-6 print:px-0 print:py-0">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Armando rótulos…</p>
        ) : !datos ? (
          <p className="text-sm text-muted-foreground">Remito no disponible.</p>
        ) : datos.placas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este remito no tiene placas para rotular.</p>
        ) : (
          <div className="flex flex-wrap gap-3 print:gap-2">
            {datos.placas.map((p) => (
              <RotuloPlacaDocumento key={`${p.bulto}-${p.lote}`} datos={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
