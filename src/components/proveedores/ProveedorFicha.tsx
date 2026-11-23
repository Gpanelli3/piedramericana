"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Mountain, Pencil, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProveedorFormDialog } from "@/components/proveedores/ProveedorFormDialog";
import {
  fetchSupplierActividad,
  rubroLabel,
  origenLabel,
  type SupplierRow,
  type SupplierActividad,
} from "@/lib/suppliers-api";
import { etiquetaConcepto, etiquetaMetodo } from "@/lib/finanzas-api";

function fmtMonto(n: number, moneda: string) {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: moneda === "usd" ? 2 : 0,
    maximumFractionDigits: moneda === "usd" ? 2 : 0,
  };
  const prefix = moneda === "usd" ? "USD " : "$ ";
  return prefix + n.toLocaleString("es-AR", opts);
}

function fmtFecha(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type ProveedorFichaProps = {
  supplier: SupplierRow;
  onBack: () => void;
  onEdit: () => void;
  onUpdated: (s: SupplierRow) => void;
  onDeleted: (id: string) => void;
  dialogAbierto: boolean;
  setDialogAbierto: (v: boolean) => void;
  editando: SupplierRow | null;
};

export function ProveedorFicha({
  supplier,
  onBack,
  onEdit,
  onUpdated,
  onDeleted,
  dialogAbierto,
  setDialogAbierto,
  editando,
}: ProveedorFichaProps) {
  const [act, setAct] = useState<SupplierActividad | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    void fetchSupplierActividad(supplier.id)
      .then(setAct)
      .catch(() => toast.error("No se pudo cargar la actividad del proveedor."))
      .finally(() => setCargando(false));
  }, [supplier.id]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{supplier.name}</h2>
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span>{origenLabel(supplier.origen ?? "nacional")}</span>
            {supplier.cuit && <span>· CUIT {supplier.cuit}</span>}
            {!supplier.activo && <Badge variant="outline" className="text-[10px]">Inactivo</Badge>}
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
      </div>

      {/* Datos de contacto */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {supplier.rubros && supplier.rubros.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Rubros</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {supplier.rubros.map((r) => (
                  <Badge key={r} variant="secondary" className="text-[10px]">{rubroLabel(r)}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {supplier.phone && (
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Teléfono</p>
              <p className="text-sm font-medium">{supplier.phone}</p>
            </CardContent>
          </Card>
        )}
        {supplier.email && (
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="truncate text-sm font-medium">{supplier.email}</p>
            </CardContent>
          </Card>
        )}
        {supplier.contact_name && (
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Contacto</p>
              <p className="text-sm font-medium">{supplier.contact_name}</p>
            </CardContent>
          </Card>
        )}
        {(supplier.address || supplier.locality || supplier.province) && (
          <Card className="sm:col-span-2">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Domicilio</p>
              <p className="text-sm font-medium">
                {[supplier.address, supplier.locality, supplier.province, supplier.postal_code]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Totales egresos */}
      {act && (act.totalesEgresos.ars > 0 || act.totalesEgresos.usd > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {act.totalesEgresos.ars > 0 && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Pagado ARS</p>
                <p className="text-lg font-semibold tabular-nums">{fmtMonto(act.totalesEgresos.ars, "ars")}</p>
              </CardContent>
            </Card>
          )}
          {act.totalesEgresos.usd > 0 && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Pagado USD</p>
                <p className="text-lg font-semibold tabular-nums">{fmtMonto(act.totalesEgresos.usd, "usd")}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Actividad */}
      <Tabs defaultValue="remitos" className="gap-3">
        <TabsList>
          <TabsTrigger value="remitos" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Remitos ({act?.remitos.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="cantera" className="gap-1.5">
            <Mountain className="h-3.5 w-3.5" />
            Cantera ({act?.lotes.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="pagos" className="gap-1.5">
            <Wallet className="h-3.5 w-3.5" />
            Pagos ({act?.movimientos.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="remitos">
          {cargando ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : !act?.remitos.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin remitos registrados.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Remito</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead className="text-right">Chapas</TableHead>
                    <TableHead className="text-right">m²</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {act.remitos.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.branch_code || "—"}-{r.serial_code || "—"}
                      </TableCell>
                      <TableCell>{fmtFecha(r.issue_date)}</TableCell>
                      <TableCell className="capitalize">{r.origen_placa}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.total_slabs}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.total_m2.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cantera">
          {cargando ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : !act?.lotes.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin ingresos de cantera.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Comprobante</TableHead>
                    <TableHead className="text-right">kg inicial</TableHead>
                    <TableHead className="text-right">kg restante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {act.lotes.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.material_name}</TableCell>
                      <TableCell>{fmtFecha(l.issue_date)}</TableCell>
                      <TableCell>{l.receipt_ref || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.qty_kg_initial.toLocaleString("es-AR")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.qty_kg_remaining.toLocaleString("es-AR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pagos">
          {cargando ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : !act?.movimientos.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin pagos registrados a este proveedor.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {act.movimientos.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{fmtFecha(m.fecha)}</TableCell>
                      <TableCell>{etiquetaConcepto(m.concepto as never)}</TableCell>
                      <TableCell>{etiquetaMetodo(m.metodo)}</TableCell>
                      <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                        {m.descripcion || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-destructive">
                        −{fmtMonto(m.monto, m.moneda)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {supplier.notes && (
        <div className="rounded-lg border border-border bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">Notas internas</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{supplier.notes}</p>
        </div>
      )}

      <ProveedorFormDialog
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
        supplier={editando}
        onSaved={onUpdated}
        onDeleted={onDeleted}
      />
    </div>
  );
}
