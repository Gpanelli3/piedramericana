"use client";

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Wrench } from "lucide-react";
import { VistaProduccion } from "@/components/vista-produccion";
import { VistaModuloPendiente } from "@/components/vista-modulo-pendiente";
import {
  PRODUCCION_OT_LABELS,
  produccionOtDesdeParam,
  type ProduccionOtFiltro,
} from "@/types/workspace";

const RESUMEN_FILTRO: Record<Exclude<ProduccionOtFiltro, "general">, string> = {
  venta_retenida:
    "OTs frenadas por plata, bacha del cliente u otro bloqueo. El filtro aún no aplica sobre el kanban.",
  tecnica:
    "Medición, planos y m² técnicos. Vista dedicada pendiente; hoy la medición vive en el kanban General.",
  produccion:
    "Cola de fabricación (corte / armado). Filtro reservado; usá General para el kanban actual.",
  logistica:
    "Despacho y colocación. Filtro reservado; usá General para el kanban actual.",
  entregadas: "OTs cerradas / entregadas. Listado histórico pendiente de armar.",
};

export function VistaProduccionShell() {
  const [searchParams] = useSearchParams();
  const ot = useMemo(
    () => produccionOtDesdeParam(searchParams.get("ot")),
    [searchParams],
  );

  if (ot === "general") {
    return <VistaProduccion />;
  }

  return (
    <VistaModuloPendiente
      titulo={`Producción · ${PRODUCCION_OT_LABELS[ot]}`}
      resumen={RESUMEN_FILTRO[ot]}
      icono={Wrench}
    />
  );
}
