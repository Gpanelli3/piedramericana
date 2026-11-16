"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { fetchSlabsByMaterialLabel, esChapaRetazo, type ChapaRow } from "@/lib/stock-api";
import { LoteSection } from "@/components/stock/LoteSection";

function m2(largoCm: number, anchoCm: number): number {
  return (largoCm / 100) * (anchoCm / 100);
}

type FiltroPlancha = "todas" | "retazos";

type GrupoLote = {
  lote: string;
  placas: ChapaRow[];
  m2Total: number;
  cantidadPiezas: number;
};

export function MaterialFichaPage() {
  const { materialLabel } = useParams<{ materialLabel: string }>();
  const navigate = useNavigate();
  const [slabs, setSlabs] = useState<ChapaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<FiltroPlancha>("todas");
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!materialLabel) return;
    
    const cargarDatos = async () => {
      setLoading(true);
      try {
        const data = await fetchSlabsByMaterialLabel(decodeURIComponent(materialLabel));
        setSlabs(data);
      } catch (error) {
        console.error("Error al cargar placas:", error);
        setSlabs([]);
      } finally {
        setLoading(false);
      }
    };

    void cargarDatos();
  }, [materialLabel]);

  const planchasFiltradas = useMemo(() => {
    if (filtro === "retazos") {
      return slabs.filter(c => esChapaRetazo(c));
    }
    return slabs;
  }, [slabs, filtro]);

  const gruposLote = useMemo((): GrupoLote[] => {
    const grupos = new Map<string, ChapaRow[]>();
    
    planchasFiltradas.forEach(chapa => {
      const lote = chapa.loteCodigo || "Sin lote";
      const grupo = grupos.get(lote) || [];
      grupo.push(chapa);
      grupos.set(lote, grupo);
    });
    
    return Array.from(grupos.entries())
      .map(([lote, placas]) => ({
        lote,
        placas,
        m2Total: placas.reduce((sum, p) => sum + m2(p.largoCm, p.anchoCm), 0),
        cantidadPiezas: placas.length,
      }))
      .sort((a, b) => a.lote.localeCompare(b.lote, "es"));
  }, [planchasFiltradas]);

  const estadisticas = useMemo(() => {
    const enteras = slabs.filter(c => !esChapaRetazo(c)).length;
    const retazos = slabs.filter(c => esChapaRetazo(c)).length;
    const m2Disponibles = slabs
      .filter(c => c.estado === "Disponible")
      .reduce((sum, c) => sum + m2(c.largoCm, c.anchoCm), 0);
    
    // Obtener familia si existe (del primer slab que tenga materialId)
    const familia = slabs.find(s => s.materialId)?.materialId || null;
    
    return { enteras, retazos, m2Disponibles, familia };
  }, [slabs]);

  const cantidadRetazos = slabs.filter(c => esChapaRetazo(c)).length;

  const toggleSeleccionTodas = useCallback(() => {
    if (seleccionadas.size === planchasFiltradas.length) {
      setSeleccionadas(new Set());
    } else {
      setSeleccionadas(new Set(planchasFiltradas.map(p => p.bulto)));
    }
  }, [planchasFiltradas, seleccionadas.size]);

  const toggleSeleccion = useCallback((bulto: string) => {
    setSeleccionadas(prev => {
      const next = new Set(prev);
      if (next.has(bulto)) {
        next.delete(bulto);
      } else {
        next.add(bulto);
      }
      return next;
    });
  }, []);

  if (!materialLabel) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => navigate("/?ws=stock")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ficha del Material
            </p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight text-foreground">
              {decodeURIComponent(materialLabel)}
            </h1>
            {!loading && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {estadisticas.enteras} entera{estadisticas.enteras !== 1 ? "s" : ""} ·{" "}
                {estadisticas.retazos} retazo{estadisticas.retazos !== 1 ? "s" : ""} ·{" "}
                {estadisticas.m2Disponibles.toFixed(2)} m² disponibles
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 py-4 sm:px-5 sm:py-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : slabs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No hay placas en stock para este material.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => navigate("/?ws=stock")}
            >
              Volver al inventario
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={filtro} onValueChange={(v) => setFiltro(v as FiltroPlancha)}>
                <TabsList>
                  <TabsTrigger value="todas">Todas ({slabs.length})</TabsTrigger>
                  <TabsTrigger value="retazos">Solo retazos ({cantidadRetazos})</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={seleccionadas.size === planchasFiltradas.length && planchasFiltradas.length > 0}
                  onCheckedChange={toggleSeleccionTodas}
                />
                <label
                  htmlFor="select-all"
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Seleccionar todas
                </label>
              </div>
            </div>

            <div className="space-y-6">
              {gruposLote.map((grupo) => (
                <LoteSection
                  key={grupo.lote}
                  grupo={grupo}
                  seleccionadas={seleccionadas}
                  onToggleSeleccion={toggleSeleccion}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
