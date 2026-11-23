"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProveedorFormDialog } from "@/components/proveedores/ProveedorFormDialog";
import { ProveedorFicha } from "@/components/proveedores/ProveedorFicha";
import {
  fetchSuppliers,
  rubroLabel,
  origenLabel,
  RUBROS_PROVEEDOR,
  type SupplierRow,
} from "@/lib/suppliers-api";
import { isSupabaseConfigured } from "@/lib/supabase";

export function ProveedoresCatalogo() {
  const [filas, setFilas] = useState<SupplierRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRubro, setFiltroRubro] = useState("todos");
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editando, setEditando] = useState<SupplierRow | null>(null);
  const [fichaAbierta, setFichaAbierta] = useState<SupplierRow | null>(null);

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const data = await fetchSuppliers();
      setFilas(data);
    } catch (err) {
      toast.error(`No se pudieron cargar los proveedores: ${err instanceof Error ? err.message : String(err)}`);
      setFilas([]);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const filtrados = useMemo(() => {
    let list = filas;
    if (filtroRubro !== "todos") {
      list = list.filter((s) => s.rubros?.includes(filtroRubro));
    }
    const q = busqueda.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.cuit ?? "").toLowerCase().includes(q) ||
          (s.locality ?? "").toLowerCase().includes(q) ||
          (s.contact_name ?? "").toLowerCase().includes(q) ||
          (s.phone ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [busqueda, filtroRubro, filas]);

  const abrirNuevo = () => {
    setEditando(null);
    setDialogAbierto(true);
  };

  const abrirEditar = (s: SupplierRow) => {
    setEditando(s);
    setDialogAbierto(true);
  };

  const onSaved = (supplier: SupplierRow) => {
    setFilas((prev) => {
      const sin = prev.filter((s) => s.id !== supplier.id);
      return [supplier, ...sin].sort((a, b) => {
        if (a.activo !== b.activo) return a.activo ? -1 : 1;
        return a.name.localeCompare(b.name, "es");
      });
    });
    if (fichaAbierta?.id === supplier.id) {
      setFichaAbierta(supplier);
    }
  };

  if (fichaAbierta) {
    return (
      <ProveedorFicha
        supplier={fichaAbierta}
        onBack={() => setFichaAbierta(null)}
        onEdit={() => abrirEditar(fichaAbierta)}
        onUpdated={onSaved}
        onDeleted={(id) => {
          setFilas((prev) => prev.filter((f) => f.id !== id));
          setFichaAbierta(null);
        }}
        dialogAbierto={dialogAbierto}
        setDialogAbierto={setDialogAbierto}
        editando={editando}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative max-w-md flex-1" data-guia="buscar">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="Buscar por nombre, CUIT, localidad…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <Select value={filtroRubro} onValueChange={setFiltroRubro}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los rubros</SelectItem>
              {RUBROS_PROVEEDOR.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" className="h-9 gap-1.5 shrink-0" onClick={abrirNuevo} data-guia="accion-principal">
          <Plus className="h-4 w-4" />
          Nuevo proveedor
        </Button>
      </div>

      {!isSupabaseConfigured ? (
        <p className="text-sm text-muted-foreground">
          Configurá Supabase para ver y editar el maestro de proveedores.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white" data-guia="lista">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Rubros</TableHead>
                <TableHead className="hidden md:table-cell">Origen</TableHead>
                <TableHead className="hidden md:table-cell">CUIT</TableHead>
                <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                <TableHead className="hidden lg:table-cell">Contacto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {filas.length === 0
                      ? "Todavía no hay proveedores. Creá el primero."
                      : "Ningún proveedor coincide con la búsqueda."}
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((s) => (
                  <TableRow
                    key={s.id}
                    className={`cursor-pointer ${!s.activo ? "opacity-50" : ""}`}
                    onClick={() => setFichaAbierta(s)}
                  >
                    <TableCell className="font-medium">
                      {s.name}
                      {!s.activo && (
                        <Badge variant="outline" className="ml-2 text-[10px]">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(s.rubros ?? []).map((r) => (
                          <Badge key={r} variant="secondary" className="text-[10px]">
                            {rubroLabel(r)}
                          </Badge>
                        ))}
                        {(!s.rubros || s.rubros.length === 0) && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {origenLabel(s.origen ?? "nacional")}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {s.cuit || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {s.phone || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {s.contact_name || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <ProveedorFormDialog
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
        supplier={editando}
        onSaved={onSaved}
      />
    </div>
  );
}
