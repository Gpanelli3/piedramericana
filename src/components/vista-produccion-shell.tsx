"use client";

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { VistaProduccion } from "@/components/vista-produccion";
import { VistaVentaRetenida } from "@/components/produccion/VistaVentaRetenida";
import { VistaCorte } from "@/components/produccion/VistaCorte";
import { VistaProduccionTab } from "@/components/produccion/VistaProduccionTab";
import { VistaLogistica } from "@/components/produccion/VistaLogistica";
import { VistaEntregadas } from "@/components/produccion/VistaEntregadas";
import { produccionOtDesdeParam } from "@/types/workspace";

export function VistaProduccionShell() {
  const [searchParams] = useSearchParams();
  const ot = useMemo(
    () => produccionOtDesdeParam(searchParams.get("ot")),
    [searchParams],
  );

  switch (ot) {
    case "venta_retenida":
      return <VistaVentaRetenida />;
    case "corte":
      return <VistaCorte />;
    case "produccion":
      return <VistaProduccionTab />;
    case "logistica":
      return <VistaLogistica />;
    case "entregadas":
      return <VistaEntregadas />;
    case "general":
    default:
      return <VistaProduccion />;
  }
}
