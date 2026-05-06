"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Package,
  Layers,
  Info,
} from "lucide-react";

const chapasData = [
  {
    bulto: "#8890",
    material: "Granito Negro Brasil Extra 20mm",
    largo: "320",
    ancho: "180",
    estado: "Disponible",
  },
  {
    bulto: "#8891",
    material: "Silestone Blanco Stellar",
    largo: "305",
    ancho: "140",
    estado: "Disponible",
  },
  {
    bulto: "#8876",
    material: "Cuarcita Blue Roma",
    largo: "290",
    ancho: "165",
    estado: "Reservada",
  },
  {
    bulto: "#8850",
    material: "Dekton TRILIUM 12mm",
    largo: "320",
    ancho: "145",
    estado: "Reservada",
  },
  {
    bulto: "#8845",
    material: "Granito Black Cosmic Leather 20mm",
    largo: "310",
    ancho: "175",
    estado: "Disponible",
  },
];

const retazosData = [
  {
    id: "Ret-045",
    material: "Granito Negro Brasil Extra 20mm",
    medidas: "90 cm × 60 cm",
    chapaOrigen: "Bulto #8812",
  },
  {
    id: "Ret-044",
    material: "Silestone Blanco Stellar",
    medidas: "120 cm × 45 cm",
    chapaOrigen: "Bulto #8860",
  },
  {
    id: "Ret-043",
    material: "Cuarcita Blue Roma",
    medidas: "75 cm × 80 cm",
    chapaOrigen: "Bulto #8801",
  },
  {
    id: "Ret-042",
    material: "Dekton TRILIUM 12mm",
    medidas: "55 cm × 90 cm",
    chapaOrigen: "Bulto #8792",
  },
];

export function VistaStock() {
  const [asignados, setAsignados] = useState<string[]>([]);

  const toggleAsignar = (id: string) => {
    setAsignados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Inventario e Ingeniería de Materiales
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Control de chapas, retazos y movimientos de stock en tiempo real
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
            <Package className="h-4 w-4" />
            <span>
              <span className="font-semibold text-foreground">5</span> chapas ·{" "}
              <span className="font-semibold text-foreground">4</span> retazos disponibles
            </span>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* ── ALERTA DE STOCK CRÍTICO ── */}
        <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Stock Crítico:</span> Granito Gris Mara — Quedan 2 bultos disponibles.
          </p>
        </div>

        {/* ── TABLAS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CARD A — Chapas Enteras */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Layers className="h-5 w-5 text-accent" />
                Chapas Enteras Disponibles
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide pl-4">
                      Nro Bulto
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">
                      Material
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-right">
                      Largo
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-right">
                      Ancho
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-center pr-4">
                      Estado
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chapasData.map((row) => (
                    <TableRow key={row.bulto} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-4 font-mono text-sm font-medium text-foreground">
                        {row.bulto}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {row.material}
                      </TableCell>
                      <TableCell className="text-sm text-right text-muted-foreground">
                        {row.largo} cm
                      </TableCell>
                      <TableCell className="text-sm text-right text-muted-foreground">
                        {row.ancho} cm
                      </TableCell>
                      <TableCell className="text-center pr-4">
                        <Badge
                          variant={row.estado === "Disponible" ? "default" : "secondary"}
                          className={
                            row.estado === "Disponible"
                              ? "bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs"
                              : "bg-amber-100 text-amber-700 border border-amber-200 text-xs"
                          }
                        >
                          {row.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* CARD B — Retazos */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Package className="h-5 w-5 text-amber-500" />
                Retazos Reutilizables
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide pl-4">
                      ID Retazo
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">
                      Material
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">
                      Medidas
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">
                      Chapa Origen
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-center pr-4">
                      Acción
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retazosData.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-4 font-mono text-sm font-medium text-foreground">
                        {row.id}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {row.material}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {row.medidas}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {row.chapaOrigen}
                      </TableCell>
                      <TableCell className="text-center pr-4">
                        <Button
                          size="sm"
                          variant={asignados.includes(row.id) ? "secondary" : "outline"}
                          onClick={() => toggleAsignar(row.id)}
                          className="text-xs h-7 px-3"
                        >
                          {asignados.includes(row.id) ? "Asignado" : "Asignar a OT"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Nota de descarte */}
              <div className="flex items-start gap-2 px-4 py-3 border-t border-border bg-muted/30">
                <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  El desperdicio irrecuperable (polvo y despunte) se descuenta
                  automáticamente del stock al cerrar la Orden de Trabajo.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
