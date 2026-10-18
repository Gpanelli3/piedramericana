"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FechaInput } from "@/components/ui/fecha-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import {
  createPagoPrestador,
  createPrestador,
  deletePagoPrestador,
  etiquetaRubroPrestador,
  listPagosPrestadores,
  listPrestadores,
  PRESTADOR_RUBROS,
  updatePrestador,
  type PagoPrestadorConNombre,
  type PrestadorRow,
} from "@/lib/prestadores-api";
import { formatFechaIso, formatPesos, hoyIso, parseMonto } from "@/lib/sueldos-calculos";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { PrestadorRubro } from "@/types/database";

export function PrestadoresCatalogo() {
  const { user } = useAuth();
  const [prestadores, setPrestadores] = useState<PrestadorRow[]>([]);
  const [pagos, setPagos] = useState<PagoPrestadorConNombre[]>([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<PrestadorRow | null>(null);
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const [aBorrar, setABorrar] = useState<PagoPrestadorConNombre | null>(null);
  const [borrando, setBorrando] = useState(false);

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setPrestadores([]);
      setPagos([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const [p, g] = await Promise.all([listPrestadores(), listPagosPrestadores()]);
    if (p.error) toast.error(p.error.message);
    else setPrestadores(p.data);
    if (g.error) toast.error(g.error.message);
    else setPagos(g.data);
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Contador, redes y otros que no están en nómina. El pago sale en Finanzas.
      </p>
      <Tabs defaultValue="pagos">
        <TabsList>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
        </TabsList>
        <TabsContent value="pagos" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => setPagoAbierto(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Registrar pago
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>A quién</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargando ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : pagos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      Todavía no hay pagos.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagos.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular-nums">{formatFechaIso(r.fecha)}</TableCell>
                      <TableCell>
                        {r.prestadores?.nombre ?? "—"}
                        <span className="block text-[11px] text-muted-foreground">
                          {etiquetaRubroPrestador(r.prestadores?.rubro)}
                          {r.descripcion ? ` · ${r.descripcion}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.moneda === "usd"
                          ? `USD ${r.monto.toLocaleString("es-AR")}`
                          : formatPesos(r.monto)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => setABorrar(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="agenda" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditando(null);
                setFormAbierto(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Alta
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rubro</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {prestadores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      Cargá al contador, a quien lleva las redes, etc.
                    </TableCell>
                  </TableRow>
                ) : (
                  prestadores.map((p) => (
                    <TableRow key={p.id} className={p.activo ? "" : "opacity-60"}>
                      <TableCell className="font-medium">{p.nombre}</TableCell>
                      <TableCell>{etiquetaRubroPrestador(p.rubro)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.telefono || p.email || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => {
                            setEditando(p);
                            setFormAbierto(true);
                          }}
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
        </TabsContent>
      </Tabs>

      <PrestadorFormDialog
        open={formAbierto}
        onOpenChange={setFormAbierto}
        prestador={editando}
        onSaved={(row) => {
          setPrestadores((prev) => {
            const sin = prev.filter((p) => p.id !== row.id);
            return [row, ...sin];
          });
        }}
      />
      <PagoPrestadorDialog
        open={pagoAbierto}
        onOpenChange={setPagoAbierto}
        prestadores={prestadores.filter((p) => p.activo)}
        createdBy={user?.id ?? null}
        onSaved={(row) => setPagos((prev) => [row, ...prev])}
      />
      <AlertDialog open={Boolean(aBorrar)} onOpenChange={(o) => !o && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este pago?</AlertDialogTitle>
            <AlertDialogDescription>También se saca el movimiento de finanzas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={borrando}
              onClick={() => {
                if (!aBorrar) return;
                setBorrando(true);
                void deletePagoPrestador(aBorrar.id).then((res) => {
                  setBorrando(false);
                  if (res.error) {
                    toast.error(res.error.message);
                    return;
                  }
                  setPagos((prev) => prev.filter((p) => p.id !== aBorrar.id));
                  setABorrar(null);
                  toast.success("Pago eliminado.");
                });
              }}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PrestadorFormDialog({
  open,
  onOpenChange,
  prestador,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prestador: PrestadorRow | null;
  onSaved: (row: PrestadorRow) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState<PrestadorRubro>("otro");
  const [cuit, setCuit] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNombre(prestador?.nombre ?? "");
    setRubro(prestador?.rubro ?? "otro");
    setCuit(prestador?.cuit ?? "");
    setTelefono(prestador?.telefono ?? "");
    setEmail(prestador?.email ?? "");
    setActivo(prestador?.activo ?? true);
  }, [open, prestador]);

  const guardar = async () => {
    setGuardando(true);
    const fn = prestador
      ? updatePrestador(prestador.id, { nombre, rubro, cuit, telefono, email, activo })
      : createPrestador({ nombre, rubro, cuit, telefono, email, activo });
    const res = await fn;
    setGuardando(false);
    if (res.error || !res.data) {
      toast.error(res.error?.message ?? "No se pudo guardar.");
      return;
    }
    onSaved(res.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{prestador ? "Editar" : "Alta"} de prestador</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Rubro</Label>
            <Select value={rubro} onValueChange={(v) => setRubro(v as PrestadorRubro)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESTADOR_RUBROS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>CUIT</Label>
              <Input value={cuit} onChange={(e) => setCuit(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={activo} onCheckedChange={setActivo} />
            <Label>Activo</Label>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" disabled={guardando} onClick={() => void guardar()}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PagoPrestadorDialog({
  open,
  onOpenChange,
  prestadores,
  createdBy,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prestadores: PrestadorRow[];
  createdBy: string | null;
  onSaved: (row: PagoPrestadorConNombre) => void;
}) {
  const [prestadorId, setPrestadorId] = useState("");
  const [fecha, setFecha] = useState(hoyIso());
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<"ars" | "usd">("ars");
  const [metodo, setMetodo] = useState<"efectivo" | "transferencia" | "cheque">("transferencia");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPrestadorId(prestadores[0]?.id ?? "");
    setFecha(hoyIso());
    setMonto("");
    setDescripcion("");
  }, [open, prestadores]);

  const guardar = async () => {
    const n = parseMonto(monto);
    setGuardando(true);
    const res = await createPagoPrestador({
      prestador_id: prestadorId,
      fecha,
      monto: n,
      moneda,
      metodo,
      descripcion,
      created_by: createdBy,
    });
    setGuardando(false);
    if (res.error || !res.data) {
      toast.error(res.error?.message ?? "No se pudo registrar.");
      return;
    }
    toast.success("Pago registrado.");
    onSaved(res.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pago a no empleado</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>A quién</Label>
            <Select value={prestadorId} onValueChange={setPrestadorId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí" />
              </SelectTrigger>
              <SelectContent>
                {prestadores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <FechaInput value={fecha} onChange={setFecha} />
            </div>
            <div className="space-y-1">
              <Label>Monto</Label>
              <Input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as "ars" | "usd")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ars">Pesos</SelectItem>
                  <SelectItem value="usd">Dólares</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cómo se pagó</Label>
              <Select
                value={metodo}
                onValueChange={(v) => setMetodo(v as "efectivo" | "transferencia" | "cheque")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Nota</Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" disabled={guardando} onClick={() => void guardar()}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
