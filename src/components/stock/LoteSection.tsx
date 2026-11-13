"use client";

import { Badge } from "@/components/ui/badge";
import type { ChapaRow } from "@/lib/stock-api";
import { PlacaCard } from "./PlacaCard";

type GrupoLote = {
  lote: string;
  placas: ChapaRow[];
  m2Total: number;
  cantidadPiezas: number;
};

type LoteSectionProps = {
  grupo: GrupoLote;
  seleccionadas: Set<string>;
  onToggleSeleccion: (bulto: string) => void;
};

function formatM2(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LoteSection({ grupo, seleccionadas, onToggleSeleccion }: LoteSectionProps) {
  // Obtener información del remito/factura de la primera placa del lote
  const primeraPlaca = grupo.placas[0];
  const fechaIngreso = primeraPlaca?.created_at
    ? new Date(primeraPlaca.created_at).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          LOTE {grupo.lote}
        </h2>
        <span className="text-xs text-muted-foreground">
          {grupo.cantidadPiezas} pieza{grupo.cantidadPiezas !== 1 ? "s" : ""} ·{" "}
          {formatM2(grupo.m2Total)} m²
        </span>
        {fechaIngreso && (
          <span className="text-xs text-muted-foreground">
            · ingresó {fechaIngreso}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {grupo.placas.map((placa) => (
          <PlacaCard
            key={placa.bulto}
            placa={placa}
            seleccionada={seleccionadas.has(placa.bulto)}
            onToggleSeleccion={() => onToggleSeleccion(placa.bulto)}
          />
        ))}
      </div>
    </div>
  );
}
