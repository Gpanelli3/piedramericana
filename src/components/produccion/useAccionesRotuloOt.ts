import { useCallback, useState } from "react";
import { toast } from "sonner";
import { descargarRotuloOt } from "@/components/produccion/descargarRotuloOt";
import { descargarPlanoPorOtId } from "@/lib/rotulo-ot-api";

export function useAccionesRotuloOt() {
  const [rotuloBusy, setRotuloBusy] = useState(false);
  const [planoBusy, setPlanoBusy] = useState(false);

  const descargarRotulo = useCallback(async (otId: string) => {
    setRotuloBusy(true);
    try {
      const res = await descargarRotuloOt(otId);
      if (res.error) toast.error(res.error.message);
      else toast.success("Rótulo descargado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar el rótulo.");
    } finally {
      setRotuloBusy(false);
    }
  }, []);

  const descargarPlano = useCallback(async (otId: string) => {
    setPlanoBusy(true);
    try {
      const res = await descargarPlanoPorOtId(otId);
      if (res.sinPlano) toast.message("Esta OT no tiene plano adjunto.");
      else if (res.error) toast.error(res.error.message);
      else toast.success("Plano descargado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar el plano.");
    } finally {
      setPlanoBusy(false);
    }
  }, []);

  return { descargarRotulo, descargarPlano, rotuloBusy, planoBusy };
}
