"use client";

import { ProveedoresCatalogo } from "@/components/proveedores/ProveedoresCatalogo";

export function VistaProveedores() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white">
        <div className="px-8 pt-5 pb-5">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Proveedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Maestro único: placas naturales, industriales, piedra por kg y otros. Con remitos, cantera y pagos relacionados.
          </p>
        </div>
      </header>
      <main className="p-8 [scrollbar-gutter:stable]">
        <ProveedoresCatalogo />
      </main>
    </div>
  );
}
