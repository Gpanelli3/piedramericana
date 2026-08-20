"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
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
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";
import { listClients, type ClientePresupuesto } from "@/lib/clients-api";
import { isSupabaseConfigured } from "@/lib/supabase";

export function ClientesCatalogo() {
  const [filas, setFilas] = useState<ClientePresupuesto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editando, setEditando] = useState<ClientePresupuesto | null>(null);

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const { data, error } = await listClients();
    if (error) {
      toast.error(`No se pudieron cargar los clientes: ${error.message}`);
      setFilas([]);
    } else {
      setFilas(data);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.contacto.toLowerCase().includes(q) ||
        c.tel.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.direccion.toLowerCase().includes(q),
    );
  }, [busqueda, filas]);

  const abrirNuevo = () => {
    setEditando(null);
    setDialogAbierto(true);
  };

  const abrirEditar = (c: ClientePresupuesto) => {
    setEditando(c);
    setDialogAbierto(true);
  };

  const onSaved = (cliente: ClientePresupuesto) => {
    setFilas((prev) => {
      const sin = prev.filter((c) => c.id !== cliente.id);
      return [...sin, cliente].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder="Buscar por nombre, contacto, tel…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Button type="button" className="gap-1.5 shrink-0" onClick={abrirNuevo}>
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      {!isSupabaseConfigured ? (
        <p className="text-sm text-muted-foreground">
          Configurá Supabase para ver y editar el maestro de clientes.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Dirección</TableHead>
                <TableHead className="w-12" />
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
                      ? "Todavía no hay clientes. Creá el primero o desde un presupuesto."
                      : "Ningún cliente coincide con la búsqueda."}
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.contacto && c.contacto !== c.nombre ? c.contacto : "—"}
                    </TableCell>
                    <TableCell>{c.tel || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{c.email || "—"}</TableCell>
                    <TableCell className="hidden max-w-[14rem] truncate lg:table-cell">
                      {c.direccion || "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar"
                        onClick={() => abrirEditar(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <ClienteFormDialog
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
        cliente={editando}
        onSaved={onSaved}
      />
    </div>
  );
}
