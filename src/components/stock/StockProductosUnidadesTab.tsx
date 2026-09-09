"use client";

import { Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatQtyUnidad, type StockProductoUnidad } from "@/lib/stock-unidades-api";

type Props = {
  productos: StockProductoUnidad[];
  loading?: boolean;
  error?: string | null;
  onOpenProducto?: (producto: StockProductoUnidad) => void;
};

export function StockProductosUnidadesTab({ productos, loading, error, onOpenProducto }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Productos</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Unidades de cantera (adoquines, laja, etc.). No son planchas.
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Producto
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Unidad
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Disponible
              </TableHead>
              <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reservado
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  Cargando productos…
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-destructive">
                  {error}
                </TableCell>
              </TableRow>
            ) : productos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  Sin productos en stock. Se cargan al procesar un lote en Cantera.
                </TableCell>
              </TableRow>
            ) : (
              productos.map((p) => (
                <TableRow
                  key={p.material_id}
                  className={onOpenProducto ? "cursor-pointer hover:bg-muted/40" : "hover:bg-muted/40"}
                  onClick={onOpenProducto ? () => onOpenProducto(p) : undefined}
                >
                  <TableCell className="pl-4 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium text-foreground">
                      <Package className="h-4 w-4 shrink-0 text-primary" />
                      {p.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.unit}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">
                    {formatQtyUnidad(p.qty_disponible, p.unit)}
                  </TableCell>
                  <TableCell className="pr-4 text-right text-sm tabular-nums text-muted-foreground">
                    {p.qty_reservada > 0 ? formatQtyUnidad(p.qty_reservada, p.unit) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
