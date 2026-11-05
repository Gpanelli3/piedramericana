"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { ClienteFicha } from "@/components/clientes/ClienteFicha";
import {
  getClientById,
  listClients,
  type ClientePresupuesto,
} from "@/lib/clients-api";
import { isSupabaseConfigured } from "@/lib/supabase";

export function ClientesCatalogo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cid = searchParams.get("cid");

  const [filas, setFilas] = useState<ClientePresupuesto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editando, setEditando] = useState<ClientePresupuesto | null>(null);
  const [ficha, setFicha] = useState<ClientePresupuesto | null>(null);

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

  useEffect(() => {
    if (!cid) {
      setFicha(null);
      return;
    }
    const enLista = filas.find((c) => c.id === cid);
    if (enLista) {
      setFicha(enLista);
      return;
    }
    if (cargando) return;

    let cancelado = false;
    void getClientById(cid).then((res) => {
      if (cancelado) return;
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      if (!res.data) {
        toast.error("No se encontró el cliente.");
        setSearchParams(
          (prev) => {
            const n = new URLSearchParams(prev);
            n.delete("cid");
            return n;
          },
          { replace: true },
        );
        return;
      }
      setFicha(res.data);
    });
    return () => {
      cancelado = true;
    };
  }, [cid, filas, cargando, setSearchParams]);

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

  const abrirFicha = (c: ClientePresupuesto) => {
    setFicha(c);
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("ws", "clientes");
        n.set("cid", c.id);
        return n;
      },
      { replace: false },
    );
  };

  const cerrarFicha = () => {
    setFicha(null);
    setDialogAbierto(false);
    setEditando(null);
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete("cid");
        n.set("ws", "clientes");
        return n;
      },
      { replace: false },
    );
  };

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
    if (ficha?.id === cliente.id) setFicha(cliente);
  };

  if (ficha) {
    return (
      <ClienteFicha
        cliente={ficha}
        onBack={cerrarFicha}
        onUpdated={onSaved}
        dialogAbierto={dialogAbierto}
        setDialogAbierto={setDialogAbierto}
        onEdit={() => abrirEditar(ficha)}
      />
    );
  }

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {filas.length === 0
                      ? "Todavía no hay clientes. Creá el primero o desde un presupuesto."
                      : "Ningún cliente coincide con la búsqueda."}
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => abrirFicha(c)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{c.nombre}</span>
                        {c.esAgenteRetencion ? (
                          <Badge variant="outline" className="shrink-0 text-[10px] font-medium">
                            Ret.
                            {c.retencionPorcentaje != null ? ` ${c.retencionPorcentaje}%` : ""}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.contacto && c.contacto !== c.nombre ? c.contacto : "—"}
                    </TableCell>
                    <TableCell>{c.tel || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{c.email || "—"}</TableCell>
                    <TableCell className="hidden max-w-[14rem] truncate lg:table-cell">
                      {c.direccion || "—"}
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
