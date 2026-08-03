"use client";

import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LogisticaPresupuesto } from "./types";
import { SectionPresupuesto } from "./fields";

type StepLogisticaProps = {
  logistica: LogisticaPresupuesto;
  setLogistica: Dispatch<SetStateAction<LogisticaPresupuesto>>;
};

export function StepLogistica({ logistica, setLogistica }: StepLogisticaProps) {
  return (
    <SectionPresupuesto borderAccentClass="border-t-4 border-t-amber-500">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Fechas tentativas de obra y notas de logística. Son opcionales; podés
          completarlas o ajustarlas más adelante.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="log-fecha-coord" className="text-xs">
              Fecha de coordinación
            </Label>
            <Input
              id="log-fecha-coord"
              type="date"
              className="h-10 text-sm max-w-xs"
              value={logistica.fechaCoord}
              onChange={(e) =>
                setLogistica((l) => ({
                  ...l,
                  fechaCoord: e.target.value,
                }))
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Visita, medición o coordinación con el cliente.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="log-fecha-entrega" className="text-xs">
              Fecha de entrega pactada
            </Label>
            <Input
              id="log-fecha-entrega"
              type="date"
              className="h-10 text-sm max-w-xs"
              value={logistica.fechaEntrega}
              onChange={(e) =>
                setLogistica((l) => ({
                  ...l,
                  fechaEntrega: e.target.value,
                }))
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Entrega / instalación estimada acordada.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="log-obs" className="text-xs">
            Observación
          </Label>
          <Textarea
            id="log-obs"
            className="min-h-[96px] text-sm resize-y"
            placeholder="Acceso, horarios, piso, contacto en obra, restricciones…"
            value={logistica.observacion}
            onChange={(e) =>
              setLogistica((l) => ({
                ...l,
                observacion: e.target.value,
              }))
            }
          />
        </div>
      </div>
    </SectionPresupuesto>
  );
}
