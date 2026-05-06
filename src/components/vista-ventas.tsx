"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Search,
  DollarSign,
  Plus,
  Save,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Printer,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type SubTab = "nuevo" | "listado";

type EstadoPresupuesto =
  | "Borrador"
  | "Pendiente de Aprobación"
  | "Aprobado"
  | "Cancelado";

interface Presupuesto {
  id: string;
  version: string;
  fecha: string;
  cliente: string;
  vendedor: string;
  material: string;
  totalUSD: number;
  seña: number;
  estado: EstadoPresupuesto;
  ots: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const PRESUPUESTOS: Presupuesto[] = [
  {
    id: "7243",
    version: "v.3",
    fecha: "2025-05-01",
    cliente: "Arq. Cecilia Fontana",
    vendedor: "tgorosito",
    material: "Silestone Blanco Norte",
    totalUSD: 3947.25,
    seña: 50,
    estado: "Aprobado",
    ots: 1,
  },
  {
    id: "7370",
    version: "v.1",
    fecha: "2025-05-02",
    cliente: "Wytak Contratista",
    vendedor: "tgorosito",
    material: "Granito Negro Brasil Extra 20mm",
    totalUSD: 574.5,
    seña: 0,
    estado: "Pendiente de Aprobación",
    ots: 1,
  },
  {
    id: "7369",
    version: "v.1",
    fecha: "2025-05-03",
    cliente: "Cecilia Ortiz – Estudio Parrika",
    vendedor: "operello",
    material: "Dekton TRILIUM 12mm",
    totalUSD: 4884.75,
    seña: 50,
    estado: "Aprobado",
    ots: 2,
  },
  {
    id: "7368",
    version: "v.2",
    fecha: "2025-05-04",
    cliente: "VICTORIA TAMARA",
    vendedor: "acottini",
    material: "Cuarcita Black Taurus",
    totalUSD: 1313.0,
    seña: 0,
    estado: "Borrador",
    ots: 1,
  },
  {
    id: "7362",
    version: "v.3",
    fecha: "2025-05-05",
    cliente: "Daniel Natale",
    vendedor: "acottini",
    material: "Granito Gris Mara",
    totalUSD: 1215.6,
    seña: 0,
    estado: "Cancelado",
    ots: 1,
  },
];

// ─── Estado badge helpers ──────────────────────────────────────────────────────

const estadoConfig: Record<
  EstadoPresupuesto,
  { label: string; className: string }
> = {
  Borrador: {
    label: "Borrador",
    className: "bg-muted text-muted-foreground border border-border",
  },
  "Pendiente de Aprobación": {
    label: "Pendiente",
    className: "bg-amber-50 text-amber-700 border border-amber-300",
  },
  Aprobado: {
    label: "Aprobado",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-300",
  },
  Cancelado: {
    label: "Cancelado",
    className: "bg-red-50 text-red-600 border border-red-300",
  },
};

// ─── Flujo Info Banner ─────────────────────────────────────────────────────────

function FlujoBanner() {
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 px-5 py-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Flujo del Trabajo
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {[
          { label: "Presupuesto guardado", color: "bg-muted text-foreground" },
          { label: "Aprobación del cliente", color: "bg-amber-100 text-amber-800" },
          { label: "Seña 50% → descuenta stock", color: "bg-blue-100 text-blue-800" },
          { label: "Pasa a Producción", color: "bg-emerald-100 text-emerald-800" },
        ].map((step, i) => (
          <div key={step.label} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                step.color
              )}
            >
              {i === 2 && <Package className="h-3 w-3" />}
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
        Al registrar la seña del 50%, el sistema descuenta automáticamente los m² de material
        del inventario reservándolos para esta obra. Si la seña no se cobra, el stock no se afecta.
      </p>
    </div>
  );
}

// ─── Panel OT estilo OTflex (secciones colapsables) ──────────────────────────

function SeccionOT({
  titulo,
  borderColor,
  fecha,
  children,
  defaultOpen = false,
}: {
  titulo: string;
  borderColor: string;
  fecha?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", `border-t-4 ${borderColor}`)}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-white hover:bg-muted/40 transition-colors"
      >
        <span className="font-semibold text-sm text-foreground">{titulo}</span>
        <div className="flex items-center gap-3">
          {fecha && (
            <span className="text-xs text-muted-foreground">
              Fecha de Ingreso {fecha}
            </span>
          )}
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {open && <div className="px-5 pb-5 pt-4 bg-white border-t border-border">{children}</div>}
    </div>
  );
}

// ─── Panel Detalle OT (modal-like inline) ────────────────────────────────────

function PanelDetalleOT({
  presupuesto,
  onClose,
  onAprobar,
  onCancelar,
}: {
  presupuesto: Presupuesto;
  onClose: () => void;
  onAprobar: (id: string) => void;
  onCancelar: (id: string) => void;
}) {
  const aprobado = presupuesto.estado === "Aprobado";

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-6 space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            Home &rsaquo; Presupuestos &rsaquo; Detalle
          </p>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-3">
            Presupuesto {presupuesto.id} {presupuesto.version}
            <button className="text-sm text-accent font-normal flex items-center gap-1 hover:underline">
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </button>
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
          ✕ Cerrar
        </Button>
      </div>

      {/* Sección Ventas */}
      <SeccionOT titulo="Ventas" borderColor="border-t-red-500" fecha="2025-05-01" defaultOpen>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4 text-sm">
          {[
            { label: "Vendedor", value: presupuesto.vendedor },
            { label: "Fecha de Ingreso", value: presupuesto.fecha },
            { label: "Cliente / Profesional", value: presupuesto.cliente },
            { label: "Material", value: presupuesto.material },
            { label: "Total (USD)", value: `USD $${presupuesto.totalUSD.toFixed(2)}` },
            { label: "Estado", value: presupuesto.estado },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
              <p className="font-medium text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        {/* Info seña y stock */}
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3">
          <Package className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Descuento de Stock:</span> Al registrar la seña
            del 50%, el sistema descuenta automáticamente{" "}
            <span className="font-semibold">los m² de {presupuesto.material}</span> del
            inventario. Sin seña registrada, el stock permanece sin cambios.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!aprobado && presupuesto.estado !== "Cancelado" && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onAprobar(presupuesto.id)}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Aprobar Presupuesto
            </Button>
          )}
          {presupuesto.estado === "Aprobado" && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Aprobado — Pasa a Producción
            </div>
          )}
          {presupuesto.estado !== "Cancelado" && presupuesto.estado !== "Aprobado" && (
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => onCancelar(presupuesto.id)}
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Cancelar
            </Button>
          )}
          <Button size="sm" variant="outline">
            <FileText className="h-4 w-4 mr-1.5" />
            Generar PDF
          </Button>
        </div>
      </SeccionOT>

      {/* Sección Técnica */}
      <SeccionOT titulo="Técnica" borderColor="border-t-sky-500" fecha="2025-05-02">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4 text-sm mb-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Técnico / Medidor</Label>
            <Select defaultValue="eduardo">
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eduardo">Guzmán, Eduardo</SelectItem>
                <SelectItem value="gonzalo">Gonzalo R.</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fecha de Medición</Label>
            <Input type="date" defaultValue="2025-05-02" className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Medida Aprobada (m²)</Label>
            <Input defaultValue="2.90" className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fecha de Aprobación</Label>
            <Input type="date" defaultValue="2025-05-03" className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">F. Entrega Comprometida</Label>
            <Input type="date" defaultValue="2025-05-20" className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Observaciones</Label>
            <Input placeholder="Observaciones..." className="h-8 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" className="text-accent border-accent/40">
            Enviar plano por email / Subir plano
          </Button>
          <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white">
            Grabar
          </Button>
        </div>
        <div className="mt-3 space-y-1">
          {[
            "Registro de archivos adjuntos a la venta (recibidos por email)",
            "Registro de coordinación de visita para tomar medidas",
          ].map((link) => (
            <p key={link} className="text-xs text-accent hover:underline cursor-pointer">
              {link}
            </p>
          ))}
        </div>
      </SeccionOT>

      {/* Sección Producción */}
      <SeccionOT titulo="Producción" borderColor="border-t-emerald-500" fecha="2025-05-03">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4 text-sm mb-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Retenido</Label>
            <div className="flex items-center gap-3">
              <input type="checkbox" className="rounded" />
              <Input placeholder="Motivo de retención de orden de trabajo" className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Taller</Label>
            <Select defaultValue="mataderos">
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mataderos">Mataderos</SelectItem>
                <SelectItem value="palermo">Palermo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cortador</Label>
            <Select defaultValue="gonzalo">
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gonzalo">Gonzalo</SelectItem>
                <SelectItem value="marcos">Marcos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Terminador en banco</Label>
            <Select defaultValue="fernando">
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fernando">Fernando</SelectItem>
                <SelectItem value="lucas">Lucas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fecha fin de producción</Label>
            <Input type="date" defaultValue="2025-05-18" className="h-8 text-sm" />
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Observaciones</Label>
            <Input placeholder="Sin observaciones." className="h-8 text-sm" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Grabar
          </Button>
        </div>
      </SeccionOT>

      {/* Sección Logística */}
      <SeccionOT titulo="Logística" borderColor="border-t-amber-500" fecha="2025-05-10">
        <p className="text-xs text-accent hover:underline cursor-pointer mb-3">
          Registro de coordinación de visita para entregar
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Fecha de coordinación</TableHead>
                <TableHead className="text-xs">Fecha pactada para entregar</TableHead>
                <TableHead className="text-xs">Observación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Input type="date" defaultValue="2025-05-23" className="h-7 text-xs w-36" />
                </TableCell>
                <TableCell>
                  <Input type="date" defaultValue="2025-05-31" className="h-7 text-xs w-36" />
                </TableCell>
                <TableCell>
                  <Input
                    defaultValue="Entregar de 12:00 a 15:00 hs"
                    className="h-7 text-xs min-w-[220px]"
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-center gap-2 mt-3">
          <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white w-8 h-8 p-0">
            +
          </Button>
          <Button size="sm" variant="outline" className="w-8 h-8 p-0">
            −
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Input placeholder="Observaciones del cierre de la Orden de Trabajo" className="h-9 text-sm flex-1" />
          <Button size="sm" className="bg-rose-500 hover:bg-rose-600 text-white shrink-0">
            Cerrar OT / Conforme
          </Button>
        </div>
      </SeccionOT>
    </div>
  );
}

