"use client";

import { ArticulosCatalogo } from "@/components/articulos/ArticulosCatalogo";
import { ListasPrecioPanel } from "@/components/articulos/ListasPrecioPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function VistaArticulos() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white">
        <div className="px-8 pt-5 pb-5">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Sub-ítems</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tipos de línea y listas de precio para presupuestos.
          </p>
        </div>
      </header>
      <main className="p-8 [scrollbar-gutter:stable]">
        <Tabs defaultValue="catalogo" className="gap-5">
          <TabsList>
            <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
            <TabsTrigger value="listas">Listas de precio</TabsTrigger>
          </TabsList>
          <TabsContent value="catalogo">
            <ArticulosCatalogo />
          </TabsContent>
          <TabsContent value="listas">
            <ListasPrecioPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
