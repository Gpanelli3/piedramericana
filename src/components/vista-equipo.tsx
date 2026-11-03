"use client";

import { useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Banknote, Gift, Handshake, Wallet, Users } from "lucide-react";
import { IncentivosCatalogo } from "@/components/equipo/IncentivosCatalogo";
import { PrestadoresCatalogo } from "@/components/equipo/PrestadoresCatalogo";
import type { LucideIcon } from "lucide-react";
import { EmpleadosCatalogo } from "@/components/equipo/EmpleadosCatalogo";
import { SueldosCatalogo } from "@/components/equipo/SueldosCatalogo";
import { AdelantosCatalogo } from "@/components/equipo/AdelantosCatalogo";
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
    resumen: "Alta de personal, puestos y estado activo.",
  },
  sueldos: {
    icono: Banknote,
    resumen: "Liquidación mensual interna (no AFIP): base, extras y descuentos.",
  },
  adelantos: {
    icono: Wallet,
    resumen: "Adelantos y viáticos a descontar en la liquidación del mes.",
  },
  incentivos: {
    icono: Gift,
    resumen: "Comisiones, premios y bonos. Cada alta también sale en Finanzas.",
  },
  prestadores: {
    icono: Handshake,
    resumen: "Pagos a contador, redes y otros que no están en nómina.",
  },
};

function EquipoShell({
  seccion,
  children,
}: {
  seccion: EquipoSeccion;
  children: ReactNode;
}) {
  const meta = EQUIPO_META[seccion];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white">
        <div className="px-5 pt-5 pb-5 sm:px-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Equipo · {EQUIPO_SECCION_LABELS[seccion]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{meta.resumen}</p>
        </div>
      </header>
      <main className="p-4 sm:p-6 [scrollbar-gutter:stable]">{children}</main>
    </div>
  );
}

export function VistaEquipo() {
  const [searchParams] = useSearchParams();
  const seccion = useMemo(
    () => equipoSeccionDesdeParam(searchParams.get("eq")),
    [searchParams],
  );

  if (seccion === "empleados") {
    return (
      <EquipoShell seccion="empleados">
        <EmpleadosCatalogo />
      </EquipoShell>
    );
  }

  if (seccion === "sueldos") {
    return (
      <EquipoShell seccion="sueldos">
        <SueldosCatalogo />
      </EquipoShell>
    );
  }

  if (seccion === "adelantos") {
    return (
      <EquipoShell seccion="adelantos">
        <AdelantosCatalogo />
      </EquipoShell>
    );
  }

  if (seccion === "incentivos") {
    return (
      <EquipoShell seccion="incentivos">
        <IncentivosCatalogo />
      </EquipoShell>
    );
  }

  return (
    <EquipoShell seccion="prestadores">
      <PrestadoresCatalogo />
    </EquipoShell>
  );
}
