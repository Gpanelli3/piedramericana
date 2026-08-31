"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Factory, Mountain, Package, Plus, Truck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStock } from "@/contexts/StockContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchMaterialsForStock, type MaterialOption } from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useCanteraLotes } from "@/features/cantera/useCanteraLotes";
import { CanteraIngresoDialog } from "@/features/cantera/CanteraIngresoDialog";
import { CanteraProcesarDialog } from "@/features/cantera/CanteraProcesarDialog";
import { CanteraLotesYProcesar } from "@/features/cantera/CanteraIngresoTab";

type KpiProps = {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  accent?: "default" | "warn" | "ok";
};

function KpiCard({ label, value, hint, icon, accent = "default" }: KpiProps) {
  return (
    <Card>
      <CardContent className="flex gap-4 p-5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            accent === "warn" && "bg-warning-soft text-warning-strong",
            accent === "ok" && "bg-success-soft text-success-strong",
            accent === "default" && "bg-muted text-foreground/70",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function fmtKg(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " kg";
}

export function VistaCantera() {
  const { user } = useAuth();
  const { chapas } = useStock();
  const [materialesCatalogo, setMaterialesCatalogo] = useState<MaterialOption[]>([]);
  const [catalogBump, setCatalogBump] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [procesarOpen, setProcesarOpen] = useState(false);

  const { lotes, loading, register, reload } = useCanteraLotes(true);

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
  }, [chapas.length, catalogBump]);

  const materialesOpciones = useMemo(() => {
    return materialesCatalogo.length > 0
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
  }, [materialesCatalogo, chapas]);

  const onCatalogStale = useCallback(() => {
    setCatalogBump((n) => n + 1);
  }, []);

  const handleIngresoSuccess = useCallback(() => {
    void reload();
    onCatalogStale();
  }, [reload, onCatalogStale]);

  const handleProcessed = useCallback(() => {
    void reload();
    onCatalogStale();
  }, [reload, onCatalogStale]);

  const totalBruto = useMemo(() => lotes.reduce((s, l) => s + l.qty_kg_initial, 0), [lotes]);
  const totalNeto = useMemo(() => lotes.reduce((s, l) => s + l.qty_kg_remaining, 0), [lotes]);
  const totalProcesado = totalBruto - totalNeto;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="flex flex-col gap-3 px-4 pt-6 pb-2 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:pt-8 sm:pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Stock Cantera
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Materia prima a granel: ingresos, procesamiento y estado de lotes
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <Button variant="accent" className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo ingreso
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setProcesarOpen(true)}>
            <Factory className="h-4 w-4" />
            Procesar
          </Button>
        </div>
      </header>

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        {!isSupabaseConfigured ? (
          <div className="flex items-center gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-strong">
            <Package className="h-4 w-4 shrink-0" />
            Sin Supabase: los datos se acumulan en memoria solo esta sesión.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Bruto ingresado"
            value={loading ? "…" : fmtKg(totalBruto)}
            hint={`${lotes.length} lote(s)`}
            icon={<Truck className="h-5 w-5" aria-hidden />}
          />
          <KpiCard
            label="Procesado"
            value={loading ? "…" : fmtKg(totalProcesado)}
            hint="Consumido en cortes"
            icon={<Factory className="h-5 w-5" aria-hidden />}
            accent={totalProcesado > 0 ? "warn" : "default"}
          />
          <KpiCard
            label="Stock neto"
            value={loading ? "…" : fmtKg(totalNeto)}
            hint="Disponible para procesar"
            icon={<Mountain className="h-5 w-5" aria-hidden />}
            accent={totalNeto > 0 ? "ok" : "default"}
          />
        </div>

        <CanteraLotesYProcesar
          lotes={lotes}
          loading={loading}
        />
      </div>

      <CanteraIngresoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        materiales={materialesOpciones}
        userId={user?.id}
        register={register}
        onSuccess={handleIngresoSuccess}
      />

      <CanteraProcesarDialog
        open={procesarOpen}
        onOpenChange={setProcesarOpen}
        lotes={lotes}
        lotesLoading={loading}
        userId={user?.id}
        onSuccess={handleProcessed}
      />
    </div>
  );
}
