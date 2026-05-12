"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Save, FileText } from "lucide-react";

interface ResumenData {
  materialLabel?: string;
  materialThumbnail?: string;
  desglose: {
    piedra: number;
    manoObra: number;
    flete: number;
  };
  totales: {
    usd: number;
    ars: number;
  };
}

interface PresupuestoBottomBarProps {
  resumenData: ResumenData;
  onPrevStep: () => void;
  onNextStep: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onGeneratePDF?: () => void;
}

function formatArs(n: number): string {
  try {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(
      Math.round(n),
    );
  } catch {
    return String(Math.round(n));
  }
}

function formatUsd(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PresupuestoBottomBar({
  resumenData,
  onPrevStep,
  onNextStep,
  isFirstStep,
  isLastStep,
  isSaving,
  onSave,
  onGeneratePDF,
}: PresupuestoBottomBarProps) {
  return (
    <div className="w-full border-t border-border bg-slate-700 shadow-lg">
      <div className="px-4 py-3">
        {/* Contenedor principal en fila (flex) */}
        <div className="flex flex-col gap-3 sm:gap-4 sm:items-center sm:justify-between">
          {/* Resumen horizontal (izquierda + centro + derecha) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 flex-1 min-w-0">
            {/* Zona Izquierda: Material */}
            {resumenData.materialLabel && (
              <div className="flex items-center gap-2 shrink-0">
                {resumenData.materialThumbnail && (
                  <img
                    src={resumenData.materialThumbnail}
                    alt={resumenData.materialLabel}
                    className="w-8 h-8 rounded object-cover"
                  />
                )}
                <div className="text-xs text-slate-200 font-medium truncate">
                  {resumenData.materialLabel}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="hidden sm:block w-px h-8 bg-slate-600" />

            {/* Zona Centro: Desglose (badges) */}
            <div className="flex flex-wrap gap-2 items-center">
              {resumenData.desglose.piedra > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-600/60 text-xs text-slate-100 font-medium">
                  <span className="text-slate-300">Piedra:</span>
                  <span className="font-semibold">USD {formatUsd(resumenData.desglose.piedra)}</span>
                </div>
              )}
              {resumenData.desglose.manoObra > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-600/60 text-xs text-slate-100 font-medium">
                  <span className="text-slate-300">M.O.:</span>
                  <span className="font-semibold">USD {formatUsd(resumenData.desglose.manoObra)}</span>
                </div>
              )}
              {resumenData.desglose.flete > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-600/60 text-xs text-slate-100 font-medium">
                  <span className="text-slate-300">Flete:</span>
                  <span className="font-semibold">USD {formatUsd(resumenData.desglose.flete)}</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-8 bg-slate-600 flex-shrink-0" />

            {/* Zona Centro-Derecha: Totales */}
            <div className="flex gap-4 sm:gap-6 items-center sm:ml-auto">
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">
                  Total USD
                </p>
                <p className="text-base sm:text-lg font-bold text-white tabular-nums">
                  USD {formatUsd(resumenData.totales.usd)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">
                  Total ARS
                </p>
                <p className="text-base sm:text-lg font-bold text-white tabular-nums">
                  $ {formatArs(resumenData.totales.ars)}
                </p>
              </div>
            </div>
          </div>

          {/* Zona Derecha: Botones (fila) */}
          <div className="flex gap-2 items-center justify-end w-full">
            {!isFirstStep && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPrevStep}
                className="gap-1.5 border-slate-600 text-slate-100 hover:bg-slate-600 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Atrás</span>
              </Button>
            )}

            {isLastStep ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={onSave}
                  disabled={isSaving}
                  className="gap-1.5 bg-blue-900 hover:bg-blue-800 text-white"
                >
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {isSaving ? "Guardando..." : "Guardar"}
                  </span>
                </Button>
                {onGeneratePDF && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onGeneratePDF}
                    className="gap-1.5 border-slate-600 text-slate-100 hover:bg-slate-600 hover:text-white"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">PDF</span>
                  </Button>
                )}
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={onNextStep}
                className="gap-1.5 bg-blue-900 hover:bg-blue-800 text-white"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
