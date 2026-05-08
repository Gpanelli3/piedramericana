"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Info, Search, Layers, Box, Ruler, ClipboardList, PanelRightOpen, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStock } from "@/contexts/StockContext";
import { useAuth } from "@/contexts/AuthContext";
import { CrearRemitoDialog } from "@/components/stock/CrearRemitoDialog";
import { HistorialRemitosTab } from "@/components/stock/HistorialRemitosTab";
import { RecortesPorMaterialTab } from "@/components/stock/RecortesPorMaterialTab";
import { DisponibilidadMaterialSheet } from "@/components/stock/DisponibilidadMaterialSheet";
import {
  fetchMaterialsForStock,
  countScrapsSince,
  type MaterialOption,
} from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";

const retazosData = [
  { id: "Ret-045", material: "Granito Negro Brasil Extra 20mm", medidas: "90 × 60 cm", m2: 0.54, chapaOrigen: "Bulto #8812" },
  { id: "Ret-044", material: "Silestone Blanco Stellar", medidas: "120 × 45 cm", m2: 0.54, chapaOrigen: "Bulto #8860" },
  { id: "Ret-043", material: "Cuarcita Blue Roma", medidas: "75 × 80 cm", m2: 0.6, chapaOrigen: "Bulto #8801" },
  { id: "Ret-042", material: "Dekton TRILIUM 12mm", medidas: "55 × 90 cm", m2: 0.495, chapaOrigen: "Bulto #8792" },
] as const;

export function VistaStock() {
  const { user } = useAuth();
  const { chapas, setChapas, reloadChapas, slabsLoading, useRemoteStock } = useStock();
  const [asignados, setAsignados] = useState<string[]>([]);
  const [retazosOpen, setRetazosOpen] = useState(false);
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

  const toggleAsignar = (id: string) => {
    setAsignados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

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
    const disponibles = chapas.filter((c) => c.estado === "Disponible");
    const m2Disp = disponibles.reduce((s, c) => s + m2Chapa(c.largoCm, c.anchoCm), 0);
    const m2Total = chapas.reduce((s, c) => s + m2Chapa(c.largoCm, c.anchoCm), 0);
    return {
      bultos: chapas.length,
      bultosLibres: disponibles.length,
      m2Disponibles: m2Disp,
      m2EnPlanchas: m2Total,
    };
  }, [chapas]);

  const chapasFiltradas = useMemo(() => {
    const q = busquedaPiedra.trim().toLowerCase();
    if (!q) return chapas;
    return chapas.filter(
      (c) =>
        c.bulto.toLowerCase().includes(q) ||
        c.material.toLowerCase().includes(q) ||
        c.estado.toLowerCase().includes(q),
    );
  }, [chapas, busquedaPiedra]);

  const existingBultosLower = useMemo(() => new Set(chapas.map((c) => c.bulto.toLowerCase())), [chapas]);

  const materialesOpciones =
    materialesCatalogo.length > 0
      ? materialesCatalogo
      : [...new Map(chapas.map((c) => [c.material, { id: c.material, name: c.material, unit: "u." }])).values()];

  const openDisponibilidad = (nombre: string) => {
    setMaterialDisponibilidad(nombre);
    setDisponibilidadOpen(true);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Stock / Depósito</p>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Planchas y recortes
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Ingresá remitos desde proveedor, consultá el historial y registrá recortes. El inventario puede
              persistirse en Supabase cuando está configurado.
              {slabsLoading ? <span className="ml-1 font-medium text-foreground"> Actualizando inventario…</span> : null}
            </p>
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
            <p className="text-[11px] font-medium text-muted-foreground">Retazos depot (lista)</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {retazosData.length}
              <span className="text-sm font-normal text-muted-foreground"> piezas</span>
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
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm border-border bg-muted/40 text-muted-foreground",
          )}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-medium text-foreground">Las chapas reservadas</span> no suman al m² disponible.
            {!useRemoteStock
              ? " Modo demo: configurá Supabase para remitos persistentes."
              : " Los remitos y recortes se guardan en la base cuando completás los formularios."}
          </p>
        </div>

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

        <Tabs defaultValue="piedra" className="gap-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
            <TabsTrigger value="piedra" className="gap-1.5 px-3">
              <Layers className="h-4 w-4" />
              Planchas (piedra)
            </TabsTrigger>
            <TabsTrigger value="remitos-historial" className="gap-1.5 px-3">
              <ClipboardList className="h-4 w-4" />
              Historial remitos
            </TabsTrigger>
            <TabsTrigger value="recortes" className="gap-1.5 px-3">
              <Box className="h-4 w-4" />
              Recortes por material
            </TabsTrigger>
          </TabsList>

          <TabsContent value="piedra" className="mt-4">
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="flex flex-col gap-3 border-b border-border bg-muted/20 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base font-semibold">Inventario de chapas</CardTitle>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 gap-1.5 shrink-0"
                      onClick={() => setRemitoOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Registrar ingreso
                    </Button>
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
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="whitespace-nowrap pl-4 text-xs font-semibold">Bulto</TableHead>
                        <TableHead className="min-w-[200px] text-xs font-semibold">Material</TableHead>
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
                          <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                            No hay resultados para «{busquedaPiedra}».
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
                                  <Badge variant="outline" className="w-fit text-[10px] font-normal">
                                    Chapa entera · ver disponibilidad
                                  </Badge>
                                </div>
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
                                    row.estado === "Disponible"
                                      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                      : "border border-amber-200 bg-amber-50 text-amber-900",
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

          <TabsContent value="remitos-historial" className="mt-4">
            <HistorialRemitosTab reloadToken={historialBump} />
          </TabsContent>

          <TabsContent value="recortes" className="mt-4">
            <RecortesPorMaterialTab materiales={materialesCatalogo} onCommitted={refreshHistorialRelated} />
          </TabsContent>
        </Tabs>

        <Card className="border-2 border-dashed border-muted-foreground/25 bg-muted/20 shadow-none">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                <Box className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Depósito de retazos (referencia rápida)</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Listado inspiracional/demo. Para ingresos reales usa la pestaña{" "}
                  <span className="font-medium text-foreground">Recortes por material</span>.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-10 shrink-0 gap-2 border border-border bg-background shadow-sm sm:self-center"
              onClick={() => setRetazosOpen(true)}
            >
              <PanelRightOpen className="h-4 w-4" />
              Abrir depósito de retazos
              <Badge variant="secondary" className="ml-1 rounded-sm px-1.5 font-mono text-[11px]">
                {retazosData.length}
              </Badge>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Sheet open={retazosOpen} onOpenChange={setRetazosOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader className="shrink-0 text-left">
            <SheetTitle>Depósito de retazos</SheetTitle>
            <SheetDescription>Listado demo. Los ingresos con trazabilidad van en Supabase desde la pestaña de recortes.</SheetDescription>
          </SheetHeader>
          <Separator />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ul className="space-y-3 pr-1">
              {retazosData.map((row) => (
                <li key={row.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-sm font-semibold text-foreground">{row.id}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px] tabular-nums">
                      ~{formatM2(row.m2)} m²
                    </Badge>
                  </div>
                  <button
                    type="button"
                    className="mt-1 text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => openDisponibilidad(row.material)}
                  >
                    {row.material}
                  </button>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{row.medidas}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{row.chapaOrigen}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant={asignados.includes(row.id) ? "secondary" : "outline"}
                    className="mt-3 h-8 w-full text-xs"
                    onClick={() => toggleAsignar(row.id)}
                  >
                    {asignados.includes(row.id) ? "Asignado (mock)" : "Asignar a OT"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
