"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Banknote,
  Plus,
  Wallet,
  Landmark,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  calcularSaldoCuentaEnFecha,
  listCuentasActivas,
  listMovimientos,
  listSaldosCuentas,
  registrarCierreCaja,
  registrarMovimientoManual,
  resumenCajaDelDia,
  transferirEntreCuentas,
  type CuentaFinancieraRow,
  type MovimientoCajaRow,
  type SaldoCuentaRow,
} from "@/lib/finanzas-api";
import { cn } from "@/lib/utils";

function formatMonto(n: number, moneda: "ars" | "usd") {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: moneda === "usd" ? 2 : 0,
    maximumFractionDigits: moneda === "usd" ? 2 : 0,
  };
  const prefix = moneda === "usd" ? "USD " : "$ ";
  return `${prefix}${n.toLocaleString("es-AR", opts)}`;
}

function etiquetaTipo(t: MovimientoCajaRow["tipo"]): string {
  const map: Record<MovimientoCajaRow["tipo"], string> = {
    ingreso: "Ingreso",
    egreso: "Egreso",
    transferencia_entrada: "Transferencia (+)",
    transferencia_salida: "Transferencia (−)",
  };
  return map[t];
}

function iconoTipoCuenta(tipo: CuentaFinancieraRow["tipo"]) {
  switch (tipo) {
    case "banco":
      return Landmark;
    case "tarjeta":
      return Banknote;
    default:
      return Wallet;
  }
}

