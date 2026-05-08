"use client";

import { useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Package,
  Layers,
  Info,
  Search,
  Box,
  Ruler,
  Puzzle,
  PanelRightOpen,
  Plus,
  Container,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStock, type ChapaRow } from "@/contexts/StockContext";

const MATERIALES_SUGERIDOS = [
  "Granito Negro Brasil Extra 20mm",
  "Silestone Blanco Stellar",
  "Cuarcita Blue Roma",
  "Dekton TRILIUM 12mm",
  "Granito Black Cosmic Leather 20mm",
  "Granito Negro Boreal Leather 20mm",
] as const;

const retazosData = [
  {
    id: "Ret-045",
    material: "Granito Negro Brasil Extra 20mm",
    medidas: "90 × 60 cm",
    m2: 0.54,
    chapaOrigen: "Bulto #8812",
  },
  {
    id: "Ret-044",
    material: "Silestone Blanco Stellar",
    medidas: "120 × 45 cm",
    m2: 0.54,
    chapaOrigen: "Bulto #8860",
  },
  {
    id: "Ret-043",
    material: "Cuarcita Blue Roma",
    medidas: "75 × 80 cm",
    m2: 0.6,
    chapaOrigen: "Bulto #8801",
  },
  {
    id: "Ret-042",
    material: "Dekton TRILIUM 12mm",
    medidas: "55 × 90 cm",
    m2: 0.495,
    chapaOrigen: "Bulto #8792",
  },
] as const;

type OtroMaterial = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  stock: number;
  minimo: number;
};

const otrosMateriales: OtroMaterial[] = [
  {
    id: "o1",
    nombre: "Adhesivo poliuretano (mesadas)",
    categoria: "Química",
    unidad: "tubo",
    stock: 42,
    minimo: 10,
  },
  {
    id: "o2",
    nombre: "Disco diamantado 125 mm",
    categoria: "Herramientas",
    unidad: "u.",
    stock: 18,
    minimo: 8,
  },
  {
    id: "o3",
    nombre: "Silicona neutra",
    categoria: "Química",
    unidad: "cartucho",
    stock: 55,
    minimo: 15,
  },
  {
    id: "o4",
    nombre: "Masilla epoxi color",
    categoria: "Química",
    unidad: "kg",
    stock: 4,
    minimo: 6,
  },
  {
    id: "o5",
    nombre: "Guías y tacos niveladores",
    categoria: "Colocación",
    unidad: "caja",
    stock: 12,
    minimo: 4,
  },
];

function m2Chapa(largoCm: number, anchoCm: number): number {
  return (largoCm / 100) * (anchoCm / 100);
}

