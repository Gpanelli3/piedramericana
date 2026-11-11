"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { leerRetornoOt } from "@/lib/retorno-ot-dialog";
import { getOtProduccionById } from "@/lib/produccion-api";
import { resolverPlanoOt, type PlanoOtArchivo } from "@/lib/rotulo-ot-api";

export function OtPlanoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [cargando, setCargando] = useState(true);
  const [sinPlano, setSinPlano] = useState(false);
  const [archivo, setArchivo] = useState<PlanoOtArchivo | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCargando(true);
      setSinPlano(false);
      setArchivo(null);
      if (!id) {
        setCargando(false);
        setSinPlano(true);
        return;
      }
      const ot = await getOtProduccionById(id);
      if (cancelled) return;
      if (ot.error || !ot.data) {
        toast.error(ot.error?.message ?? "No se pudo abrir la orden.");
        setCargando(false);
        return;
      }
      const res = await resolverPlanoOt(ot.data.presupuestoId, ot.data.orden.orden_key);
      if (cancelled) return;
      if (res.error) toast.error(res.error.message);
      setSinPlano(res.sinPlano);
      setArchivo(res.data);
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

  const esImagen = archivo?.mime.startsWith("image/") ?? false;

  return (
    <div className="flex h-dvh flex-col bg-neutral-100 text-foreground">
      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-6 py-3">
        <Button type="button" size="sm" variant="outline" onClick={volver}>
          Volver
        </Button>
        {archivo ? (
          <p className="truncate text-sm text-muted-foreground">{archivo.name}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        {cargando ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">Abriendo el plano…</p>
        ) : sinPlano || !archivo ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">Esta OT no tiene plano adjunto.</p>
        ) : esImagen ? (
          <div className="flex h-full items-center justify-center overflow-auto p-4">
            <img src={archivo.url} alt={archivo.name} className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <iframe title={archivo.name} src={archivo.url} className="h-full w-full border-0 bg-white" />
        )}
      </div>
    </div>
  );
}
