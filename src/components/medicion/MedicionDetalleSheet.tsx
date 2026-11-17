"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OtMedidasPanel } from "@/components/produccion/OtMedidasPanel";
import { etiquetaVentaEstado, formatFechaCorta } from "@/components/produccion/ot-ui";
import type { MedicionColaItem } from "@/lib/medicion-api";
import { etiquetaMedicionEstado } from "@/lib/medicion-reglas";
import { FileImage, MapPin, Printer } from "lucide-react";

type Props = {
  item: MedicionColaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  historial?: boolean;
  onSaved: () => void;
  onRotulo: () => void;
  onPlano: () => void;
  rotuloBusy?: boolean;
  planoBusy?: boolean;
};

export function MedicionDetalleSheet({
  item,
  open,
  onOpenChange,
  historial = false,
  onSaved,
  onRotulo,
  onPlano,
  rotuloBusy = false,
  planoBusy = false,
}: Props) {
  if (!item) return null;

  const fechaConfirmada = formatFechaCorta(item.medicion.medido_en);
  const fechaProgramada = formatFechaCorta(item.medicion.fecha_programada);
  const direccion =
    item.direccionObra && item.direccionObra !== "—" ? item.direccionObra : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
        <SheetHeader className="border-b border-border pr-10 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="truncate text-base">
              {item.numero} · {item.cliente}
            </SheetTitle>
            {historial ? (
              <Badge variant="outline" className="text-[10px]">
                {etiquetaVentaEstado(item.ventaEstado)}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                {etiquetaMedicionEstado(item.medicion.estado)}
              </Badge>
            )}
            {item.presupuestoStatus === "pendiente" ? (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-[10px] text-amber-900"
              >
                Presupuesto pendiente
              </Badge>
            ) : null}
          </div>
          <SheetDescription>
            {historial
              ? fechaConfirmada !== "—"
                ? `Confirmó el ${fechaConfirmada}`
                : "Medidas confirmadas"
              : "Revisá las medidas, el rótulo y el plano."}
            {historial && item.medidoPorNombre ? ` · ${item.medidoPorNombre}` : ""}
          </SheetDescription>
          {direccion ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{direccion}</span>
            </p>
          ) : null}
          {!historial && item.medicion.fecha_programada ? (
            <p className="text-xs text-muted-foreground">
              Programada {fechaProgramada}
            </p>
          ) : null}
          {!historial && item.bloqueoEnvio && item.medicion.estado !== "listo_para_medir" ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-200">{item.bloqueoEnvio}</p>
          ) : null}
        </SheetHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <Button type="button" size="sm" variant="outline" disabled={rotuloBusy} onClick={onRotulo}>
            <Printer className="h-3.5 w-3.5" />
            Rótulo
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={planoBusy} onClick={onPlano}>
            <FileImage className="h-3.5 w-3.5" />
            Plano
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {open && item.presupuestoId ? (
            <OtMedidasPanel
              presupuestoId={item.presupuestoId}
              destacado
              confirmarPipeline
              onSaved={() => {
                onSaved();
                onOpenChange(false);
              }}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
