import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { stateIrADetalleOt } from "@/lib/retorno-ot-dialog";

export function useAccionesRotuloOt() {
  const navigate = useNavigate();

  const irARotulo = useCallback(
    (otId: string) => {
      navigate(`/ordenes-trabajo/${otId}/rotulo`, { state: stateIrADetalleOt(otId) });
    },
    [navigate],
  );

  const irAPlano = useCallback(
    (otId: string) => {
      navigate(`/ordenes-trabajo/${otId}/plano`, { state: stateIrADetalleOt(otId) });
    },
    [navigate],
  );

  return { irARotulo, irAPlano };
}
