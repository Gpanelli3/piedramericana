"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Package, History } from "lucide-react";
import { useStock } from "@/contexts/StockContext";
import { useAuth } from "@/contexts/AuthContext";
import { CrearRemitoDialog } from "@/components/stock/CrearRemitoDialog";
import { HistorialRemitosTab } from "@/components/stock/HistorialRemitosTab";
import { RecortesPorMaterialTab } from "@/components/stock/RecortesPorMaterialTab";
import { MaterialesCatalogoTab } from "@/components/stock/MaterialesCatalogoTab";
import { StockMaterialesAgregadosTab } from "@/components/stock/StockMaterialesAgregadosTab";
import { DisponibilidadMaterialSheet } from "@/components/stock/DisponibilidadMaterialSheet";
import {
  fetchMaterialsForStock,
  type MaterialOption,
} from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";

export function VistaStock() {
  const { user } = useAuth();
  const { chapas, setChapas, reloadChapas, slabsLoading } = useStock();
  const [remitoOpen, setRemitoOpen] = useState(false);
  const [disponibilidadOpen, setDisponibilidadOpen] = useState(false);
  const [materialDisponibilidad, setMaterialDisponibilidad] = useState<string | null>(null);
  const [materialesCatalogo, setMaterialesCatalogo] = useState<MaterialOption[]>([]);
  const [historialBump, setHistorialBump] = useState(0);
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [recortesOpen, setRecortesOpen] = useState(false);
  const [tab, setTab] = useState("inventario");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setMaterialesCatalogo([]);
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
    const disponibles = chapas.filter((c) => c.estado === "Disponible");
    const reservadas = chapas.filter((c) => c.estado === "Reservada");
    const m2Disp = disponibles.reduce((s, c) => s + m2Chapa(c.largoCm, c.anchoCm), 0);
    return {
      bultosLibres: disponibles.length,
      bultosReservados: reservadas.length,
      m2Disponibles: m2Disp,
    };
  }, [chapas]);

  const existingBultosLower = useMemo(
    () => new Set(chapas.map((c) => c.bulto.toLowerCase())),
    [chapas],
  );

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Stock
              {slabsLoading ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  Actualizando…
                </span>
              ) : null}
            </h1>
          </div>
          <Button
            type="button"
            className="h-10 shrink-0 gap-1.5"
            onClick={() => setRemitoOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Cargar chapas
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 lg:max-w-2xl">
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Disponibles</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {resumenPiedra.bultosLibres}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">m² libres</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {formatM2(resumenPiedra.m2Disponibles)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Reservadas</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {resumenPiedra.bultosReservados}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 py-5 sm:px-8 sm:py-6">
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

        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="h-auto w-full justify-start gap-1 sm:w-auto">
              <TabsTrigger value="inventario" className="gap-1.5 px-3">
                <Package className="h-4 w-4" />
                Inventario
              </TabsTrigger>
              <TabsTrigger value="historial" className="gap-1.5 px-3">
                <History className="h-4 w-4" />
                Historial
              </TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => setCatalogoOpen(true)}
              >
                Nombres de materiales
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => setRecortesOpen(true)}
              >
                Cargar recorte
              </Button>
            </div>
          </div>

          <TabsContent value="inventario" className="mt-2 space-y-3">
            <StockMaterialesAgregadosTab
              chapas={chapas}
              onOpenMaterial={openDisponibilidad}
            />
          </TabsContent>

          <TabsContent value="historial" className="mt-2">
            <div className="mb-3 flex flex-col gap-2 rounded-lg border border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Historial de remitos. Cada ingreso suma chapas al inventario.
              </p>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 shrink-0"
                onClick={() => setRemitoOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo ingreso
              </Button>
            </div>
            <HistorialRemitosTab reloadToken={historialBump} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={catalogoOpen} onOpenChange={setCatalogoOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nombres de materiales</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2 mb-2">
            Maestro de nombres (Granito Negro, Absolute White, etc.) para usar al cargar remitos y
            presupuestos.
          </p>
          <MaterialesCatalogoTab
            materiales={materialesCatalogo}
            onMaterialCreated={(m) => {
              setMaterialesCatalogo((prev) =>
                [...prev, m].sort((a, b) => a.name.localeCompare(b.name, "es")),
              );
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={recortesOpen} onOpenChange={setRecortesOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cargar recorte</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2 mb-2">
            Retazos sueltos que no son plancha completa.
          </p>
          <RecortesPorMaterialTab
            materiales={materialesCatalogo}
            onCommitted={refreshHistorialRelated}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
