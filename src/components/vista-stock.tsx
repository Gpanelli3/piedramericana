"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info, Search, Layers, Box, Ruler, Package, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStock } from "@/contexts/StockContext";
import { useAuth } from "@/contexts/AuthContext";
import { CrearRemitoDialog } from "@/components/stock/CrearRemitoDialog";
import { IngresosTab } from "@/components/stock/IngresosTab";
import { RecortesPorMaterialTab } from "@/components/stock/RecortesPorMaterialTab";
import { MaterialesCatalogoTab } from "@/components/stock/MaterialesCatalogoTab";
import { DisponibilidadMaterialSheet } from "@/components/stock/DisponibilidadMaterialSheet";
import {
  fetchMaterialsForStock,
  countScrapsSince,
  type MaterialOption,
} from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";

export function VistaStock() {
  const { user } = useAuth();
  const { chapas, setChapas, reloadChapas, slabsLoading } = useStock();
  const [busquedaPiedra, setBusquedaPiedra] = useState("");
  const [remitoOpen, setRemitoOpen] = useState(false);
  const [disponibilidadOpen, setDisponibilidadOpen] = useState(false);
  const [materialDisponibilidad, setMaterialDisponibilidad] = useState<string | null>(null);
  const [materialesCatalogo, setMaterialesCatalogo] = useState<MaterialOption[]>([]);
  const [scrapToday, setScrapToday] = useState<number | null>(null);
  const [historialBump, setHistorialBump] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setMaterialesCatalogo([]);
      setScrapToday(null);
      return;
    }
    let cancel = false;
    void fetchMaterialsForStock()
      .then((m) => {
        if (!cancel) setMaterialesCatalogo(m);
      })
      .catch(() => {
        if (!cancel) setMaterialesCatalogo([]);
      });

    const d = new Date();
    d.setHours(0, 0, 0, 0);
    void countScrapsSince(d.toISOString())
      .then((n) => {
        if (!cancel) setScrapToday(n);
      })
      .catch(() => {
        if (!cancel) setScrapToday(null);
      });
    return () => {
      cancel = true;
    };
  }, [chapas.length, historialBump]);

  const refreshHistorialRelated = useCallback(() => {
    setHistorialBump((n) => n + 1);
  }, []);

  const reloadRemitosHistoria = useCallback(async () => {
    refreshHistorialRelated();
  }, [refreshHistorialRelated]);

  const m2Chapa = (largoCm: number, anchoCm: number) => (largoCm / 100) * (anchoCm / 100);

  const formatM2 = (n: number) =>
    n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const resumenPiedra = useMemo(() => {
    const activas = chapas.filter((c) => c.estado === "Disponible" || c.estado === "Reservada");
    const disponibles = chapas.filter((c) => c.estado === "Disponible");
    const reservadas = chapas.filter((c) => c.estado === "Reservada");
    const m2Disp = disponibles.reduce((s, c) => s + m2Chapa(c.largoCm, c.anchoCm), 0);
    return {
      bultos: activas.length,
      bultosLibres: disponibles.length,
      bultosReservados: reservadas.length,
      m2Disponibles: m2Disp,
    };
  }, [chapas]);

  const chapasFiltradas = useMemo(() => {
    const q = busquedaPiedra.trim().toLowerCase();
    if (!q) return chapas;
    return chapas.filter(
      (c) =>
        c.bulto.toLowerCase().includes(q) ||
        c.material.toLowerCase().includes(q) ||
        c.estado.toLowerCase().includes(q) ||
        (c.loteCodigo ?? "").toLowerCase().includes(q),
    );
  }, [chapas, busquedaPiedra]);

  const existingBultosLower = useMemo(() => new Set(chapas.map((c) => c.bulto.toLowerCase())), [chapas]);

  const materialesOpciones =
    materialesCatalogo.length > 0
      ? materialesCatalogo
      : [
          ...new Map(
            chapas.map((c) => [
              c.material,
              {
                id: c.material,
                name: c.material,
                unit: "u.",
                material_kind: "marmol" as MaterialOption["material_kind"],
                peso_por_m2_kg: null as number | null,
                bulk_stock_kg: 0,
                stock_qty: 0,
              } satisfies MaterialOption,
            ]),
          ).values(),
        ];

  const openDisponibilidad = (nombre: string) => {
    setMaterialDisponibilidad(nombre);
    setDisponibilidadOpen(true);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-card px-4 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Stock
              {slabsLoading ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  Actualizando inventario…
                </span>
              ) : null}
            </h1>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-4xl">
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Bultos disponibles</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {resumenPiedra.bultosLibres}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                de {resumenPiedra.bultos}
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">m² piedra disponible</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">{formatM2(resumenPiedra.m2Disponibles)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Reservadas</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {resumenPiedra.bultosReservados}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Recortes hoy</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {!isSupabaseConfigured ? (
                <>
                  –
                  <span className="text-sm font-normal text-muted-foreground"> sin DB</span>
                </>
              ) : scrapToday === null ? (
                "…"
              ) : (
                scrapToday
              )}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        <CrearRemitoDialog
          open={remitoOpen}
          onOpenChange={setRemitoOpen}
          materiales={materialesOpciones}
          userId={user?.id}
          reloadChapas={reloadChapas}
          refreshRemitos={reloadRemitosHistoria}
          setChapas={setChapas}
          existingBultosLower={existingBultosLower}
        />

        <DisponibilidadMaterialSheet
          materialLabel={materialDisponibilidad}
          open={disponibilidadOpen}
          onOpenChange={(o) => {
            setDisponibilidadOpen(o);
            if (!o) setMaterialDisponibilidad(null);
          }}
          chapasLocales={chapas}
        />

        <Tabs defaultValue="materiales" className="gap-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
            <TabsTrigger value="materiales" className="gap-1.5 px-3">
              <Package className="h-4 w-4" />
              Materiales
            </TabsTrigger>
            <TabsTrigger value="ingresos" className="gap-1.5 px-3">
              <Truck className="h-4 w-4" />
              Ingresos
            </TabsTrigger>
            <TabsTrigger value="planchas" className="gap-1.5 px-3">
              <Layers className="h-4 w-4" />
              Planchas
            </TabsTrigger>
            <TabsTrigger value="recortes" className="gap-1.5 px-3">
              <Box className="h-4 w-4" />
              Recortes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="materiales" className="mt-4">
            <MaterialesCatalogoTab
              materiales={materialesCatalogo}
              onMaterialCreated={(m) => {
                setMaterialesCatalogo((prev) =>
                  [...prev, m].sort((a, b) => a.name.localeCompare(b.name, "es")),
                );
              }}
            />
          </TabsContent>

          <TabsContent value="ingresos" className="mt-4">
            <IngresosTab
              onRegistrarIngreso={() => setRemitoOpen(true)}
              historialBump={historialBump}
            />
          </TabsContent>

          <TabsContent value="planchas" className="mt-4">
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="flex flex-col gap-3 border-b border-border bg-muted/20 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base font-semibold">Inventario de chapas</CardTitle>
                  <div className="relative w-full sm:w-56">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar bulto o material…"
                      value={busquedaPiedra}
                      onChange={(e) => setBusquedaPiedra(e.target.value)}
                      className="h-9 pl-9"
                      aria-label="Filtrar chapas"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="whitespace-nowrap pl-4 text-xs font-semibold">Bulto</TableHead>
                        <TableHead className="min-w-[180px] text-xs font-semibold">Material</TableHead>
                        <TableHead className="text-xs font-semibold">Lote</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Largo</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Ancho</TableHead>
                        <TableHead className="text-right text-xs font-semibold">
                          <span className="inline-flex items-center justify-end gap-1">
                            <Ruler className="h-3 w-3 opacity-70" />
                            m²
                          </span>
                        </TableHead>
                        <TableHead className="pr-4 text-center text-xs font-semibold">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chapasFiltradas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                            {busquedaPiedra.trim()
                              ? `No hay resultados para «${busquedaPiedra}».`
                              : "Sin chapas en inventario. Registrá un ingreso en la pestaña Ingresos."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        chapasFiltradas.map((row) => {
                          const m2 = m2Chapa(row.largoCm, row.anchoCm);
                          const rowReactKey = row.id ?? row.bulto;
                          return (
                            <TableRow key={rowReactKey} className="hover:bg-muted/40">
                              <TableCell className="pl-4 font-mono text-sm font-medium">{row.bulto}</TableCell>
                              <TableCell className="text-sm">
                                <div className="flex flex-col gap-1">
                                  <button
                                    type="button"
                                    className="inline-flex items-start rounded-md font-medium text-foreground underline-offset-4 transition hover:bg-muted/60 hover:text-primary hover:underline text-left max-w-xl"
                                    onClick={() => openDisponibilidad(row.material)}
                                  >
                                    {row.material}
                                  </button>
                                  {row.motivoEstado ? (
                                    <span className="text-[10px] text-muted-foreground">{row.motivoEstado}</span>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs tabular-nums text-muted-foreground">
                                {row.loteCodigo?.trim() || "—"}
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                                {row.largoCm} cm
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                                {row.anchoCm} cm
                              </TableCell>
                              <TableCell className="text-right text-sm font-semibold tabular-nums">{formatM2(m2)}</TableCell>
                              <TableCell className="pr-4 text-center">
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-xs font-medium",
                                    row.estado === "Disponible" &&
                                      "border border-emerald-200 bg-emerald-50 text-emerald-800",
                                    row.estado === "Reservada" &&
                                      "border border-amber-200 bg-amber-50 text-amber-900",
                                    row.estado === "Usada" &&
                                      "border border-border bg-muted text-muted-foreground",
                                    row.estado === "Baja" &&
                                      "border border-red-200 bg-red-50 text-red-800",
                                  )}
                                >
                                  {row.estado}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-start gap-2 border-t border-border bg-muted/25 px-4 py-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    m² teórico por placa (largo × ancho). Tocá el nombre del material para ver el detalle de stock y
                    recortes cargados para ese mismo rubro.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recortes" className="mt-4">
            <RecortesPorMaterialTab materiales={materialesCatalogo} onCommitted={refreshHistorialRelated} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
