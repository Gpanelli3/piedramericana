"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Clock, User, Layers, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface OT {
  id: string;
  numero: string;
  cliente: string;
  material: string;
  m2: string;
  vendedor: string;
  columna: string;
  prioridad: "alta" | "normal" | "baja";
}

const otData: OT[] = [
  {
    id: "1",
    numero: "OT #1042",
    cliente: "Familia Pérez",
    material: "Granito Negro Brasil",
    m2: "3.50 m²",
    vendedor: "tgorosito",
    columna: "corte",
    prioridad: "alta",
  },
  {
    id: "2",
    numero: "OT #1038",
    cliente: "Arq. Cecilia Ortega",
    material: "Silestone Blanco Norte",
    m2: "2.10 m²",
    vendedor: "acottini",
    columna: "medicion",
    prioridad: "normal",
  },
  {
    id: "3",
    numero: "OT #1035",
    cliente: "Victoria Torres",
    material: "Dekton TRILIUM 12mm",
    m2: "4.20 m²",
    vendedor: "rcampillo",
    columna: "pulido",
    prioridad: "normal",
  },
  {
    id: "4",
    numero: "OT #1031",
    cliente: "Daniel Natale",
    material: "Cuarcita Black Taurus",
    m2: "1.80 m²",
    vendedor: "operelna",
    columna: "pegado",
    prioridad: "baja",
  },
  {
    id: "5",
    numero: "OT #1028",
    cliente: "Yanina Salvini",
    material: "Granito Negro Boreal",
    m2: "2.90 m²",
    vendedor: "tgorosito",
    columna: "despacho",
    prioridad: "alta",
  },
];

const columnas = [
  { id: "medicion", label: "Medición", color: "border-t-blue-400" },
  { id: "corte", label: "Corte", color: "border-t-orange-400" },
  { id: "pulido", label: "Pulido", color: "border-t-yellow-400" },
  { id: "pegado", label: "Pegado", color: "border-t-purple-400" },
  { id: "despacho", label: "Despacho", color: "border-t-green-400" },
];

const prioridadConfig = {
  alta: { label: "Urgente", class: "bg-red-100 text-red-700 border-red-200" },
  normal: { label: "Normal", class: "bg-blue-100 text-blue-700 border-blue-200" },
  baja: { label: "Baja", class: "bg-gray-100 text-gray-600 border-gray-200" },
};

export function VistaProduccion() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOT, setSelectedOT] = useState<OT | null>(null);
  const [motivo, setMotivo] = useState("");
  const [materialDescuento, setMaterialDescuento] = useState("");

  const handleRotura = (ot: OT) => {
    setSelectedOT(ot);
    setModalOpen(true);
  };

  const handleConfirmar = () => {
    setModalOpen(false);
    setMotivo("");
    setMaterialDescuento("");
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Top bar */}
      <header className="bg-white border-b border-border px-8 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Producción / Taller</p>
            <h1 className="text-xl font-bold text-foreground">
              Control de Taller — Trazabilidad Kanban
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground border border-border rounded-md px-3 py-1.5">
              <Clock className="h-4 w-4" />
              <span>Hoy, 06 May 2026</span>
            </div>
            <Badge variant="outline" className="text-sm font-medium">
              {otData.length} OTs activas
            </Badge>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <main className="flex-1 p-6 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {columnas.map((col) => {
            const ots = otData.filter((o) => o.columna === col.id);
            return (
              <div key={col.id} className="w-64 flex flex-col gap-3">
                {/* Column header */}
                <div
                  className={cn(
                    "bg-white rounded-lg border-t-4 border border-border shadow-sm px-4 py-3 flex items-center justify-between",
                    col.color
                  )}
                >
                  <span className="font-semibold text-sm text-foreground">
                    {col.label}
                  </span>
                  <span className="text-xs font-bold bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                    {ots.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-3">
                  {ots.map((ot) => (
                    <OTCard
                      key={ot.id}
                      ot={ot}
                      onRotura={handleRotura}
                      showRotura={col.id === "corte" || col.id === "pulido"}
                    />
                  ))}

                  {ots.length === 0 && (
                    <div className="border-2 border-dashed border-border rounded-lg h-24 flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Sin OTs</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal Rotura */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Registrar Rotura / Reproceso
            </DialogTitle>
          </DialogHeader>

          {selectedOT && (
            <div className="bg-muted/50 rounded-md px-4 py-3 text-sm mb-2">
              <p className="font-semibold text-foreground">{selectedOT.numero}</p>
              <p className="text-muted-foreground">
                {selectedOT.cliente} — {selectedOT.material}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo de la Rotura</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger id="motivo">
                  <SelectValue placeholder="Seleccionar motivo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corte-incorrecto">Corte incorrecto</SelectItem>
                  <SelectItem value="caida-accidente">Caída / Accidente</SelectItem>
                  <SelectItem value="veta-material">Veta del material</SelectItem>
                  <SelectItem value="medicion-error">Error de medición</SelectItem>
                  <SelectItem value="traslado">Daño en traslado</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="material-desc">Nuevo Material a Descontar del Stock</Label>
              <Select value={materialDescuento} onValueChange={setMaterialDescuento}>
                <SelectTrigger id="material-desc">
                  <SelectValue placeholder="Seleccionar material..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="granito-negro">Granito Negro Brasil Extra 20mm</SelectItem>
                  <SelectItem value="silestone-blanco">Silestone Blanco Norte</SelectItem>
                  <SelectItem value="cuarcita-black">Cuarcita Black Taurus</SelectItem>
                  <SelectItem value="dekton-trilium">Dekton TRILIUM 12mm</SelectItem>
                  <SelectItem value="granito-boreal">Granito Negro Boreal Leather</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs-rotura">Observaciones</Label>
              <Textarea
                id="obs-rotura"
                placeholder="Descripción del incidente..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmar}
              disabled={!motivo || !materialDescuento}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Confirmar Rotura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OTCard({
  ot,
  onRotura,
  showRotura,
}: {
  ot: OT;
  onRotura: (ot: OT) => void;
  showRotura: boolean;
}) {
  const prioridad = prioridadConfig[ot.prioridad];

  return (
    <div className="bg-white rounded-lg border border-border shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-primary">{ot.numero}</span>
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full border",
            prioridad.class
          )}
        >
          {prioridad.label}
        </span>
      </div>

      {/* Info */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-sm text-foreground">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium truncate">{ot.cliente}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{ot.material}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{ot.m2}</span>
          <span>{ot.vendedor}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 h-7 text-xs text-muted-foreground hover:text-foreground"
        >
          Ver OT
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>

        {showRotura && (
          <Button
            size="sm"
            className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white px-2"
            onClick={() => onRotura(ot)}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Rotura
          </Button>
        )}
      </div>
    </div>
  );
}
