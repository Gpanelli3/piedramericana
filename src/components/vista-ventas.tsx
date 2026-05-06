"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Search, DollarSign, Plus, Save, FileText, Minus, ClipboardList } from "lucide-react";

/** Placeholder labels; sustituir por configuración cuando definan los servicios reales. */
const SERVICIOS_CONTRATADOS_CONFIG = [
  { id: "srv_1", label: "Servicio 1" },
  { id: "srv_2", label: "Servicio 2" },
  { id: "srv_3", label: "Servicio 3" },
  { id: "srv_4", label: "Servicio 4" },
] as const;

/** Mock: tasas hasta conectar lista de precios en backend */
const MOCK_USD_KNIFE_M2 = 700;
const MOCK_USD_ML_POLISH = 105;
const MOCK_USD_TRASFORO = 22;

const TIPOS_COLOCACION = [
  { value: "bajo", label: "Bajo mesada" },
  { value: "sobre", label: "Sobre mesada" },
  { value: "ras", label: "Al ras" },
] as const;

const MODELOS_BACHA = [
  { value: "johnson-ss", label: "Johnson — Acero Premium" },
  { value: "mi-pileta", label: "Mi Pileta — Linea Cocina" },
  { value: "franke", label: "Franke — Orion 70" },
  { value: "rohe", label: "Rohé — Oval 60" },
  { value: "sin", label: "Sin especificar / a definir" },
] as const;

const MATERIALES_MOCK_FALLBACK = [
  { id: "__mock-silestone", name: "Silestone Blanco Norte", unit: "m2" },
  { id: "__mock-granito", name: "Granito Negro Brasil Extra 20mm", unit: "m2" },
  { id: "__mock-cuarcita", name: "Cuarcita Black Taurus", unit: "m2" },
  { id: "__mock-dekton", name: "Dekton TRILIUM 12mm", unit: "m2" },
];

const presupAccordionTrigger =
  "hover:no-underline py-3.5 px-5 bg-white hover:bg-muted/40 rounded-none [&[data-state=open]]:border-b [&[data-state=open]]:border-border shadow-none gap-4 flex flex-1 items-center justify-between text-sm font-semibold text-foreground";

const presupAccordionContent = "border-t border-border bg-white px-5 pb-5 !pt-4";

type FilaEntregaCoord = {
  key: string;
  fechaCoord: string;
  fechaEntrega: string;
  observacion: string;
};

