"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Edit2, QrCode, Scissors } from "lucide-react";
import type { ChapaRow } from "@/lib/stock-api";
import { esChapaRetazo } from "@/lib/stock-api";

type PlacaCardProps = {
  placa: ChapaRow;
  seleccionada: boolean;
  onToggleSeleccion: () => void;
};

function m2(largoCm: number, anchoCm: number): number {
  return (largoCm / 100) * (anchoCm / 100);
}

function formatM2(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function estadoBadgeClass(estado: ChapaRow["estado"]): string {
  if (estado === "Disponible") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
  }
  if (estado === "Reservada") {
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200";
  }
  if (estado === "Bloqueada") {
    return "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200";
  }
  return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export function PlacaCard({ placa, seleccionada, onToggleSeleccion }: PlacaCardProps) {
  const esRetazo = esChapaRetazo(placa);
  const m2Placa = m2(placa.largoCm, placa.anchoCm);
  
  const fechaIngreso = placa.created_at
    ? new Date(placa.created_at).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const formatPrecio = (precio: number | null | undefined): string | null => {
    if (precio == null || !Number.isFinite(precio)) return null;
    return `USD ${Math.round(precio).toLocaleString("es-AR")}`;
  };

  return (
    <div className="group relative rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="space-y-2">
        {/* Header con checkbox y foto */}
        <div className="flex items-start gap-2">
          <Checkbox
            checked={seleccionada}
            onCheckedChange={onToggleSeleccion}
            className="mt-0.5"
          />
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted">
            <Camera className="h-5 w-5 text-muted-foreground" />
            <span className="sr-only">Agregar foto</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-base font-semibold">N° {placa.bulto.replace(/^#/, "")}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                title="Editar"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              lote {placa.loteCodigo || "—"}
            </p>
          </div>
        </div>

        {/* Badge de tipo */}
        {!esRetazo && (
          <Badge variant="secondary" className="border border-primary/20 bg-primary/10 text-primary text-[10px] px-2 py-0">
            ENTERA
          </Badge>
        )}

        {/* Dimensiones */}
        <div>
          <p className="text-sm font-semibold tabular-nums">
            {placa.largoCm.toFixed(2)} × {placa.anchoCm.toFixed(2)} m · {formatM2(m2Placa)} m²
          </p>
          {placa.espesorCm != null && placa.espesorCm > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {placa.espesorCm} cm
              {fechaIngreso ? ` · ingresó ${fechaIngreso}` : ""}
            </p>
          ) : fechaIngreso ? (
            <p className="text-[11px] text-muted-foreground">
              ingresó {fechaIngreso}
            </p>
          ) : null}
        </div>

        {/* Precio */}
        {formatPrecio(placa.precioM2) && (
          <p className="text-xs font-medium text-foreground">
            {formatPrecio(placa.precioM2)}
          </p>
        )}

        {/* Botones de acción */}
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[11px] px-2"
          >
            <Camera className="h-3 w-3" />
            Foto
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[11px] px-2"
          >
            <QrCode className="h-3 w-3" />
            QR
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[11px] px-2"
          >
            <Edit2 className="h-3 w-3" />
            Corregir medidas
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[11px] px-2"
          >
            <Scissors className="h-3 w-3" />
            Registrar corte
          </Button>
        </div>

        {/* Badge de estado */}
        <div className="flex justify-end">
          <Badge variant="secondary" className={`${estadoBadgeClass(placa.estado)} text-[10px] px-2 py-0`}>
            {placa.estado === "Disponible" ? "En stock" : placa.estado}
          </Badge>
        </div>
      </div>
    </div>
  );
}