export function VistaFinanzas() {
  const [saldos, setSaldos] = useState<SaldoCuentaRow[]>([]);
  const [cuentas, setCuentas] = useState<CuentaFinancieraRow[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCajaRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroCuenta, setFiltroCuenta] = useState<string>("todas");

  const [dialogMov, setDialogMov] = useState(false);
  const [dialogTransf, setDialogTransf] = useState(false);
  const [dialogCierre, setDialogCierre] = useState(false);
  const [busy, setBusy] = useState(false);

  const hoy = new Date().toISOString().slice(0, 10);
  const [resumenDia, setResumenDia] = useState<{
    ingresos: number;
    egresos: number;
    neto: number;
    porMetodo: Record<string, number>;
  } | null>(null);

  const [movForm, setMovForm] = useState({
    cuentaId: "",
    tipo: "ingreso" as "ingreso" | "egreso",
    monto: "",
    moneda: "ars" as "ars" | "usd",
    fecha: hoy,
    descripcion: "",
  });

  const [transfForm, setTransfForm] = useState({
    origenId: "",
    destinoId: "",
    monto: "",
    moneda: "ars" as "ars" | "usd",
    fecha: hoy,
    descripcion: "",
  });

  const [cierreForm, setCierreForm] = useState({
    cuentaId: "",
    fecha: hoy,
    saldoArqueo: "",
    notas: "",
    saldoCalculado: null as number | null,
  });

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setCargando(false);
      return;
    }
    setCargando(true);
    const [s, c, m, r] = await Promise.all([
      listSaldosCuentas(),
      listCuentasActivas(),
      listMovimientos({ limit: 100 }),
      resumenCajaDelDia(hoy),
    ]);
    if (s.error) toast.error(s.error.message);
    if (c.error) toast.error(c.error.message);
    if (m.error) toast.error(m.error.message);
    if (r.error) toast.error(r.error.message);
    setSaldos(s.data);
    setCuentas(c.data);
    setMovimientos(m.data);
    setResumenDia(r.data);
    setCargando(false);
  }, [hoy]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const movFiltrados = useMemo(() => {
    if (filtroCuenta === "todas") return movimientos;
    return movimientos.filter((m) => m.cuenta_id === filtroCuenta);
  }, [movimientos, filtroCuenta]);

  const totalesPorMoneda = useMemo(() => {
    const ars = saldos.filter((s) => s.moneda === "ars").reduce((a, s) => a + Number(s.saldo_actual), 0);
    const usd = saldos.filter((s) => s.moneda === "usd").reduce((a, s) => a + Number(s.saldo_actual), 0);
    return { ars, usd };
  }, [saldos]);

  const cuentaNombre = useCallback(
    (id: string) => cuentas.find((c) => c.id === id)?.nombre ?? id.slice(0, 8),
    [cuentas],
  );

  async function onRegistrarMovimiento() {
    const n = Number(String(movForm.monto).replace(",", "."));
    if (!movForm.cuentaId || !Number.isFinite(n) || n <= 0) {
      toast.error("Completá cuenta y monto válido.");
      return;
    }
    setBusy(true);
    const res = await registrarMovimientoManual({
      cuentaId: movForm.cuentaId,
      tipo: movForm.tipo,
      monto: n,
      moneda: movForm.moneda,
      fecha: movForm.fecha,
      descripcion: movForm.descripcion,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Movimiento registrado.");
    setDialogMov(false);
    setMovForm({ cuentaId: "", tipo: "ingreso", monto: "", moneda: "ars", fecha: hoy, descripcion: "" });
    await recargar();
  }

  async function onTransferir() {
    const n = Number(String(transfForm.monto).replace(",", "."));
    if (!transfForm.origenId || !transfForm.destinoId || !Number.isFinite(n) || n <= 0) {
      toast.error("Completá cuentas y monto válido.");
      return;
    }
    setBusy(true);
    const res = await transferirEntreCuentas({
      cuentaOrigenId: transfForm.origenId,
      cuentaDestinoId: transfForm.destinoId,
      monto: n,
      moneda: transfForm.moneda,
      fecha: transfForm.fecha,
      descripcion: transfForm.descripcion,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Transferencia registrada.");
    setDialogTransf(false);
    setTransfForm({ origenId: "", destinoId: "", monto: "", moneda: "ars", fecha: hoy, descripcion: "" });
    await recargar();
  }

  async function onAbrirCierre(cuentaId: string) {
    const { saldo, error } = await calcularSaldoCuentaEnFecha(cuentaId, cierreForm.fecha);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCierreForm((f) => ({ ...f, cuentaId, saldoCalculado: saldo }));
    setDialogCierre(true);
  }

  async function onRegistrarCierre() {
    if (!cierreForm.cuentaId) return;
    setBusy(true);
    const arqueo = cierreForm.saldoArqueo.trim()
      ? Number(String(cierreForm.saldoArqueo).replace(",", "."))
      : null;
    const res = await registrarCierreCaja({
      cuentaId: cierreForm.cuentaId,
      fecha: cierreForm.fecha,
      saldoArqueo: arqueo != null && Number.isFinite(arqueo) ? arqueo : null,
      notas: cierreForm.notas,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Cierre de caja registrado.");
    setDialogCierre(false);
    await recargar();
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Finanzas requiere Supabase configurado y la migración M15 aplicada.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <header className="border-b border-border bg-card px-4 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Finanzas</h1>
            <p className="text-sm text-muted-foreground">Cuentas, movimientos y cierre de caja</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogMov(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Movimiento
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogTransf(true)}>
              <ArrowLeftRight className="mr-1 h-4 w-4" />
              Transferir
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Disponible ARS</p>
              <p className="text-2xl font-semibold tabular-nums">
                {cargando ? "…" : formatMonto(totalesPorMoneda.ars, "ars")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Disponible USD</p>
              <p className="text-2xl font-semibold tabular-nums">
                {cargando ? "…" : formatMonto(totalesPorMoneda.usd, "usd")}
              </p>
            </CardContent>
          </Card>
          <Card className="sm:col-span-2 lg:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Neto del día ({hoy})</p>
              <p className="text-2xl font-semibold tabular-nums">
                {cargando || !resumenDia ? "…" : formatMonto(resumenDia.neto, "ars")}
              </p>
              {resumenDia && Object.keys(resumenDia.porMetodo).length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Cobros:{" "}
                  {Object.entries(resumenDia.porMetodo)
                    .map(([k, v]) => `${k} ${Math.round(v).toLocaleString("es-AR")}`)
                    .join(" · ")}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="cuentas">
          <TabsList>
            <TabsTrigger value="cuentas">Cuentas</TabsTrigger>
            <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          </TabsList>

          <TabsContent value="cuentas" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {saldos.map((s) => {
                const Icon = iconoTipoCuenta(s.tipo);
                return (
                  <Card key={s.cuenta_id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {s.nombre}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xl font-semibold tabular-nums">
                        {formatMonto(Number(s.saldo_actual), s.moneda)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {s.tipo} · {s.moneda.toUpperCase()}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-full text-xs"
                        onClick={() => void onAbrirCierre(s.cuenta_id)}
                      >
                        Cerrar caja hoy
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="movimientos" className="mt-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Últimos movimientos</CardTitle>
                <Select value={filtroCuenta} onValueChange={setFiltroCuenta}>
                  <SelectTrigger className="h-9 w-full sm:w-52">
                    <SelectValue placeholder="Cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las cuentas</SelectItem>
                    {cuentas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          {cargando ? "Cargando…" : "Sin movimientos."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      movFiltrados.map((m) => {
                        const esSalida = m.tipo === "egreso" || m.tipo === "transferencia_salida";
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="tabular-nums text-sm">{m.fecha}</TableCell>
                            <TableCell className="text-sm">{cuentaNombre(m.cuenta_id)}</TableCell>
                            <TableCell className="text-sm">{etiquetaTipo(m.tipo)}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                              {m.descripcion ?? "—"}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right text-sm font-medium tabular-nums",
                                esSalida ? "text-destructive" : "text-green-700 dark:text-green-400",
                              )}
                            >
                              {esSalida ? "−" : "+"}
                              {formatMonto(Number(m.monto), m.moneda)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogMov} onOpenChange={setDialogMov}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Cuenta</Label>
              <Select value={movForm.cuentaId} onValueChange={(v) => setMovForm((f) => ({ ...f, cuentaId: v }))}>
                <SelectTrigger><SelectValue placeholder="Elegir cuenta" /></SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={movForm.tipo}
                  onValueChange={(v) => setMovForm((f) => ({ ...f, tipo: v as "ingreso" | "egreso" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="egreso">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Moneda</Label>
                <Select
                  value={movForm.moneda}
                  onValueChange={(v) => setMovForm((f) => ({ ...f, moneda: v as "ars" | "usd" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ars">ARS</SelectItem>
                    <SelectItem value="usd">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monto</Label>
                <Input value={movForm.monto} onChange={(e) => setMovForm((f) => ({ ...f, monto: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Fecha</Label>
                <Input type="date" value={movForm.fecha} onChange={(e) => setMovForm((f) => ({ ...f, fecha: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea rows={2} value={movForm.descripcion} onChange={(e) => setMovForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMov(false)}>Cancelar</Button>
            <Button disabled={busy} onClick={() => void onRegistrarMovimiento()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogTransf} onOpenChange={setDialogTransf}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir entre cuentas</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Cuenta origen</Label>
              <Select value={transfForm.origenId} onValueChange={(v) => setTransfForm((f) => ({ ...f, origenId: v }))}>
                <SelectTrigger><SelectValue placeholder="Origen" /></SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cuenta destino</Label>
              <Select value={transfForm.destinoId} onValueChange={(v) => setTransfForm((f) => ({ ...f, destinoId: v }))}>
                <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monto</Label>
                <Input value={transfForm.monto} onChange={(e) => setTransfForm((f) => ({ ...f, monto: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Moneda</Label>
                <Select
                  value={transfForm.moneda}
                  onValueChange={(v) => setTransfForm((f) => ({ ...f, moneda: v as "ars" | "usd" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ars">ARS</SelectItem>
                    <SelectItem value="usd">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={transfForm.fecha} onChange={(e) => setTransfForm((f) => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Descripción (opcional)</Label>
              <Input value={transfForm.descripcion} onChange={(e) => setTransfForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTransf(false)}>Cancelar</Button>
            <Button disabled={busy} onClick={() => void onTransferir()}>Transferir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogCierre} onOpenChange={setDialogCierre}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cierre de caja</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <p>
              Saldo calculado al {cierreForm.fecha}:{" "}
              <span className="font-semibold tabular-nums">
                {cierreForm.saldoCalculado != null ? cierreForm.saldoCalculado.toLocaleString("es-AR") : "…"}
              </span>
            </p>
            <div className="space-y-1">
              <Label>Arqueo físico (opcional)</Label>
              <Input
                value={cierreForm.saldoArqueo}
                onChange={(e) => setCierreForm((f) => ({ ...f, saldoArqueo: e.target.value }))}
                placeholder="Monto contado en caja"
              />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea rows={2} value={cierreForm.notas} onChange={(e) => setCierreForm((f) => ({ ...f, notas: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogCierre(false)}>Cancelar</Button>
            <Button disabled={busy} onClick={() => void onRegistrarCierre()}>Registrar cierre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
