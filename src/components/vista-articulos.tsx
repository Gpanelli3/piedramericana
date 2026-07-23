"use client";

import { ArticulosCatalogo } from "@/components/articulos/ArticulosCatalogo";

export function VistaArticulos() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white">
        <div className="px-8 pt-5 pb-5">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Artículos</h1>
        </div>
      </header>
      <main className="p-8 [scrollbar-gutter:stable]">
        <ArticulosCatalogo />
      </main>
    </div>
  );
}
