"use client";

import { ImportacionesCatalogo } from "@/components/comercio-exterior/ImportacionesCatalogo";

export function VistaComercioExterior() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white">
        <div className="px-8 pt-5 pb-5">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Comercio exterior</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seguimiento de importaciones, costos de nacionalización y mercadería en tránsito.
          </p>
        </div>
      </header>
      <main className="p-8 [scrollbar-gutter:stable]">
        <ImportacionesCatalogo />
      </main>
    </div>
  );
}
