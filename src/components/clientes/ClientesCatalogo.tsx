"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { BarraFiltrosLista } from "@/components/lista/BarraFiltrosLista";
import {
  getClientById,
  listClients,
  type ClientePresupuesto,
} from "@/lib/clients-api";
import {
  listPresupuestosResumen,
  type PresupuestoRowList,
} from "@/lib/presupuestos-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { urlWhatsapp } from "@/lib/whatsapp";
import {
  clientePasaFiltros,
  FILTROS_LISTA_VACIOS,
  hayFiltrosPresupuestoParaCliente,
  opcionesVendedores,
  ORDEN_LISTA_DEFAULT,
  ordenarClientes,
  type FiltrosLista,
  type OrdenLista,
} from "@/lib/lista-filtros";

export function ClientesCatalogo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cid = searchParams.get("cid");

  const [filas, setFilas] = useState<ClientePresupuesto[]>([]);
  const [presupuestos, setPresupuestos] = useState<PresupuestoRowList[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FiltrosLista>(FILTROS_LISTA_VACIOS);
  const [orden, setOrden] = useState<OrdenLista>(ORDEN_LISTA_DEFAULT);
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editando, setEditando] = useState<ClientePresupuesto | null>(null);
  const [ficha, setFicha] = useState<ClientePresupuesto | null>(null);

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFilas([]);
      setPresupuestos([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const [cli, pres] = await Promise.all([listClients(), listPresupuestosResumen()]);
    if (cli.error) {
      toast.error(`No se pudieron cargar los clientes: ${cli.error.message}`);
      setFilas([]);
    } else {
      setFilas(cli.data);
    }
    if (pres.error) {
      toast.error(pres.error.message);
      setPresupuestos([]);
    } else {
      setPresupuestos(pres.data ?? []);
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

  const vendedoresOpciones = useMemo(
    () => opcionesVendedores(presupuestos),
    [presupuestos],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const porFiltro = filas.filter((c) => clientePasaFiltros(c, presupuestos, filtros));
    const buscadas = !q
      ? porFiltro
      : porFiltro.filter(
          (c) =>
            c.nombre.toLowerCase().includes(q) ||
            c.contacto.toLowerCase().includes(q) ||
            c.tel.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.direccion.toLowerCase().includes(q),
        );
    return ordenarClientes(buscadas, presupuestos, orden, filtros);
  }, [busqueda, filas, presupuestos, filtros, orden]);

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
      <BarraFiltrosLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por nombre, contacto, tel…"
        ariaLabel="Buscar clientes"
        filtros={filtros}
        onFiltrosChange={setFiltros}
        orden={orden}
        onOrdenChange={setOrden}
        vendedores={vendedoresOpciones.lista}
        haySinVendedor={vendedoresOpciones.haySinVendedor}
        clientes={[]}
        mostrarCliente={false}
        idPrefix="clientes"
        trailing={
          <Button type="button" className="h-9 gap-1.5 shrink-0" onClick={abrirNuevo}>
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        }
      />

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
                      : busqueda.trim() || hayFiltrosPresupuestoParaCliente(filtros)
                        ? "Ningún cliente coincide con los filtros."
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
                    <TableCell>
                      {c.tel ? (
                        <a
                          href={urlWhatsapp(c.tel) || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!urlWhatsapp(c.tel)) {
                              e.preventDefault();
                            }
                          }}
                        >
                          {c.tel}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
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
