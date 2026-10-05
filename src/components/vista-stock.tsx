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
import { ListasPrecioPanel } from "@/components/articulos/ListasPrecioPanel";
import { useStock } from "@/contexts/StockContext";
import { useAuth } from "@/contexts/AuthContext";
import { CrearRemitoDialog } from "@/components/stock/CrearRemitoDialog";
import { HistorialRemitosTab } from "@/components/stock/HistorialRemitosTab";
import { RecortesPorMaterialTab } from "@/components/stock/RecortesPorMaterialTab";
import { PedazosBloqueadosTab } from "@/components/stock/PedazosBloqueadosTab";
import { MaterialesCatalogoTab } from "@/components/stock/MaterialesCatalogoTab";
import { StockMaterialesAgregadosTab } from "@/components/stock/StockMaterialesAgregadosTab";
import { StockProductosUnidadesTab } from "@/components/stock/StockProductosUnidadesTab";
import { BachasInventarioTab } from "@/components/stock/BachasClientesTab";
import { DisponibilidadMaterialSheet } from "@/components/stock/DisponibilidadMaterialSheet";
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
  const [disponibilidadOpen, setDisponibilidadOpen] = useState(false);
  const [materialDisponibilidad, setMaterialDisponibilidad] = useState<string | null>(null);
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
  const [stockTab, setStockTab] = useState("inventario");

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

  const resumen = useMemo(() => {
    const disponibles = chapas.filter((c) => c.estado === "Disponible");
    const reservadas = chapas.filter((c) => c.estado === "Reservada");
    const materiales = new Set(
      [...disponibles, ...reservadas].map((c) => c.material.trim() || "Sin material"),
    );
    return {
      planchas: disponibles.length,
      reservadas: reservadas.length,
      materiales: materiales.size,
      productos: productosUnidades.length,
    };
  }, [chapas, productosUnidades]);

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

  const openDisponibilidad = (nombre: string) => {
    setMaterialDisponibilidad(nombre);
    setDisponibilidadOpen(true);
  };

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
        r.costoUsdTotal != null ? Math.round(r.costoUsdTotal) : "",
      ]),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`stock_planchas_${stamp}.csv`, csv);
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
            <p className="mt-1 text-sm text-muted-foreground">
              {stockTab === "listas"
                ? "Precios de mármoles, planchas y bachas por lista."
                : stockTab === "bloqueados"
                  ? "Pedazos rotos, fuera de venta, para recortar o reponer."
                : stockTab === "bachas"
                  ? "Bachas propias y del cliente."
                : `${resumen.planchas} disponibles${
                    resumen.reservadas > 0 ? ` · ${resumen.reservadas} reservadas` : ""
                  } · ${resumen.materiales} materiales${
                    resumen.productos > 0
                      ? ` · ${resumen.productos} producto${resumen.productos === 1 ? "" : "s"}`
                      : ""
                  }`}
            </p>
          </div>
          {stockTab === "inventario" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" className="h-10 gap-1.5" onClick={() => setRemitoOpen(true)}>
                <Truck className="h-4 w-4" />
                Ingreso remito
              </Button>
              <Button type="button" variant="outline" className="h-10 gap-1.5" onClick={exportCsv}>
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="h-10 gap-1.5">
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

      <div className="space-y-4 px-4 py-5 sm:px-8 sm:py-6">
        <Tabs value={stockTab} onValueChange={setStockTab} className="gap-5">
          <TabsList>
            <TabsTrigger value="inventario">Inventario</TabsTrigger>
            <TabsTrigger value="bloqueados">Pedazos bloqueados</TabsTrigger>
            <TabsTrigger value="bachas">Bachas</TabsTrigger>
            <TabsTrigger value="listas">Listas de precio</TabsTrigger>
          </TabsList>
          <TabsContent value="inventario" className="space-y-4">
        <StockMaterialesAgregadosTab
          chapas={chapas}
          materiales={materialesCatalogo}
          onOpenMaterial={openDisponibilidad}
        />

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

        <DisponibilidadMaterialSheet
          materialLabel={materialDisponibilidad}
          open={disponibilidadOpen}
          onOpenChange={(o) => {
            setDisponibilidadOpen(o);
            if (!o) setMaterialDisponibilidad(null);
          }}
          chapasLocales={chapas}
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
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => {
                setHistorialOpen(false);
                setRemitoOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
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
