"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { fetchRemitosList, fetchRemitoLines, type RemitoLineDetail, type RemitoListRow } from "@/lib/stock-api";
import { exportRemitosCsv, exportRemitosDetalleCsv } from "@/lib/reportes-export-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ClipboardList, Download, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

function formatM2Stock(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function etiquetaOrigen(o: string | null | undefined): string {
  switch (o) {
    case "importado":
      return "Importado";
    case "cantera":
      return "Cantera";
    case "otro":
      return "Otro";
    case "nacional":
    default:
      return "Nacional";
  }
}

function m2Line(
  l: Pick<RemitoLineDetail, "qty_slabs" | "largo_cm" | "ancho_cm" | "m2_total" | "modo_medidas">,
): number {
  if (l.m2_total != null && Number.isFinite(Number(l.m2_total))) {
    return Number(l.m2_total);
  }
  if (l.largo_cm == null || l.ancho_cm == null) return 0;
  const piece = (Number(l.largo_cm) / 100) * (Number(l.ancho_cm) / 100);
  return piece * l.qty_slabs;
}

function textoMedidasLinea(l: RemitoLineDetail): string {
  const modo = l.modo_medidas ?? "iguales";
  if (modo === "distintas") {
    return `${l.qty_slabs} chapas · medidas variables → ${formatM2Stock(m2Line(l))} m²`;
  }
  return `${l.qty_slabs} × ${l.largo_cm} × ${l.ancho_cm} cm → ${formatM2Stock(m2Line(l))} m²`;
}

type HistorialProps = {
  reloadToken?: number;
};

export function HistorialRemitosTab({ reloadToken = 0 }: HistorialProps) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RemitoListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [detalleRemitoId, setDetalleRemitoId] = useState<string | null>(null);
  const [detalleLines, setDetalleLines] = useState<RemitoLineDetail[]>([]);
  const [exportBusy, setExportBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchRemitosList();
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const filtradas = rows.filter((r) => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    const numero = `${r.branch_code}-${r.serial_code}`.toLowerCase();
    return (
      numero.includes(q) ||
      (r.supplier_name ?? "").toLowerCase().includes(q) ||
      r.issue_date.includes(q) ||
      (r.notes ?? "").toLowerCase().includes(q)
    );
  });

  const abrirDetalle = async (id: string) => {
    setDetalleRemitoId(id);
    if (!isSupabaseConfigured) {
      setDetalleLines([]);
      return;
    }
    try {
      const lines = await fetchRemitoLines(id);
      setDetalleLines(lines);
    } catch {
      setDetalleLines([]);
    }
  };

  const detalle = detalleRemitoId ? rows.find((r) => r.id === detalleRemitoId) : null;

  if (!isSupabaseConfigured) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ClipboardList className="h-4 w-4" />
            Remitos registrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            El historial de remitos requiere Supabase configurado y la migración de stock aplicada.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-border bg-muted/20 py-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ClipboardList className="h-4 w-4" />
            Remitos registrados
          </CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportBusy || loading}
              onClick={() => {
                setExportBusy(true);
                void exportRemitosCsv().then((res) => {
                  setExportBusy(false);
                  if (res.error) toast.error(res.error.message);
                  else toast.success("Export de remitos descargado.");
                });
              }}
            >
              <Download className="mr-1 h-4 w-4" />
              Export remitos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportBusy || loading}
              onClick={() => {
                setExportBusy(true);
                void exportRemitosDetalleCsv().then((res) => {
                  setExportBusy(false);
                  if (res.error) toast.error(res.error.message);
                  else toast.success("Export detalle descargado.");
                });
              }}
            >
              <Download className="mr-1 h-4 w-4" />
              Export detalle
            </Button>
            <Input
              className="h-9 sm:w-64"
              placeholder="Buscar por N°, proveedor, fecha o pedido…"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4 text-xs font-semibold">Fecha</TableHead>
                  <TableHead className="text-xs font-semibold">N° remito</TableHead>
                  <TableHead className="text-xs font-semibold">Proveedor</TableHead>
                  <TableHead className="text-xs font-semibold">Origen</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Placas</TableHead>
                  <TableHead className="pr-4 text-right text-xs font-semibold">m²</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No hay remitos para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradas.map((r) => (
                    <TableRow
                      key={r.id}
                      className={cn("cursor-pointer hover:bg-muted/40")}
                      onClick={() => void abrirDetalle(r.id)}
                    >
                      <TableCell className="pl-4 text-sm tabular-nums text-muted-foreground">
                        {r.issue_date}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        {r.branch_code}-{r.serial_code}
                      </TableCell>
                      <TableCell className="text-sm">{r.supplier_name ?? "—"}</TableCell>
                      <TableCell className="text-sm capitalize text-muted-foreground">
                        {etiquetaOrigen(r.origen_placa)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{r.total_slabs}</TableCell>
                      <TableCell className="pr-4 text-right text-sm font-semibold tabular-nums">
                        {formatM2Stock(r.total_m2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={Boolean(detalleRemitoId)} onOpenChange={(o) => !o && setDetalleRemitoId(null)}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader className="text-left">
            <SheetTitle>Detalle remito</SheetTitle>
            <SheetDescription>
              {detalle
                ? `${detalle.branch_code}-${detalle.serial_code} · ${detalle.issue_date}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-1">
            {detalle ? (
              <>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Proveedor:</span>{" "}
                  {detalle.supplier_name ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Origen:</span>{" "}
                  {etiquetaOrigen(detalle.origen_placa)}
                </p>
              </>
            ) : null}
            {detalle?.notes ? (
              <p className="text-sm">
                <span className="font-medium">Obs.:</span> {detalle.notes}
              </p>
            ) : null}
            {detalle ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate(`/remitos/${detalle.id}/rotulos`)}
              >
                <Printer className="mr-1 h-4 w-4" />
                Imprimir rótulos
              </Button>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Líneas</p>
            <ul className="space-y-2">
              {detalleLines.map((l) => (
                <li key={l.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                  <p className="font-medium text-foreground">{l.material_label}</p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {textoMedidasLinea(l)}
                    {l.lote_codigo ? ` · lote ${l.lote_codigo}` : ""}
                    {l.origen_placa ? ` · ${etiquetaOrigen(l.origen_placa)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
