"use client";

import { ArticulosCatalogo } from "@/components/articulos/ArticulosCatalogo";

export function VistaArticulos() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white">
        <div className="px-5 pt-5 pb-5 sm:px-6">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Trabajos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tipos de trabajo sobre la piedra, con un precio fijo en pesos o dólares.
          </p>
        </div>
      </header>
      <main className="p-4 sm:p-6 [scrollbar-gutter:stable]">
        <ArticulosCatalogo />
      </main>
    </div>
  );
}