function parseMoneyInput(v: string): number {
  const t = v.trim().replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/** Formato simple para montos grandes en ARS (mock, sin Intl completo por locale server) */
function formatArs(n: number): string {
  try {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(
      Math.round(n)
    );
  } catch {
    return String(Math.round(n));
  }
}

function formatUsd(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type LineaResumenMoneda = {
  id: string;
  label: string;
  monto: string;
  moneda: "usd" | "ars";
};

type PresupuestoResumenInteriorProps = {
  dolarHoy: number;
  cotizacionMixtaActiva: boolean;
  setCotizacionMixtaActiva: (v: boolean) => void;
  lineasResumen: LineaResumenMoneda[];
  setLineaResumen: (id: string, patch: Partial<LineaResumenMoneda>) => void;
  monedaFinal: string;
  setMonedaFinal: (v: string) => void;
  totalUsdEquivalente: number;
  totalArsEquivalente: number;
};

function PresupuestoResumenInterior({
  dolarHoy,
  cotizacionMixtaActiva,
  setCotizacionMixtaActiva,
  lineasResumen,
  setLineaResumen,
  monedaFinal,
  setMonedaFinal,
  totalUsdEquivalente,
  totalArsEquivalente,
}: PresupuestoResumenInteriorProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-row items-start justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="space-y-0.5 pr-2">
          <Label htmlFor="cot-mixta-dialog" className="text-sm font-semibold cursor-pointer">
            Cotización multimoneda
          </Label>
          <p className="text-xs text-muted-foreground leading-snug">
            Activa consejos cortos sobre cómo cargar rubros en distintas monedas.
          </p>
        </div>
        <Switch
          id="cot-mixta-dialog"
          className="shrink-0 mt-0.5"
          checked={cotizacionMixtaActiva}
          onCheckedChange={setCotizacionMixtaActiva}
        />
      </div>

      <div className="space-y-4">
        <p className="text-sm font-semibold text-foreground">Rubros</p>
        {lineasResumen.map((ln) => (
          <div
            key={ln.id}
            className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm space-y-3"
          >
            <p className="text-sm font-semibold text-foreground leading-snug">{ln.label}</p>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Importe
                </Label>
                <Input
                  className="h-11 text-base font-semibold tabular-nums text-right px-3"
                  value={ln.monto}
                  onChange={(e) => setLineaResumen(ln.id, { monto: e.target.value })}
                  inputMode="decimal"
                  placeholder={ln.moneda === "usd" ? "850" : "400000"}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Moneda del rubro
                </Label>
                <Select
                  value={ln.moneda}
                  onValueChange={(v) => setLineaResumen(ln.id, { moneda: v as "usd" | "ars" })}
                >
                  <SelectTrigger className="h-11 w-full text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="min-w-[12rem]">
                    <SelectItem value="usd">Dólares (USD)</SelectItem>
                    <SelectItem value="ars">Pesos argentinos (ARS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cotizacionMixtaActiva && (
        <p className="text-xs text-muted-foreground leading-relaxed rounded-xl border border-sky-200/80 bg-sky-50/90 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30">
          Podés tener la <span className="font-semibold text-foreground">piedra / chapa</span> en USD y{" "}
          <span className="font-semibold text-foreground">mano de obra, perforaciones y fletes</span> en
          pesos; el total inferior unifica todo con{" "}
          <span className="font-semibold">Dólar hoy ({formatUsd(dolarHoy)})</span>.
        </p>
      )}

      <Separator />

      <div className="space-y-2">
        <Label className="text-sm font-semibold">¿Cómo lo ve el cliente?</Label>
        <Select value={monedaFinal} onValueChange={setMonedaFinal}>
          <SelectTrigger className="h-11 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pesos">Total principal en Pesos (ARS)</SelectItem>
            <SelectItem value="dolares">Total principal en Dólares (USD)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Total unificado</p>
        <p className="text-3xl font-extrabold text-primary tracking-tight break-all leading-none">
          {monedaFinal === "pesos"
            ? `$ ${formatArs(totalArsEquivalente)}`
            : `USD ${formatUsd(totalUsdEquivalente)}`}
        </p>
        <p className="text-sm text-muted-foreground">
          Equivalente{" "}
          {monedaFinal === "pesos"
            ? `≈ USD ${formatUsd(totalUsdEquivalente)}`
            : `≈ $ ${formatArs(totalArsEquivalente)} ARS`}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap pt-1">
        <Button
          type="button"
          className="flex-1 min-h-11 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold"
        >
          <Save className="h-4 w-4 mr-2 shrink-0" />
          Guardar presupuesto
        </Button>
        <Button type="button" className="flex-1 min-h-11 text-sm font-medium" variant="outline">
          <FileText className="h-4 w-4 mr-2 shrink-0" />
          Generar PDF
        </Button>
      </div>
    </div>
  );
}

function newFilaEntregaCoord(
  partial?: Partial<Pick<FilaEntregaCoord, "fechaCoord" | "fechaEntrega" | "observacion">>
): FilaEntregaCoord {
  return {
    key: crypto.randomUUID(),
    fechaCoord: partial?.fechaCoord ?? "",
    fechaEntrega: partial?.fechaEntrega ?? "",
    observacion: partial?.observacion ?? "",
  };
}

// ─── Subvista: Nuevo Presupuesto ───────────────────────────────────────────────

function NuevoPresupuesto() {
  const [monedaFinal, setMonedaFinal] = useState("pesos");
  const [materials, setMaterials] = useState<{ id: string; name: string; unit: string }[]>(
    MATERIALES_MOCK_FALLBACK
  );
  const [tecnicos, setTecnicos] = useState<{ id: string; full_name: string | null }[]>([]);
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<Record<string, boolean>>(
    () =>
      SERVICIOS_CONTRATADOS_CONFIG.reduce((acc, s) => {
        acc[s.id] = false;
        return acc;
      }, {} as Record<string, boolean>)
  );
  const [materialId, setMaterialId] = useState<string>(MATERIALES_MOCK_FALLBACK[0]!.id);
  const [tipoColocacion, setTipoColocacion] = useState<(typeof TIPOS_COLOCACION)[number]["value"]>(
    "bajo"
  );
  const [bachaId, setBachaId] = useState<string>(MODELOS_BACHA[0].value);
  const [metrosChapa, setMetrosChapa] = useState("3,5");
  const [metrosLinealesPulido, setMetrosLinealesPulido] = useState("12,4");
  const [cantTrasforos, setCantTrasforos] = useState("2");
  const [cotizacionMixtaActiva, setCotizacionMixtaActiva] = useState(true);
  const [lineasResumen, setLineasResumen] = useState<LineaResumenMoneda[]>([
    { id: "piedra", label: "Piedra / chapa del material", monto: "850", moneda: "usd" },
    { id: "mo", label: "Mano de obra y pulido", monto: "400000", moneda: "ars" },
    { id: "perf", label: "Perforaciones (trasforos)", monto: "118750", moneda: "ars" },
    { id: "flete", label: "Fletes e insumos", monto: "93750", moneda: "ars" },
  ]);

  const [filasEntregaCoord, setFilasEntregaCoord] = useState<FilaEntregaCoord[]>(() => [
    newFilaEntregaCoord({ observacion: "Entregar de 12:00 a 15:00 hs" }),
  ]);
  const [resumenAbierto, setResumenAbierto] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    async function load() {
      const { data: mats, error: matsErr } = await supabase
        .from("materials")
        .select("id,name,unit")
        .order("name");

      if (!cancelled && !matsErr && mats?.length) {
        setMaterials(mats);
        setMaterialId((prev) => {
          if (prev && mats.some((m) => m.id === prev)) return prev;
          return mats[0]?.id ?? "";
        });
      } else if (!cancelled && (matsErr || !mats?.length)) {
        setMaterials(MATERIALES_MOCK_FALLBACK);
        setMaterialId((prev) => prev || MATERIALES_MOCK_FALLBACK[0]!.id);
      }

      const { data: users, error: usersErr } = await supabase
        .from("usuarios")
        .select("id, full_name")
        .order("full_name");

      if (!cancelled && !usersErr && users?.length) {
        setTecnicos(users);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleServicio = (id: string) => {
    setServiciosSeleccionados((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const patchFilaEntrega = (
    key: string,
    partial: Partial<Pick<FilaEntregaCoord, "fechaCoord" | "fechaEntrega" | "observacion">>
  ) => {
    setFilasEntregaCoord((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...partial } : r))
    );
  };

  const addFilaEntregaCoord = () => {
    setFilasEntregaCoord((rows) => [...rows, newFilaEntregaCoord()]);
  };

  const removeUltimaFilaEntregaCoord = () => {
    setFilasEntregaCoord((rows) => (rows.length <= 1 ? rows : rows.slice(0, -1)));
  };

  const setLineaResumen = (id: string, patch: Partial<LineaResumenMoneda>) => {
    setLineasResumen((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const dolarHoy = 1250.5;

  const factorColocacionPulido =
    tipoColocacion === "bajo" ? 1 : tipoColocacion === "sobre" ? 1.06 : 1.12;

  const m2Chapa = parseMoneyInput(metrosChapa);
  const mlPulido = parseMoneyInput(metrosLinealesPulido);
  const nTrasforos = Math.max(0, Math.floor(parseMoneyInput(cantTrasforos)));

  const usdEstimacionChapa = m2Chapa * MOCK_USD_KNIFE_M2;
  const usdEstimacionPulido =
    mlPulido * MOCK_USD_ML_POLISH * factorColocacionPulido;
  const usdEstimacionTrasforos = nTrasforos * MOCK_USD_TRASFORO;
  const usdEstimacionSubtotal =
    usdEstimacionChapa + usdEstimacionPulido + usdEstimacionTrasforos;

  const { totalUsdEquivalente, totalArsEquivalente } = useMemo(() => {
    let sumUsd = 0;
    let sumArs = 0;
    for (const ln of lineasResumen) {
      const v = parseMoneyInput(ln.monto);
      if (ln.moneda === "usd") sumUsd += v;
      else sumArs += v;
    }
    return {
      totalUsdEquivalente: sumUsd + sumArs / dolarHoy,
      totalArsEquivalente: sumArs + sumUsd * dolarHoy,
    };
  }, [lineasResumen, dolarHoy]);

  return (
    <div className="w-full max-w-none space-y-6">
      <div className="w-full rounded-2xl border border-border bg-gradient-to-br from-muted/60 to-muted/20 px-4 py-5 sm:px-6 sm:py-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
            Ingreso de Nuevo Presupuesto
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Cotización día y totales multimoneda disponibles cuando quieras ver el resumen.
          </p>
        </div>
        <div
          className="flex shrink-0 items-center gap-3 rounded-xl border border-primary/20 bg-primary px-5 py-3 shadow-sm lg:max-w-xs w-full lg:w-auto"
          role="status"
          aria-label={`Cotización dólar hoy ${formatUsd(dolarHoy)}`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/15">
            <DollarSign className="h-5 w-5 text-primary-foreground" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-primary-foreground/80">
              Cotización del día
            </p>
            <p className="text-lg font-bold tabular-nums text-primary-foreground leading-tight">
              USD {formatUsd(dolarHoy)}
            </p>
            <p className="text-[10px] text-primary-foreground/70 truncate">
              Para unificar montos USD + ARS
            </p>
          </div>
        </div>
      </div>

      <div className="w-full min-w-0">
        <Accordion
          type="multiple"
          defaultValue={["cliente", "orden-trabajo", "logistica"]}
          className="space-y-4"
        >
            <AccordionItem
              value="cliente"
              className={cn(
                "border-0 rounded-lg border border-border overflow-hidden",
                "border-t-4 border-t-red-500"
              )}
            >
              <AccordionTrigger className={presupAccordionTrigger}>
                Cliente / Profesional
              </AccordionTrigger>
              <AccordionContent className={presupAccordionContent}>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Buscar cliente</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Cliente o profesional..." className="pl-9 h-9 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Contacto</Label>
                    <Input placeholder="Nombre de contacto" className="h-9 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tel. / Coordinación</Label>
                      <Input placeholder="11 1234 5678" className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input type="email" placeholder="email@..." className="h-9 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dirección de Entrega</Label>
                    <Input placeholder="Dirección completa" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observaciones</Label>
                    <Input placeholder="Observaciones — Máx. 300 caracteres" className="h-9 text-sm" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="orden-trabajo"
              className={cn(
                "border-0 rounded-lg border border-border overflow-hidden",
                "border-t-4 border-t-sky-500"
              )}
            >
              <AccordionTrigger className={presupAccordionTrigger}>
                Orden de trabajo
              </AccordionTrigger>
              <AccordionContent className={presupAccordionContent}>
                <div className="space-y-5">
                  <div className="space-y-1">
                    <Label className="text-xs">Título</Label>
                    <Input placeholder="Ej: Mesada cocina principal" className="h-9 text-sm" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Fecha</Label>
                      <Input type="date" className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Técnico</Label>
                      {tecnicos.length === 0 ? (
                        <Input
                          readOnly
                          disabled
                          className="h-9 text-sm"
                          placeholder="Sin técnicos (tabla usuarios)"
                        />
                      ) : (
                        <Select>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Seleccionar técnico..." />
                          </SelectTrigger>
                          <SelectContent>
                            {tecnicos.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.full_name?.trim() || t.id.slice(0, 8)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Fecha de medición</Label>
                      <Input type="date" className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fecha entrega estimada</Label>
                      <Input type="date" className="h-9 text-sm" />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Material · colocación y bacha (taller)
                    </p>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Material (piedra / chapa)</Label>
                        <Select value={materialId} onValueChange={setMaterialId}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Seleccionar material..." />
                          </SelectTrigger>
                          <SelectContent>
                            {materials.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
                                {m.unit ? ` (${m.unit})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          Catálogo desde Supabase (<span className="font-medium">materials</span>).
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Tipo de colocación</Label>
                          <Select
                            value={tipoColocacion}
                            onValueChange={(v) =>
                              setTipoColocacion(v as (typeof TIPOS_COLOCACION)[number]["value"])
                            }
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIPOS_COLOCACION.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Bacha (marca / modelo)</Label>
                          <Select value={bachaId} onValueChange={setBachaId}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Seleccionar…" />
                            </SelectTrigger>
                            <SelectContent>
                              {MODELOS_BACHA.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 rounded-md border border-blue-200/80 bg-blue-50 px-3 py-2 dark:border-blue-900/50 dark:bg-blue-950/40">
                      <span className="font-medium text-blue-900 dark:text-blue-200">
                        Cobro pulido mock:
                      </span>{" "}
                      factor{" "}
                      <span className="font-semibold">{factorColocacionPulido.toFixed(2)}×</span> sobre
                      ml de pulido según colocación. En producción partirá del listado + envío automático al
                      taller con la bacha seleccionada.
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Mediciones · presupuestador
                    </p>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Base del cálculo: m² de chapa, metros lineales de pulido y cantidad de perforaciones (trasforos).
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Superficie chapa (m²)</Label>
                        <Input
                          value={metrosChapa}
                          onChange={(e) => setMetrosChapa(e.target.value)}
                          inputMode="decimal"
                          placeholder="Ej: 3,5"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Pulido (ml)</Label>
                        <Input
                          value={metrosLinealesPulido}
                          onChange={(e) => setMetrosLinealesPulido(e.target.value)}
                          inputMode="decimal"
                          placeholder="Ej: 12,4"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Trasforos (cant.)</Label>
                        <Input
                          value={cantTrasforos}
                          onChange={(e) => setCantTrasforos(e.target.value)}
                          inputMode="numeric"
                          placeholder="0"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground">
                      Vista previa cálculo (mock · sin lista de precios real)
                    </p>
                    <ul className="text-[11px] text-muted-foreground space-y-1">
                      <li>
                        Chapa: {formatUsd(usdEstimacionChapa)} USD{" "}
                        <span className="opacity-75">
                          ({m2Chapa.toLocaleString("es-AR")} m² × {MOCK_USD_KNIFE_M2} USD/m²)
                        </span>
                      </li>
                      <li>
                        Pulido: {formatUsd(usdEstimacionPulido)} USD{" "}
                        <span className="opacity-75">
                          ({mlPulido.toLocaleString("es-AR")} ml × {MOCK_USD_ML_POLISH} USD/ml × factor
                          colocación)
                        </span>
                      </li>
                      <li>
                        Trasforos: {formatUsd(usdEstimacionTrasforos)} USD{" "}
                        <span className="opacity-75">
                          ({nTrasforos} × {MOCK_USD_TRASFORO} USD)
                        </span>
                      </li>
                    </ul>
                    <p className="text-sm font-semibold text-foreground pt-1 border-t border-border">
                      Subtotal técnico: USD {formatUsd(usdEstimacionSubtotal)} · ≈ ${formatArs(usdEstimacionSubtotal * dolarHoy)} ARS
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-xs">Servicios contratados</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {SERVICIOS_CONTRATADOS_CONFIG.map((s) => {
                        const on = serviciosSeleccionados[s.id];
                        return (
                          <Button
                            key={s.id}
                            type="button"
                            variant={on ? "default" : "outline"}
                            size="sm"
                            className="h-9 text-xs font-medium"
                            onClick={() => toggleServicio(s.id)}
                          >
                            {s.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="logistica"
              className={cn(
                "border-0 rounded-lg border border-border overflow-hidden",
                "border-t-4 border-t-amber-500"
              )}
            >
              <AccordionTrigger className={presupAccordionTrigger}>
                Logística
              </AccordionTrigger>
              <AccordionContent className={presupAccordionContent}>
                <div className="space-y-5">
                  <div>
                    <p className="text-xs text-accent font-medium underline-offset-2 hover:underline cursor-pointer mb-3">
                      Registro de coordinación de visita para entregar
                    </p>
                    <div className="overflow-x-auto rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="text-xs whitespace-nowrap min-w-[9rem]">
                              Fecha de coordinación
                            </TableHead>
                            <TableHead className="text-xs whitespace-nowrap min-w-[9rem]">
                              Fecha pactada para entregar
                            </TableHead>
                            <TableHead className="text-xs min-w-[240px]">Observación</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filasEntregaCoord.map((fila) => (
                            <TableRow key={fila.key}>
                              <TableCell className="p-2 align-middle">
                                <Input
                                  type="date"
                                  value={fila.fechaCoord}
                                  onChange={(e) =>
                                    patchFilaEntrega(fila.key, { fechaCoord: e.target.value })
                                  }
                                  className="h-8 text-xs w-36"
                                />
                              </TableCell>
                              <TableCell className="p-2 align-middle">
                                <Input
                                  type="date"
                                  value={fila.fechaEntrega}
                                  onChange={(e) =>
                                    patchFilaEntrega(fila.key, { fechaEntrega: e.target.value })
                                  }
                                  className="h-8 text-xs w-36"
                                />
                              </TableCell>
                              <TableCell className="p-2 align-middle">
                                <Input
                                  value={fila.observacion}
                                  onChange={(e) =>
                                    patchFilaEntrega(fila.key, { observacion: e.target.value })
                                  }
                                  placeholder='Ej.: Entregar de 12:00 a 15:00 hs'
                                  className="h-8 text-xs min-w-[220px]"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 w-8 p-0 bg-sky-500 hover:bg-sky-600 text-white"
                        onClick={addFilaEntregaCoord}
                        aria-label="Agregar fila"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={removeUltimaFilaEntregaCoord}
                        disabled={filasEntregaCoord.length <= 1}
                        aria-label="Quitar última fila"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        Grabar
                      </Button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="text-xs text-accent hover:underline text-left font-medium"
                  >
                    Registro de entregas
                  </button>

                  <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                      className="h-10 text-sm flex-1 bg-background"
                      placeholder="Observaciones del cierre de la Orden de Trabajo"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      Cerrar OT / Conforme
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="mt-10 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 via-accent/5 to-muted/40 p-6 sm:p-8 shadow-sm ring-1 ring-primary/10">
            <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between lg:items-center">
              <div className="text-center lg:text-left space-y-2 max-w-lg">
                <p className="text-base font-semibold text-foreground">
                  ¿Revisamos totales y rubros antes de cerrar?
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Abrí el panel con el desglose multimoneda (USD / ARS), el total unificado con la cotización
                  del día y las acciones Guardar / PDF cuando lo necesites.
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                onClick={() => setResumenAbierto(true)}
                className={cn(
                  "w-full lg:w-auto min-h-12 lg:min-w-[220px] rounded-full px-8 text-base font-semibold shadow-md",
                  "bg-primary hover:bg-primary/92 text-primary-foreground",
                  "transition-transform hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                <ClipboardList className="h-5 w-5 mr-2.5 shrink-0 opacity-95" aria-hidden />
                Ver resumen
              </Button>
            </div>
          </div>

          <Dialog open={resumenAbierto} onOpenChange={setResumenAbierto}>
            <DialogContent
              className="gap-0 p-0 sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden border-border shadow-xl"
              showCloseButton={true}
            >
              <DialogHeader className="border-b border-border bg-muted/30 px-6 py-5 text-left space-y-1.5 shrink-0">
                <DialogTitle className="text-xl font-bold pr-10">Resumen del presupuesto</DialogTitle>
                <DialogDescription className="text-sm leading-snug">
                  Rubros monetarios. El total fusiona todo con{" "}
                  <span className="font-medium text-foreground">Dólar hoy ({formatUsd(dolarHoy)})</span>.
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto px-6 py-6">
                <PresupuestoResumenInterior
                  dolarHoy={dolarHoy}
                  cotizacionMixtaActiva={cotizacionMixtaActiva}
                  setCotizacionMixtaActiva={setCotizacionMixtaActiva}
                  lineasResumen={lineasResumen}
                  setLineaResumen={setLineaResumen}
                  monedaFinal={monedaFinal}
                  setMonedaFinal={setMonedaFinal}
                  totalUsdEquivalente={totalUsdEquivalente}
                  totalArsEquivalente={totalArsEquivalente}
                />
              </div>
              <DialogFooter className="border-t border-border bg-muted/20 px-6 py-4 shrink-0 sm:justify-between">
                <p className="text-[11px] text-muted-foreground text-left mr-auto py-2 sm:py-0">
                  Vista mockup · sin persistencia en backend.
                </p>
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="min-w-[7rem]">
                    Cerrar
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
    </div>
  );
}

// ─── Vista principal ───────────────────────────────────────────────────────────

export function VistaVentas() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border bg-white">
        <div className="px-8 pt-5 pb-5 flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Home &rsaquo; Presupuestos</p>
            <h1 className="text-xl font-bold text-foreground">Presupuestos</h1>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-8">
        <NuevoPresupuesto />
      </main>
    </div>
  );
}
