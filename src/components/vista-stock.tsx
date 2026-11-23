"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Download, History, Plus, Truck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArticulosCatalogo } from "@/components/articulos/ArticulosCatalogo";
import { ListasPrecioPanel } from "@/components/articulos/ListasPrecioPanel";
import { useStock } from "@/contexts/StockContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { stockTabDesdeParam } from "@/types/workspace";
import { CrearRemitoDialog } from "@/components/stock/CrearRemitoDialog";
import { HistorialRemitosTab } from "@/components/stock/HistorialRemitosTab";
import { RecortesPorMaterialTab } from "@/components/stock/RecortesPorMaterialTab";
import { PedazosBloqueadosTab } from "@/components/stock/PedazosBloqueadosTab";
import { MaterialesCatalogoTab } from "@/components/stock/MaterialesCatalogoTab";
import { StockMaterialesAgregadosTab } from "@/components/stock/StockMaterialesAgregadosTab";
import { StockProductosUnidadesTab } from "@/components/stock/StockProductosUnidadesTab";
import { BachasInventarioTab } from "@/components/stock/BachasClientesTab";
import { DisponibilidadProductoSheet } from "@/components/stock/DisponibilidadProductoSheet";
import {
  aggregateChapasPorMaterial,
  fetchMaterialsForStock,
  type MaterialOption,
} from "@/lib/stock-api";
import {
  listStockProductosUnidades,
  type StockProductoUnidad,
} from "@/lib/stock-unidades-api";
import { downloadCsv, rowsToCsv } from "@/lib/export-csv";
import { isSupabaseConfigured } from "@/lib/supabase";

