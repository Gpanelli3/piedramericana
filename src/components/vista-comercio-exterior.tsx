"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportacionesCatalogo } from "@/components/comercio-exterior/ImportacionesCatalogo";
import { ExportacionesCatalogo } from "@/components/comercio-exterior/ExportacionesCatalogo";

export function VistaComercioExterior() {
  const [tab, setTab] = useState("importaciones");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white">
        <div className="px-5 pt-5 pb-5 sm:px-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground" data-guia="modulo-titulo">Comercio exterior</h1>
        </div>
      </header>
      <main className="p-4 sm:p-6 [scrollbar-gutter:stable]">
        <Tabs value={tab} onValueChange={setTab} className="gap-5">
          <TabsList data-guia="pestanas">
            <TabsTrigger value="importaciones">Importaciones</TabsTrigger>
            <TabsTrigger value="exportaciones">Exportaciones</TabsTrigger>
          </TabsList>
          <TabsContent value="importaciones">
            <ImportacionesCatalogo />
          </TabsContent>
          <TabsContent value="exportaciones">
            <ExportacionesCatalogo />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