function formatM2(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizarBulto(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const sinHash = t.startsWith("#") ? t.slice(1).trim() : t;
  if (!sinHash) return "";
  return `#${sinHash}`;
}

function materialDesdeSelector(valorSelect: string, otroTexto: string): string {
  if (valorSelect === "__otro__") return otroTexto.trim();
  return valorSelect;
}

const MAX_LOTE_CONTENEDOR = 120;

export function VistaStock() {
  const { chapas, setChapas } = useStock();
  const [asignados, setAsignados] = useState<string[]>([]);
  const [retazosOpen, setRetazosOpen] = useState(false);
  const [busquedaPiedra, setBusquedaPiedra] = useState("");
  const [busquedaInsumo, setBusquedaInsumo] = useState("");

  const [registroOpen, setRegistroOpen] = useState(false);
  const [registroTab, setRegistroTab] = useState<"una" | "lote">("una");
  const [registroError, setRegistroError] = useState<string | null>(null);

  const [sBulto, setSBulto] = useState("");
  const [sMaterial, setSMaterial] = useState<string>(MATERIALES_SUGERIDOS[0]);
  const [sMaterialOtro, setSMaterialOtro] = useState("");
  const [sLargo, setSLargo] = useState("");
  const [sAncho, setSAncho] = useState("");
  const [sEstado, setSEstado] = useState<"Disponible" | "Reservada">("Disponible");

  const [lMaterial, setLMaterial] = useState<string>(MATERIALES_SUGERIDOS[0]);
  const [lMaterialOtro, setLMaterialOtro] = useState("");
  const [lNumInicio, setLNumInicio] = useState("");
  const [lCantidad, setLCantidad] = useState("6");
  const [lLargo, setLLargo] = useState("320");
  const [lAncho, setLAncho] = useState("160");
  const [lEstado, setLEstado] = useState<"Disponible" | "Reservada">("Disponible");

  const resetRegistroForms = () => {
    setRegistroError(null);
    setRegistroTab("una");
    setSBulto("");
    setSMaterial(MATERIALES_SUGERIDOS[0]);
    setSMaterialOtro("");
    setSLargo("");
    setSAncho("");
    setSEstado("Disponible");
    setLMaterial(MATERIALES_SUGERIDOS[0]);
    setLMaterialOtro("");
    setLNumInicio("");
    setLCantidad("6");
    setLLargo("320");
    setLAncho("160");
    setLEstado("Disponible");
  };

  const setRegistroOpenTracked = (open: boolean) => {
    setRegistroOpen(open);
    if (!open) resetRegistroForms();
  };

  const bultosExistentes = useMemo(() => new Set(chapas.map((c) => c.bulto.toLowerCase())), [chapas]);

  const toggleAsignar = (id: string) => {
    setAsignados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

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

  const insumosBajoMin = useMemo(
    () => otrosMateriales.filter((m) => m.stock <= m.minimo).length,
    []
  );

  const chapasFiltradas = useMemo(() => {
    const q = busquedaPiedra.trim().toLowerCase();
    if (!q) return chapas;
    return chapas.filter(
      (c) =>
        c.bulto.toLowerCase().includes(q) ||
        c.material.toLowerCase().includes(q) ||
        c.estado.toLowerCase().includes(q)
    );
  }, [chapas, busquedaPiedra]);

  const registrarUnaChapa = () => {
    setRegistroError(null);
    const bulto = normalizarBulto(sBulto);
    if (!bulto) {
      setRegistroError("Indicá el número de bulto.");
      return;
    }
    const material = materialDesdeSelector(sMaterial, sMaterialOtro);
    if (!material) {
      setRegistroError("Indicá el material o elegí «Otro…» y escribí el nombre.");
      return;
    }
    const largo = Number(sLargo.replace(",", "."));
    const ancho = Number(sAncho.replace(",", "."));
    if (!Number.isFinite(largo) || largo <= 0 || !Number.isFinite(ancho) || ancho <= 0) {
      setRegistroError("Largo y ancho deben ser números mayores a 0 (cm).");
      return;
    }
    if (bultosExistentes.has(bulto.toLowerCase())) {
      setRegistroError(`El bulto ${bulto} ya está en el inventario.`);
      return;
    }
    const nueva: ChapaRow = {
      bulto,
      material,
      largoCm: largo,
      anchoCm: ancho,
      estado: sEstado,
    };
    setChapas((prev) => [...prev, nueva]);
    setRegistroOpenTracked(false);
  };

  const registrarLoteContenedor = () => {
    setRegistroError(null);
    const material = materialDesdeSelector(lMaterial, lMaterialOtro);
    if (!material) {
      setRegistroError("Indicá el material del contenedor.");
      return;
    }
    const inicioRaw = lNumInicio.trim().replace(/^#/, "");
    if (!inicioRaw || !/^\d+$/.test(inicioRaw)) {
      setRegistroError("N° inicial: solo dígitos (ej. 9001). Se numerarán #9001, #9002…");
      return;
    }
    const cant = parseInt(lCantidad.replace(/\s/g, ""), 10);
    if (!Number.isFinite(cant) || cant < 1) {
      setRegistroError("Cantidad de placas debe ser al menos 1.");
      return;
    }
    if (cant > MAX_LOTE_CONTENEDOR) {
      setRegistroError(`En un solo paso podés cargar hasta ${MAX_LOTE_CONTENEDOR} placas. Dividí el contenedor.`);
      return;
    }
    const largo = Number(lLargo.replace(",", "."));
    const ancho = Number(lAncho.replace(",", "."));
    if (!Number.isFinite(largo) || largo <= 0 || !Number.isFinite(ancho) || ancho <= 0) {
      setRegistroError("Largo y ancho comunes inválidos (cm).");
      return;
    }
    const numInicio = parseInt(inicioRaw, 10);
    const nuevas: ChapaRow[] = [];
    const conflictos: string[] = [];
    for (let i = 0; i < cant; i++) {
      const bulto = `#${numInicio + i}`;
      if (bultosExistentes.has(bulto.toLowerCase()) || nuevas.some((n) => n.bulto === bulto)) {
        conflictos.push(bulto);
        continue;
      }
      nuevas.push({
        bulto,
        material,
        largoCm: largo,
        anchoCm: ancho,
        estado: lEstado,
      });
    }
    if (conflictos.length > 0) {
      const muestra = conflictos.slice(0, 5).join(", ");
      setRegistroError(
        `Ya existen bultos: ${muestra}${conflictos.length > 5 ? "…" : ""}. Cambiá el n° inicial o limpiá duplicados.`
      );
      return;
    }
    if (nuevas.length === 0) {
      setRegistroError("No se generó ninguna chapa nueva.");
      return;
    }
    setChapas((prev) => [...prev, ...nuevas]);
    setRegistroOpenTracked(false);
  };

  const insumosFiltrados = useMemo(() => {
    const q = busquedaInsumo.trim().toLowerCase();
    if (!q) return otrosMateriales;
    return otrosMateriales.filter(
      (m) =>
        m.nombre.toLowerCase().includes(q) ||
        m.categoria.toLowerCase().includes(q)
    );
  }, [busquedaInsumo]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Stock / Depósito</p>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Planchas, retazos e insumos
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Piedra en m² por bulto; insumos por unidad. Los retazos reutilizables se consultan al final con el
              botón dedicado.
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
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {formatM2(resumenPiedra.m2Disponibles)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Retazos en depósito</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {retazosData.length}{" "}
              <span className="text-sm font-normal text-muted-foreground">piezas</span>
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Insumos alerta</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {insumosBajoMin}
              <span className="text-sm font-normal text-muted-foreground"> bajo mín.</span>
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm",
            insumosBajoMin > 0
              ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
              : "border-border bg-muted/40 text-muted-foreground"
          )}
        >
          <AlertTriangle
            className={cn("mt-0.5 h-4 w-4 shrink-0", insumosBajoMin > 0 && "text-amber-600")}
          />
          <p>
            {insumosBajoMin > 0 ? (
              <>
                <span className="font-semibold text-foreground">Revisá insumos:</span> hay{" "}
                {insumosBajoMin} ítem
                {insumosBajoMin !== 1 ? "s" : ""} en o bajo el stock mínimo (pestaña Insumos).
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">Sin alertas críticas</span> en insumos
                (mock). Las chapas reservadas no suman al m² &quot;disponible&quot;.
              </>
            )}
          </p>
        </div>

        <Tabs defaultValue="piedra" className="gap-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
            <TabsTrigger value="piedra" className="gap-1.5 px-3">
              <Layers className="h-4 w-4" />
              Planchas (piedra)
            </TabsTrigger>
            <TabsTrigger value="insumos" className="gap-1.5 px-3">
              <Box className="h-4 w-4" />
              Otros materiales
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
                      onClick={() => setRegistroOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Registrar ingreso
                    </Button>
                    <div className="relative w-full sm:w-56">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                        <TableHead className="whitespace-nowrap pl-4 text-xs font-semibold">
                          Bulto
                        </TableHead>
                        <TableHead className="min-w-[200px] text-xs font-semibold">
                          Material
                        </TableHead>
                        <TableHead className="text-right text-xs font-semibold">Largo</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Ancho</TableHead>
                        <TableHead className="text-right text-xs font-semibold">
                          <span className="inline-flex items-center justify-end gap-1">
                            <Ruler className="h-3 w-3 opacity-70" />
                            m²
                          </span>
                        </TableHead>
                        <TableHead className="pr-4 text-center text-xs font-semibold">
                          Estado
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chapasFiltradas.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-10 text-center text-sm text-muted-foreground"
                          >
                            No hay resultados para «{busquedaPiedra}».
                          </TableCell>
                        </TableRow>
                      ) : (
                        chapasFiltradas.map((row) => {
                          const m2 = m2Chapa(row.largoCm, row.anchoCm);
                          return (
                            <TableRow key={row.bulto} className="hover:bg-muted/40">
                              <TableCell className="pl-4 font-mono text-sm font-medium">
                                {row.bulto}
                              </TableCell>
                              <TableCell className="text-sm">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-foreground">{row.material}</span>
                                  <Badge variant="outline" className="w-fit text-[10px] font-normal">
                                    Chapa entera
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                                {row.largoCm} cm
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                                {row.anchoCm} cm
                              </TableCell>
                              <TableCell className="text-right text-sm font-semibold tabular-nums">
                                {formatM2(m2)}
                              </TableCell>
                              <TableCell className="pr-4 text-center">
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-xs font-medium",
                                    row.estado === "Disponible"
                                      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                      : "border border-amber-200 bg-amber-50 text-amber-900"
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
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    m² teórico por placa (largo × ancho). Reservado: asignado a OT aún no cortada. La trazabilidad
                    con producción será por integración.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insumos" className="mt-4">
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="flex flex-col gap-3 border-b border-border bg-muted/20 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Insumos y consumibles</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Química, herramientas y colocación — sin m², por unidad de compra.
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nombre o categoría…"
                    value={busquedaInsumo}
                    onChange={(e) => setBusquedaInsumo(e.target.value)}
                    className="h-9 pl-9"
                    aria-label="Filtrar insumos"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="pl-4 text-xs font-semibold">Material</TableHead>
                        <TableHead className="text-xs font-semibold">Categoría</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Stock</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Mín.</TableHead>
                        <TableHead className="pr-4 text-xs font-semibold">Unidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {insumosFiltrados.map((m) => {
                        const critico = m.stock <= m.minimo;
                        return (
                          <TableRow key={m.id} className="hover:bg-muted/40">
                            <TableCell className="pl-4">
                              <div className="flex items-center gap-2">
                                <Puzzle className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground">{m.nombre}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{m.categoria}</TableCell>
                            <TableCell className="text-right">
                              <span
                                className={cn(
                                  "text-sm font-semibold tabular-nums",
                                  critico && "text-destructive"
                                )}
                              >
                                {m.stock}
                              </span>
                              {critico ? (
                                <Badge
                                  variant="outline"
                                  className="ml-2 border-destructive/40 bg-destructive/10 text-[10px] text-destructive"
                                >
                                  Pedir
                                </Badge>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                              {m.minimo}
                            </TableCell>
                            <TableCell className="pr-4 text-sm text-muted-foreground">{m.unidad}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="border-dashed border-2 border-muted-foreground/25 bg-muted/20 shadow-none">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                <Package className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Retazos utilizables</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Piezas menores homologadas para reprocesos o mesadas chicas. Asignálos a una OT desde el panel.
                  Total aprox.{" "}
                  <span className="font-medium text-foreground">
                    {formatM2(retazosData.reduce((s, r) => s + r.m2, 0))} m²
                  </span>
                  .
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

      <Dialog open={registroOpen} onOpenChange={setRegistroOpenTracked}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Container className="h-5 w-5 shrink-0 text-muted-foreground" />
              Ingreso de chapas al stock
            </DialogTitle>
            <DialogDescription>
              Una placa suelta o un lote con el mismo material y medidas (típico de contenedor). Los bultos no
              pueden repetirse.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={registroTab}
            onValueChange={(v) => {
              setRegistroError(null);
              setRegistroTab(v as "una" | "lote");
            }}
            className="gap-3"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="una" className="gap-1.5 text-xs sm:text-sm">
                <Plus className="h-3.5 w-3.5" />
                Una chapa
              </TabsTrigger>
              <TabsTrigger value="lote" className="gap-1.5 text-xs sm:text-sm">
                <Package className="h-3.5 w-3.5" />
                Lote / contenedor
              </TabsTrigger>
            </TabsList>

            <TabsContent value="una" className="mt-0 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="reg-bulto">N° bulto</Label>
                  <Input
                    id="reg-bulto"
                    placeholder="ej. 9012 o #9012"
                    value={sBulto}
                    onChange={(e) => setSBulto(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Material</Label>
                  <Select value={sMaterial} onValueChange={setSMaterial}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIALES_SUGERIDOS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                      <SelectItem value="__otro__">Otro…</SelectItem>
                    </SelectContent>
                  </Select>
                  {sMaterial === "__otro__" ? (
                    <Input
                      className="mt-2"
                      placeholder="Nombre del material"
                      value={sMaterialOtro}
                      onChange={(e) => setSMaterialOtro(e.target.value)}
                    />
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-largo">Largo (cm)</Label>
                  <Input
                    id="reg-largo"
                    inputMode="decimal"
                    placeholder="320"
                    value={sLargo}
                    onChange={(e) => setSLargo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-ancho">Ancho (cm)</Label>
                  <Input
                    id="reg-ancho"
                    inputMode="decimal"
                    placeholder="160"
                    value={sAncho}
                    onChange={(e) => setSAncho(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Estado inicial</Label>
                  <Select value={sEstado} onValueChange={(v) => setSEstado(v as "Disponible" | "Reservada")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Disponible">Disponible</SelectItem>
                      <SelectItem value="Reservada">Reservada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="lote" className="mt-0 space-y-3">
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Mismo material y mismas medidas para todas. Numeración seguida: si el primer bulto es{" "}
                <span className="font-mono text-foreground">9001</span> y la cantidad es{" "}
                <span className="font-mono text-foreground">8</span>, se crean{" "}
                <span className="font-mono text-foreground">#9001 … #9008</span>. Máximo {MAX_LOTE_CONTENEDOR}{" "}
                placas por carga.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Material del contenedor</Label>
                  <Select value={lMaterial} onValueChange={setLMaterial}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIALES_SUGERIDOS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                      <SelectItem value="__otro__">Otro…</SelectItem>
                    </SelectContent>
                  </Select>
                  {lMaterial === "__otro__" ? (
                    <Input
                      className="mt-2"
                      placeholder="Nombre del material"
                      value={lMaterialOtro}
                      onChange={(e) => setLMaterialOtro(e.target.value)}
                    />
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lote-desde">N° primer bulto</Label>
                  <Input
                    id="lote-desde"
                    inputMode="numeric"
                    placeholder="9001"
                    value={lNumInicio}
                    onChange={(e) => setLNumInicio(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lote-cant">Cantidad de placas</Label>
                  <Input
                    id="lote-cant"
                    inputMode="numeric"
                    placeholder="12"
                    value={lCantidad}
                    onChange={(e) => setLCantidad(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lote-largo">Largo común (cm)</Label>
                  <Input
                    id="lote-largo"
                    inputMode="decimal"
                    value={lLargo}
                    onChange={(e) => setLLargo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lote-ancho">Ancho común (cm)</Label>
                  <Input
                    id="lote-ancho"
                    inputMode="decimal"
                    value={lAncho}
                    onChange={(e) => setLAncho(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Estado inicial (todas)</Label>
                  <Select value={lEstado} onValueChange={(v) => setLEstado(v as "Disponible" | "Reservada")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Disponible">Disponible</SelectItem>
                      <SelectItem value="Reservada">Reservada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {registroError ? (
            <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{registroError}</p>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setRegistroOpenTracked(false)}>
              Cancelar
            </Button>
            {registroTab === "una" ? (
              <Button type="button" onClick={registrarUnaChapa}>
                Agregar chapa
              </Button>
            ) : (
              <Button type="button" onClick={registrarLoteContenedor}>
                Cargar lote
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={retazosOpen} onOpenChange={setRetazosOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader className="shrink-0 text-left">
            <SheetTitle>Depósito de retazos</SheetTitle>
            <SheetDescription>
              Listado de piezas reutilizables. «Asignar a OT» es mock para la trazabilidad con producción.
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ul className="space-y-3 pr-1">
              {retazosData.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-border bg-card p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-sm font-semibold text-foreground">{row.id}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px] tabular-nums">
                      ~{formatM2(row.m2)} m²
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{row.material}</p>
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
          <div className="shrink-0 border-t border-border bg-muted/20 p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                El desperdicio irrecuperable se descuenta al cerrar la OT. Los retazos homologados bajan de este
                listado cuando se imputen a un trabajo.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}