export function VistaStock() {
  const { user } = useAuth();
  const { chapas, setChapas, reloadChapas, slabsLoading } = useStock();
  const [remitoOpen, setRemitoOpen] = useState(false);
  const [materialesCatalogo, setMaterialesCatalogo] = useState<MaterialOption[]>([]);
  const [productosUnidades, setProductosUnidades] = useState<StockProductoUnidad[]>([]);
  const [productosLoading, setProductosLoading] = useState(false);
  const [productosError, setProductosError] = useState<string | null>(null);
  const [historialBump, setHistorialBump] = useState(0);
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [recortesOpen, setRecortesOpen] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [productoDetalle, setProductoDetalle] = useState<StockProductoUnidad | null>(null);
  const [productoOpen, setProductoOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const stockTab =
    searchParams.get("ws") === "articulos"
      ? "trabajos"
      : stockTabDesdeParam(searchParams.get("st"));

  const setStockTab = useCallback(
    (value: string) => {
      const next = stockTabDesdeParam(value);
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (next === "placas") n.delete("st");
          else n.set("st", next);
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const reloadMateriales = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setMaterialesCatalogo([]);
      return;
    }
    try {
      setMaterialesCatalogo(await fetchMaterialsForStock());
    } catch {
      setMaterialesCatalogo([]);
    }
  }, []);

  const reloadProductos = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setProductosUnidades([]);
      setProductosError(null);
      return;
    }
    setProductosLoading(true);
    const { data, error } = await listStockProductosUnidades();
    setProductosLoading(false);
    if (error) {
      setProductosError(error.message);
      setProductosUnidades([]);
      return;
    }
    setProductosError(null);
    setProductosUnidades(data);
  }, []);

  useEffect(() => {
    void reloadChapas();
  }, [reloadChapas]);

  useEffect(() => {
    void reloadMateriales();
  }, [reloadMateriales, chapas.length, historialBump]);

  useEffect(() => {
    void reloadProductos();
  }, [reloadProductos, historialBump]);

  const refreshHistorialRelated = useCallback(() => {
    setHistorialBump((n) => n + 1);
  }, []);

  const reloadRemitosHistoria = useCallback(async () => {
    refreshHistorialRelated();
  }, [refreshHistorialRelated]);

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
                familia: null,
                codigo: null,
                costo_usd: null,
                espesor_mm: null,
              } satisfies MaterialOption,
            ]),
          ).values(),
        ];

  const exportCsv = () => {
    const rows = aggregateChapasPorMaterial(chapas, materialesCatalogo);
    const csv = rowsToCsv(
      [
        "Material",
        "Familia",
        "Código",
        "Disp.",
        "Reservadas",
        "M2 disp.",
        "M2 res.",
        "M2 retazo",
        "Retazos",
        "Sobrante previsto m2",
        "Costo USD",
      ],
      rows.map((r) => [
        r.materialLabel,
        r.familia ?? "",
        r.codigo ?? "",
        r.planchasDisponibles,
        r.planchasReservadas,
        r.m2Disponibles.toFixed(2),
        r.m2Reservados > 0 ? r.m2Reservados.toFixed(2) : "",
        r.m2Retazo > 0 ? r.m2Retazo.toFixed(2) : "",
        r.retazosCount > 0 ? r.retazosCount : "",
        r.m2SobrantePrevisto > 0 ? r.m2SobrantePrevisto.toFixed(2) : "",
        r.costoUsdTotal != null ? Math.round(r.costoUsdTotal) : "",
      ]),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`stock_planchas_${stamp}.csv`, csv);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-card px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl" data-guia="modulo-titulo">
              Stock
              {slabsLoading ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  Actualizando…
                </span>
              ) : null}
            </h1>
          </div>
          {stockTab === "placas" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" className="h-9 gap-1.5" onClick={() => setRemitoOpen(true)} data-guia="accion-principal">
                <Truck className="h-4 w-4" />
                Ingreso remito
              </Button>
              <Button type="button" variant="outline" className="h-10 gap-1.5" onClick={exportCsv} data-guia="stock-exportar">
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="h-10 gap-1.5" data-guia="stock-mas">
                    Más
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setHistorialOpen(true)}>
                    Historial de remitos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCatalogoOpen(true)}>
                    Nombres de materiales
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRecortesOpen(true)}>
                    Cargar recorte
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </header>

      <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
        <Tabs value={stockTab} onValueChange={setStockTab} className="gap-5">
          <TabsList data-guia="pestanas">
            <TabsTrigger value="placas">Placas</TabsTrigger>
            <TabsTrigger value="productos">Productos</TabsTrigger>
            <TabsTrigger value="bloqueados">Pedazos bloqueados</TabsTrigger>
            <TabsTrigger value="bachas">Bachas</TabsTrigger>
            <TabsTrigger value="listas">Listas de precio</TabsTrigger>
            <TabsTrigger value="trabajos">Trabajos</TabsTrigger>
          </TabsList>
          <TabsContent value="placas" className="space-y-4">
            <StockMaterialesAgregadosTab
              chapas={chapas}
              materiales={materialesCatalogo}
            />
          </TabsContent>
          <TabsContent value="productos">
            <StockProductosUnidadesTab
              productos={productosUnidades}
              loading={productosLoading}
              error={productosError}
              onOpenProducto={(p) => {
                setProductoDetalle(p);
                setProductoOpen(true);
              }}
            />
          </TabsContent>
          <TabsContent value="bloqueados">
            <PedazosBloqueadosTab />
          </TabsContent>
          <TabsContent value="bachas">
            <BachasInventarioTab />
          </TabsContent>
          <TabsContent value="listas">
            <ListasPrecioPanel />
          </TabsContent>
          <TabsContent value="trabajos">
            <ArticulosCatalogo />
          </TabsContent>
        </Tabs>

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

        <DisponibilidadProductoSheet
          producto={productoDetalle}
          open={productoOpen}
          onOpenChange={(o) => {
            setProductoOpen(o);
            if (!o) setProductoDetalle(null);
          }}
        />
      </div>

      <Dialog open={historialOpen} onOpenChange={setHistorialOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial de remitos
            </DialogTitle>
          </DialogHeader>
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              className="h-9 gap-1.5"
              onClick={() => {
                setHistorialOpen(false);
                setRemitoOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nuevo ingreso
            </Button>
          </div>
          <HistorialRemitosTab reloadToken={historialBump} />
        </DialogContent>
      </Dialog>

      <Dialog open={catalogoOpen} onOpenChange={setCatalogoOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nombres de materiales</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2 mb-2">
            Maestro de nombres para usar al cargar remitos y presupuestos.
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cargar recorte</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2 mb-2">
            Entra como chapa Disponible con largo × ancho. Queda usable en stock y en OTs.
          </p>
          <RecortesPorMaterialTab
            materiales={materialesCatalogo}
            onCommitted={async () => {
              await reloadChapas();
              refreshHistorialRelated();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
