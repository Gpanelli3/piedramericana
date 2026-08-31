"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { InventoryLoteListItem } from "@/lib/cantera-stock-api";
import { useCanteraProcesamientos } from "@/features/cantera/useCanteraProcesamientos";

type CanteraLotesYProcesarProps = {
  lotes: InventoryLoteListItem[];
  loading: boolean;
};

function pctConsumed(initial: number, remaining: number) {
  if (initial <= 0) return 0;
  return Math.round(((initial - remaining) / initial) * 100);
}

export function CanteraLotesYProcesar({
  lotes,
  loading,
}: CanteraLotesYProcesarProps) {
  const { procesamientos, loading: procLoading } = useCanteraProcesamientos(true);

  return (
    <div className="space-y-6">
      {/* Tabla de lotes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lotes</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading ? "Cargando…" : `${lotes.length} lote(s) registrado(s)`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">kg inicial</TableHead>
                  <TableHead className="text-right">kg restante</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Ref.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!lotes.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-12">
                      {loading ? "Cargando lotes…" : "Aún no hay ingresos. Usá el botón \"Nuevo ingreso\" para empezar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  lotes.map((l) => {
                    const pct = pctConsumed(l.qty_kg_initial, l.qty_kg_remaining);
                    const agotado = l.qty_kg_remaining <= 0;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm whitespace-nowrap">{l.issue_date}</TableCell>
                        <TableCell className="text-sm max-w-[14rem] truncate font-medium">
                          {l.material_name ?? l.material_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums">
                          {l.qty_kg_initial.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums font-medium">
                          {l.qty_kg_remaining.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
                        </TableCell>
                        <TableCell>
                          {agotado ? (
                            <Badge variant="soft">Agotado</Badge>
                          ) : pct > 50 ? (
                            <Badge variant="warning">{pct}% usado</Badge>
                          ) : (
                            <Badge variant="success">Disponible</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm truncate max-w-[10rem]">
                          {l.supplier_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm truncate max-w-[10rem]">
                          {l.receipt_ref ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Procesamientos recientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Procesamientos recientes</CardTitle>
          <p className="text-sm text-muted-foreground">
            {procLoading ? "Cargando…" : `${procesamientos.length} registro(s)`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Material bruto</TableHead>
                  <TableHead className="text-right">kg consumidos</TableHead>
                  <TableHead>Productos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!procesamientos.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-12">
                      Aún no hay procesamientos. Usá el botón "Procesar" para registrar uno.
                    </TableCell>
                  </TableRow>
                ) : (
                  procesamientos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm whitespace-nowrap">{p.issue_date}</TableCell>
                      <TableCell className="text-sm max-w-[10rem] truncate">
                        {p.material_bruto_name ?? p.material_bruto_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums">
                        {p.qty_kg_consumidos.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.lineas.length === 0
                          ? "—"
                          : p.lineas
                              .map(
                                (ln) =>
                                  `${ln.material_producto_name ?? ln.material_producto_id.slice(0, 6)}: ${ln.cantidad.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${ln.unit}`,
                              )
                              .join(" · ")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
