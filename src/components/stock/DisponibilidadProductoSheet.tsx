"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatQtyUnidad,
  getStockProductoDetalle,
  type ProductoMovimiento,
  type StockProductoDetalle,
  type StockProductoUnidad,
} from "@/lib/stock-unidades-api";

function etiquetaMov(t: ProductoMovimiento["tipo"]): string {
  const map: Record<ProductoMovimiento["tipo"], string> = {
    reserva: "Reserva",
    liberacion: "Liberación",
    consumo: "Consumo",
    baja: "Baja",
    retazo_alta: "Retazo",
  };
  return map[t] ?? t;
}

type Props = {
  producto: StockProductoUnidad | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DisponibilidadProductoSheet({ producto, open, onOpenChange }: Props) {
  const [detalle, setDetalle] = useState<StockProductoDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !producto) return;
    let cancel = false;
    setLoading(true);
    setError(null);
    void (async () => {
      const res = await getStockProductoDetalle(producto.material_id);
      if (cancel) return;
      setLoading(false);
      if (res.error) {
        setError(res.error.message);
        setDetalle(null);
        return;
      }
      setDetalle(res.data);
    })();
    return () => {
      cancel = true;
    };
  }, [open, producto]);

  if (!producto) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader className="text-left">
          <SheetTitle>Stock del producto</SheetTitle>
          <SheetDescription className="font-medium text-foreground">{producto.name}</SheetDescription>
        </SheetHeader>
        <Separator className="my-3" />
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg border border-border bg-emerald-500/10 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Disponible</p>
                <p className="text-base font-semibold tabular-nums">
                  {formatQtyUnidad(producto.qty_disponible, producto.unit)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-amber-500/10 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Reservado</p>
                <p className="text-base font-semibold tabular-nums">
                  {formatQtyUnidad(producto.qty_reservada, producto.unit)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Consumido</p>
                <p className="text-base font-semibold tabular-nums">
                  {formatQtyUnidad(detalle?.qty_consumida ?? 0, producto.unit)}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                OTs
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs">OT</TableHead>
                      <TableHead className="text-right text-xs">Reservado</TableHead>
                      <TableHead className="text-right text-xs">Consumido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!detalle || detalle.ots.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-6 text-center text-xs text-muted-foreground">
                          Ninguna OT usó este producto todavía.
                        </TableCell>
                      </TableRow>
                    ) : (
                      detalle.ots.map((ot) => (
                        <TableRow key={ot.ot_id}>
                          <TableCell className="text-xs font-medium">{ot.ot_titulo}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {ot.qty_reservada > 0
                              ? formatQtyUnidad(ot.qty_reservada, producto.unit)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {ot.qty_consumida > 0
                              ? formatQtyUnidad(ot.qty_consumida, producto.unit)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Movimientos
              </p>
              {!detalle || detalle.movimientos.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                  Sin movimientos de este producto.
                </p>
              ) : (
                <div className="space-y-2">
                  {detalle.movimientos.map((m) => (
                    <div key={m.id} className="rounded-lg border border-border bg-card p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {etiquetaMov(m.tipo)}
                        </Badge>
                        <span className="text-muted-foreground">
                          {new Date(m.created_at).toLocaleString("es-AR")}
                        </span>
                      </div>
                      {m.ot_titulo ? (
                        <p className="mt-1 font-medium text-foreground">{m.ot_titulo}</p>
                      ) : null}
                      {m.detalle ? <p className="mt-0.5 text-muted-foreground">{m.detalle}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
