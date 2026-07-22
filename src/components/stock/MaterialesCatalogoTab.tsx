"use client";

import { useMemo, useState } from "react";
import { PackagePlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import type { MaterialOption } from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { NuevoMaterialDialog } from "./NuevoMaterialDialog";

function kindLabel(kind: MaterialOption["material_kind"]): string {
  switch (kind) {
    case "marmol":
      return "Mármol";
    case "otra_piedra":
      return "Otra piedra";
    case "agglomerado_otro":
      return "Aglomerado / otro";
    default:
      return kind;
  }
}

type MaterialesCatalogoTabProps = {
  materiales: MaterialOption[];
  onMaterialCreated: (material: MaterialOption) => void;
};

export function MaterialesCatalogoTab({
  materiales,
  onMaterialCreated,
}: MaterialesCatalogoTabProps) {
  const [busqueda, setBusqueda] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return materiales;
    return materiales.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.unit.toLowerCase().includes(q) ||
        kindLabel(m.material_kind).toLowerCase().includes(q),
    );
  }, [busqueda, materiales]);

  return (
    <>
      <NuevoMaterialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(m) => {
          onMaterialCreated({
            id: m.id,
            name: m.name,
            unit: m.unit,
            material_kind: m.material_kind,
            peso_por_m2_kg: m.peso_por_m2_kg,
            bulk_stock_kg: m.bulk_stock_kg ?? 0,
            stock_qty: m.stock_qty ?? 0,
          });
        }}
      />

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-border bg-muted/20 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-semibold">
              Catálogo de materiales
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 shrink-0"
                disabled={!isSupabaseConfigured}
                onClick={() => setDialogOpen(true)}
              >
                <PackagePlus className="h-4 w-4" />
                Nuevo material
              </Button>
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-8 text-sm"
                  placeholder="Buscar material…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!isSupabaseConfigured ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Configurá Supabase para gestionar el maestro de materiales.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="min-w-[220px] pl-4 text-xs font-semibold">
                      Nombre
                    </TableHead>
                    <TableHead className="text-xs font-semibold">Unidad</TableHead>
                    <TableHead className="text-xs font-semibold">Tipo</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Stock</TableHead>
                    <TableHead className="pr-4 text-right text-xs font-semibold">
                      kg/m²
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        {materiales.length === 0
                          ? "Todavía no hay materiales. Creá el primero con «Nuevo material»."
                          : "Sin coincidencias."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtrados.map((m) => (
                      <TableRow key={m.id} className="hover:bg-muted/40">
                        <TableCell className="pl-4 text-sm font-medium">
                          {m.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.unit}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {kindLabel(m.material_kind)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-foreground">
                          {(m.stock_qty ?? 0).toLocaleString("es-AR", {
                            maximumFractionDigits: 2,
                          })}{" "}
                          <span className="text-muted-foreground">{m.unit}</span>
                        </TableCell>
                        <TableCell className="pr-4 text-right text-sm tabular-nums text-muted-foreground">
                          {m.peso_por_m2_kg != null
                            ? m.peso_por_m2_kg.toLocaleString("es-AR")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
