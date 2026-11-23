"use client";

import { useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { IncentivosCatalogo } from "@/components/equipo/IncentivosCatalogo";
import { PrestadoresCatalogo } from "@/components/equipo/PrestadoresCatalogo";
import { EmpleadosCatalogo } from "@/components/equipo/EmpleadosCatalogo";
import { SueldosCatalogo } from "@/components/equipo/SueldosCatalogo";
import { AdelantosCatalogo } from "@/components/equipo/AdelantosCatalogo";
import {
  EQUIPO_SECCION_LABELS,
  equipoSeccionDesdeParam,
  type EquipoSeccion,
} from "@/types/workspace";

function EquipoShell({
  seccion,
  children,
}: {
  seccion: EquipoSeccion;
  children: ReactNode;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white">
        <div className="px-5 pt-5 pb-5 sm:px-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground" data-guia="modulo-titulo">
            Equipo · {EQUIPO_SECCION_LABELS[seccion]}
          </h1>
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
