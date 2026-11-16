"use client";

import { ClientesCatalogo } from "@/components/clientes/ClientesCatalogo";

export function VistaClientes() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white">
        <div className="px-5 pt-5 pb-5 sm:px-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Clientes</h1>
        </div>
      </header>
      <main className="p-4 sm:p-6 [scrollbar-gutter:stable]">
        <ClientesCatalogo />
      </main>
    </div>
  );
}
