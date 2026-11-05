import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { abrirPlanoOt } from "@/lib/rotulo-ot-api";
import type { OtProduccionItem } from "@/lib/produccion-api";

export function useAccionesRotuloOt() {
  const navigate = useNavigate();
  const [busyPlanoId, setBusyPlanoId] = useState<string | null>(null);

  const irARotulo = useCallback(
    (otId: string) => {
      navigate(`/ordenes-trabajo/${otId}/rotulo`);
    },
    [navigate],
  );

  const abrirPlano = useCallback(async (item: OtProduccionItem) => {
    setBusyPlanoId(item.orden.id);
    try {
      const res = await abrirPlanoOt(item.presupuestoId, item.orden.orden_key);
      if (res.sinPlano) {
        toast.message("Esta OT no tiene plano adjunto.");
        return;
      }
      if (res.error) {
        toast.error(res.error.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir el plano.");
    } finally {
      setBusyPlanoId(null);
    }
  }, []);

  return { irARotulo, abrirPlano, busyPlanoId };
}
