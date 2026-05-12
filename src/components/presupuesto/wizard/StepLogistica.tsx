"use client";

import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LogisticaPresupuesto } from "./types";
import { SectionPresupuesto } from "./fields";

type StepLogisticaProps = {
  logistica: LogisticaPresupuesto;
  setLogistica: Dispatch<SetStateAction<LogisticaPresupuesto>>;
};

export function StepLogistica({ logistica, setLogistica }: StepLogisticaProps) {
  return (
    <SectionPresupuesto borderAccentClass="border-t-4 border-t-amber-500">
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs min-w-[9rem]">Fecha coordinación</TableHead>
                <TableHead className="text-xs min-w-[9rem]">Fecha entrega pactada</TableHead>
                <TableHead className="text-xs min-w-[240px]">Observación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="p-2">
                  <Input
                    type="date"
                    className="h-8 text-xs w-36"
                    value={logistica.fechaCoord}
                    onChange={(e) =>
                      setLogistica((l) => ({
                        ...l,
                        fechaCoord: e.target.value,
                      }))
                    }
                  />
                </TableCell>
                <TableCell className="p-2">
                  <Input
                    type="date"
                    className="h-8 text-xs w-36"
                    value={logistica.fechaEntrega}
                    onChange={(e) =>
                      setLogistica((l) => ({
                        ...l,
                        fechaEntrega: e.target.value,
                      }))
                    }
                  />
                </TableCell>
                <TableCell className="p-2">
                  <Input
                    className="h-8 text-xs"
                    value={logistica.observacion}
                    onChange={(e) =>
                      setLogistica((l) => ({
                        ...l,
                        observacion: e.target.value,
                      }))
                    }
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </SectionPresupuesto>
  );
}
