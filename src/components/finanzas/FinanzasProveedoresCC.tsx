"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listMovimientosPorProveedor,
  resumenPorProveedor,
  type CuentaFinancieraRow,
  type MovimientoCajaRow,
  type ResumenProveedorFinanzas,
} from "@/lib/finanzas-api";
import {
  esSalida,
  etiquetaCajon,
  etiquetaTipoMov,
  formatFechaCorta,
  formatMonto,
} from "@/components/finanzas/finanzas-helpers";
import { cn } from "@/lib/utils";

type Props = {
  cuentas: CuentaFinancieraRow[];
  recargaKey: number;
  onAbrirMovimiento: (m: MovimientoCajaRow) => void;
};

export function FinanzasProveedoresCC({ cuentas, recargaKey, onAbrirMovimiento }: Props) {
  const [filas, setFilas] = useState<ResumenProveedorFinanzas[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel] = useState<ResumenProveedorFinanzas | null>(null);
  const [hist, setHist] = useState<MovimientoCajaRow[]>([]);
  const [cargandoHist, setCargandoHist] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    const res = await resumenPorProveedor();
    if (res.error) toast.error(res.error.message);
    setFilas(res.data);
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar, recargaKey]);

  useEffect(() => {
    if (!sel) {
      setHist([]);
      return;
    }
    setCargandoHist(true);
    void listMovimientosPorProveedor(sel.supplier_id).then((res) => {
      if (res.error) toast.error(res.error.message);
      setHist(res.data);
      setCargandoHist(false);
    });
  }, [sel]);

  const totalArs = useMemo(() => filas.reduce((a, r) => a + r.pagado_ars, 0), [filas]);
  const conMovs = filas.filter((f) => f.movimientos > 0).length;
  const cuentaPorId = useMemo(() => new Map(cuentas.map((c) => [c.id, c])), [cuentas]);

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-0">
        <CardContent className="flex flex-wrap items-end justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pagado a proveedores
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMonto(totalArs, "ars")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {conMovs} proveedor{conMovs === 1 ? "" : "es"} con movimientos
            </p>
          </div>
          <p className="max-w-sm text-xs text-muted-foreground">
            Las facturas de compra se van a cargar acá. Por ahora ves lo pagado a cada proveedor desde el libro.
          </p>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Pagado ARS</TableHead>
              <TableHead className="text-right">Pagado USD</TableHead>
              <TableHead className="text-right">Movimientos</TableHead>
              <TableHead>Último pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  {cargando ? "Cargando…" : "No hay proveedores."}
                </TableCell>
              </TableRow>
            ) : (
              filas.map((f) => (
                <TableRow
                  key={f.supplier_id}
                  className="cursor-pointer"
                  onClick={() => setSel(f)}
                >
                  <TableCell className="font-medium">{f.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMonto(f.pagado_ars, "ars")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMonto(f.pagado_usd, "usd")}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.movimientos}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {f.ultimo_pago ? formatFechaCorta(f.ultimo_pago) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={Boolean(sel)} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader className="border-b border-border pr-10">
            <SheetTitle>{sel?.nombre ?? "Proveedor"}</SheetTitle>
            <SheetDescription>Cuenta corriente desde movimientos del libro</SheetDescription>
          </SheetHeader>
          {sel ? (
            <div className="space-y-4 p-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pagado</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatMonto(sel.pagado_ars, "ars")}
                </p>
                {sel.pagado_usd > 0 ? (
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {formatMonto(sel.pagado_usd, "usd")}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Movimientos · {hist.length}
                </p>
                {cargandoHist ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
                ) : hist.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Sin movimientos.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-2xl border border-border">
                    {hist.map((m) => {
                      const salida = esSalida(m.tipo);
                      const cuenta = cuentaPorId.get(m.cuenta_id);
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
                            onClick={() => onAbrirMovimiento(m)}
                          >
                            <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                              {formatFechaCorta(m.fecha)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">{etiquetaTipoMov(m.tipo)}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {cuenta ? etiquetaCajon(cuenta) : "—"}
                                {m.descripcion ? ` · ${m.descripcion}` : ""}
                              </span>
                            </span>
                            <span
                              className={cn(
                                "shrink-0 text-sm font-semibold tabular-nums",
                                salida ? "text-destructive" : "text-emerald-700",
                              )}
                            >
                              {salida ? "−" : "+"}
                              {formatMonto(Number(m.monto), m.moneda)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => setSel(null)}>
                Cerrar
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
