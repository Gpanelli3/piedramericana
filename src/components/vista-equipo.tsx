"use client";

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Banknote, Gift, UserCog, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { VistaModuloPendiente } from "@/components/vista-modulo-pendiente";
import {
  EQUIPO_SECCION_LABELS,
  equipoSeccionDesdeParam,
  type EquipoSeccion,
} from "@/types/workspace";

const EQUIPO_META: Record<
  EquipoSeccion,
  { icono: LucideIcon; resumen: string }
> = {
  empleados: {
    icono: Users,
    resumen: "Alta de personal, puestos y estado activo. Todavía sin desarrollar.",
  },
  sueldos: {
    icono: Banknote,
    resumen: "Control interno de liquidaciones (no AFIP). Todavía sin desarrollar.",
  },
  adelantos: {
    icono: UserCog,
    resumen: "Adelantos y viáticos. Todavía sin desarrollar.",
  },
  incentivos: {
    icono: Gift,
    resumen: "Comisiones e incentivos (alcance a definir). Todavía sin desarrollar.",
  },
};

export function VistaEquipo() {
  const [searchParams] = useSearchParams();
  const seccion = useMemo(
    () => equipoSeccionDesdeParam(searchParams.get("eq")),
    [searchParams],
  );
  const meta = EQUIPO_META[seccion];

  return (
    <VistaModuloPendiente
      titulo={`Equipo · ${EQUIPO_SECCION_LABELS[seccion]}`}
      resumen={meta.resumen}
      icono={meta.icono}
    />
  );
}
