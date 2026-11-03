"use client";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { LucideIcon } from "lucide-react";

type VistaModuloPendienteProps = {
  titulo: string;
  resumen: string;
  icono: LucideIcon;
};

export function VistaModuloPendiente({ titulo, resumen, icono: Icono }: VistaModuloPendienteProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-white">
        <div className="px-5 pt-5 pb-5 sm:px-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{resumen}</p>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-6">
        <Empty className="max-w-md border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icono />
            </EmptyMedia>
            <EmptyTitle>Módulo en el menú, todavía sin desarrollar</EmptyTitle>
            <EmptyDescription>
              Quedó publicado en el sidebar para reservar el lugar. La operatoria se arma en el
              siguiente paso.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    </div>
  );
}
