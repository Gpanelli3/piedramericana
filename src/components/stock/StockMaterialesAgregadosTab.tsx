"use client";

import { useMemo, useState } from "react";
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
import { Search, ChevronRight } from "lucide-react";
import type { ChapaRow } from "@/lib/stock-api";
import { aggregateChapasPorMaterial } from "@/lib/stock-api";

type Props = {
  chapas: ChapaRow[];
  onOpenMaterial: (materialLabel: string) => void;
};

function formatM2(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function StockMaterialesAgregadosTab({ chapas, onOpenMaterial }: Props) {
  const [q, setQ] = useState("");
  const filas = useMemo(() => {
    const all = aggregateChapasPorMaterial(chapas);
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((r) => r.materialLabel.toLowerCase().includes(needle));
  }, [chapas, q]);

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b border-border bg-muted/20 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Qué hay en depósito</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tocá un material para ver cada chapa (bulto, medida, estado).
          </p>
        </div>
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar material…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 pl-9"
            aria-label="Filtrar materiales"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-4 text-xs font-semibold">Material</TableHead>
                <TableHead className="text-right text-xs font-semibold">Chapas libres</TableHead>
                <TableHead className="text-right text-xs font-semibold">m² libres</TableHead>
                <TableHead className="pr-4 text-right text-xs font-semibold">Reservadas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    {q.trim() ? `No hay resultados para «${q}».` : "Sin materiales en stock."}
                  </TableCell>
                </TableRow>
              ) : (
                filas.map((row) => (
                  <TableRow
                    key={row.materialLabel}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => onOpenMaterial(row.materialLabel)}
                  >
                    <TableCell className="pl-4 text-sm">
                      <span className="inline-flex items-center gap-1 font-medium text-foreground">
                        {row.materialLabel}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-medium">
                      {row.planchasDisponibles}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {formatM2(row.m2Disponibles)}
                    </TableCell>
                    <TableCell className="pr-4 text-right text-sm tabular-nums text-muted-foreground">
                      {row.planchasReservadas}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