// ─── Subvista: Nuevo Presupuesto ───────────────────────────────────────────────

function NuevoPresupuesto({ onGuardar }: { onGuardar: () => void }) {
  const [cotizacionMixta, setCotizacionMixta] = useState(false);
  const [monedaFinal, setMonedaFinal] = useState("pesos");
  const dolarHoy = 1250.5;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          Ingreso de Nuevo Presupuesto
        </h2>
        <Card className="bg-primary border-none shadow-sm">
          <CardContent className="py-2 px-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary-foreground" />
            <div>
              <p className="text-[10px] text-primary-foreground/70 leading-none">Dólar Hoy</p>
              <p className="text-sm font-bold text-primary-foreground leading-tight">
                ${dolarHoy.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Datos cliente */}
        <div className="lg:col-span-4 space-y-5">
          <Card>
            <CardHeader className="py-3 px-5 border-b border-border">
              <CardTitle className="text-sm font-semibold">Cliente / Profesional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 px-5">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-5 border-b border-border">
              <CardTitle className="text-sm font-semibold">Material y Precio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 px-5">
              <div className="space-y-1">
                <Label className="text-xs">Material</Label>
                <Select defaultValue="silestone">
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="silestone">Silestone Blanco Norte</SelectItem>
                    <SelectItem value="granito">Granito Negro Brasil Extra 20mm</SelectItem>
                    <SelectItem value="cuarcita">Cuarcita Black Taurus</SelectItem>
                    <SelectItem value="dekton">Dekton TRILIUM 12mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Lista de Precio</Label>
                  <Select defaultValue="lista1">
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lista1">Lista 1 USD</SelectItem>
                      <SelectItem value="pvp">PVP Dólares</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Moneda</Label>
                  <Select defaultValue="usd">
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usd">Dólares (USD)</SelectItem>
                      <SelectItem value="ars">Pesos (ARS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="bg-accent/10 p-3 rounded-md border border-accent/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold cursor-pointer">
                      Cotización Mixta
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Insumos USD / Mano de obra ARS
                    </p>
                  </div>
                  <Switch
                    checked={cotizacionMixta}
                    onCheckedChange={setCotizacionMixta}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trabajos */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="border-accent/30">
            <CardHeader className="py-3 px-5 border-b border-border bg-accent/5 rounded-t-lg">
              <CardTitle className="text-sm font-semibold">Ordenes de Trabajo del Presupuesto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 px-5">
              {/* OT 1 */}
              <div className="border border-border rounded-md p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold bg-accent text-accent-foreground rounded px-2 py-0.5">
                    OT Nro. 1
                  </span>
                  <button className="text-destructive text-xs hover:underline">− Quitar</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Título de la obra</Label>
                    <Input placeholder="Ej: Mesada de cocina + Repisa" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Material específico</Label>
                    <Input placeholder="Ej: Dekton TRILIUM 12mm" className="h-8 text-sm" />
                  </div>
                </div>
                {/* Items tabla */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="py-1.5 px-2 text-[11px]">Cód.</TableHead>
                        <TableHead className="py-1.5 px-2 text-[11px]">Descripción</TableHead>
                        <TableHead className="py-1.5 px-2 text-[11px]">Unid.</TableHead>
                        <TableHead className="py-1.5 px-2 text-[11px]">Cant.</TableHead>
                        <TableHead className="py-1.5 px-2 text-[11px]">P.Unit</TableHead>
                        <TableHead className="py-1.5 px-2 text-[11px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { cod: "MESA", desc: "Mesadas s/medidas aprox", unid: "M2", cant: 3.5, punit: 700.0, total: 2450.0 },
                        { cod: "ZOC", desc: "Zócalos altura", unid: "ML", cant: 6.05, punit: 105.0, total: 635.25 },
                        { cod: "UNING", desc: "Unión ingletada", unid: "Uni", cant: 3.55, punit: 25.0, total: 88.75 },
                        { cod: "TRAFP", desc: "Trasforo y pegado de bacha", unid: "Uni", cant: 2.0, punit: 22.0, total: 44.0 },
                      ].map((row) => (
                        <TableRow key={row.cod} className="text-xs">
                          <TableCell className="py-1.5 px-2 font-medium">{row.cod}</TableCell>
                          <TableCell className="py-1.5 px-2">{row.desc}</TableCell>
                          <TableCell className="py-1.5 px-2">{row.unid}</TableCell>
                          <TableCell className="py-1.5 px-2">{row.cant}</TableCell>
                          <TableCell className="py-1.5 px-2">{row.punit.toFixed(2)}</TableCell>
                          <TableCell className="py-1.5 px-2 font-semibold">{row.total.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between">
                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                    <Plus className="h-3 w-3" /> Agregar Item
                  </Button>
                  <div className="text-sm font-semibold text-right">
                    Subtotal: <span className="text-foreground">USD $3,218.00</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button variant="outline" size="sm" className="gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Agregar OT al Presupuesto
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resumen */}
        <div className="lg:col-span-3">
          <Card className="sticky top-4">
            <CardHeader className="py-3 px-5 border-b border-border">
              <CardTitle className="text-sm font-semibold">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 px-5">
              <div className="space-y-2 text-sm">
                {[
                  { label: "Piedra", usd: "$850.00", ars: "$1,062,500" },
                  { label: "Mano de Obra", usd: "$320.00", ars: "$400,000" },
                  { label: "Perforaciones", usd: "$95.00", ars: "$118,750" },
                  { label: "Terminaciones", usd: "$75.00", ars: "$93,750" },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-1 border-b border-border/60 last:border-0">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium">
                      {cotizacionMixta && row.label !== "Piedra" ? row.ars : row.usd}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-1">
                <Label className="text-xs">Mostrar al cliente en:</Label>
                <Select value={monedaFinal} onValueChange={setMonedaFinal}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pesos">100% Pesos (ARS)</SelectItem>
                    <SelectItem value="dolares">100% Dólares (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-semibold">Total:</span>
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary">
                      {monedaFinal === "pesos" ? "$1,675,000" : "USD $1,340"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {monedaFinal === "pesos" ? "≈ USD $1,340" : "≈ $1,675,000 ARS"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-9 text-sm"
                  onClick={onGuardar}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Presupuesto
                </Button>
                <Button className="w-full h-9 text-sm" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Generar PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Subvista: Listado de Presupuestos ────────────────────────────────────────

function ListadoPresupuestos() {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>(PRESUPUESTOS);
  const [seleccionado, setSeleccionado] = useState<Presupuesto | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("Todos");

  const aprobar = (id: string) => {
    setPresupuestos((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, estado: "Aprobado" as EstadoPresupuesto } : p
      )
    );
    setSeleccionado((prev) =>
      prev?.id === id ? { ...prev, estado: "Aprobado" } : prev
    );
  };

  const cancelar = (id: string) => {
    setPresupuestos((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, estado: "Cancelado" as EstadoPresupuesto } : p
      )
    );
    setSeleccionado((prev) =>
      prev?.id === id ? { ...prev, estado: "Cancelado" } : prev
    );
  };

  const filtrados = presupuestos.filter((p) => {
    const matchBusqueda =
      p.cliente.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.id.includes(busqueda);
    const matchEstado = filtroEstado === "Todos" || p.estado === filtroEstado;
    return matchBusqueda && matchEstado;
  });

  return (
    <div className="space-y-5">
      {/* Flujo banner */}
      <FlujoBanner />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o N° presupuesto..."
            className="pl-9 h-9 text-sm"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="h-9 text-sm w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos los estados</SelectItem>
            <SelectItem value="Borrador">Borrador</SelectItem>
            <SelectItem value="Pendiente de Aprobación">Pendiente de Aprobación</SelectItem>
            <SelectItem value="Aprobado">Aprobado</SelectItem>
            <SelectItem value="Cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1.5">
          {(["Borrador", "Pendiente de Aprobación", "Aprobado", "Cancelado"] as EstadoPresupuesto[]).map(
            (e) => (
              <span
                key={e}
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border",
                  estadoConfig[e].className
                )}
              >
                {presupuestos.filter((p) => p.estado === e).length}
                {" "}
                {estadoConfig[e].label}
              </span>
            )
          )}
        </div>
      </div>

      {/* Tabla */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-xs font-semibold">Presupuesto</TableHead>
              <TableHead className="text-xs font-semibold">F. Alta</TableHead>
              <TableHead className="text-xs font-semibold">Cliente</TableHead>
              <TableHead className="text-xs font-semibold">Vendedor</TableHead>
              <TableHead className="text-xs font-semibold">OTs</TableHead>
              <TableHead className="text-xs font-semibold text-right">Total</TableHead>
              <TableHead className="text-xs font-semibold">Estado</TableHead>
              <TableHead className="text-xs font-semibold">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((p) => {
              const cfg = estadoConfig[p.estado];
              const isSelected = seleccionado?.id === p.id;
              return (
                <>
                  <TableRow
                    key={p.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/30 transition-colors text-sm",
                      isSelected && "bg-accent/10"
                    )}
                    onClick={() =>
                      setSeleccionado(isSelected ? null : p)
                    }
                  >
                    <TableCell className="font-semibold text-accent">
                      {p.id} {p.version}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.fecha}</TableCell>
                    <TableCell>{p.cliente}</TableCell>
                    <TableCell className="text-muted-foreground">{p.vendedor}</TableCell>
                    <TableCell>{p.ots}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ${p.totalUSD.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium",
                          cfg.className
                        )}
                      >
                        {cfg.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {p.estado === "Pendiente de Aprobación" && (
                          <Button
                            size="sm"
                            className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2"
                            onClick={() => aprobar(p.id)}
                          >
                            Aprobar
                          </Button>
                        )}
                        {p.estado === "Borrador" && (
                          <Button
                            size="sm"
                            className="h-7 text-[11px] bg-amber-500 hover:bg-amber-600 text-white px-2"
                            onClick={() => aprobar(p.id)}
                          >
                            Enviar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-[11px] px-2">
                          PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Panel inline expandible */}
                  {isSelected && (
                    <TableRow key={`${p.id}-detail`}>
                      <TableCell colSpan={8} className="p-0 border-0">
                        <div className="px-4 pb-4 pt-2">
                          <PanelDetalleOT
                            presupuesto={presupuestos.find((x) => x.id === p.id)!}
                            onClose={() => setSeleccionado(null)}
                            onAprobar={aprobar}
                            onCancelar={cancelar}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Info paso a producción */}
      {presupuestos.some((p) => p.estado === "Aprobado") && (
        <div className="flex items-start gap-3 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800">
            <span className="font-semibold">
              {presupuestos.filter((p) => p.estado === "Aprobado").length} presupuesto(s)
              aprobado(s)
            </span>{" "}
            transferidos automáticamente a Producción. El stock de materiales se actualizó
            al registrar la seña del 50%.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Vista principal ───────────────────────────────────────────────────────────

export function VistaVentas() {
  const [subTab, setSubTab] = useState<SubTab>("listado");

  const handleGuardar = () => {
    setSubTab("listado");
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header con sub-pestañas */}
      <header className="bg-white border-b border-border shrink-0">
        <div className="px-8 pt-5 pb-0 flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Home &rsaquo; Presupuestos</p>
            <h1 className="text-xl font-bold text-foreground">Presupuestos</h1>
          </div>
        </div>

        {/* Sub-pestañas */}
        <div className="px-8 flex gap-0 mt-3">
          {(
            [
              { id: "listado", label: "Listado / Todos" },
              { id: "nuevo", label: "+ Nuevo Presupuesto" },
            ] as { id: SubTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={cn(
                "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
                subTab === tab.id
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 p-8 overflow-auto">
        {subTab === "listado" && <ListadoPresupuestos />}
        {subTab === "nuevo" && <NuevoPresupuesto onGuardar={handleGuardar} />}
      </main>
    </div>
  );
}
