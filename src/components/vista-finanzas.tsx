"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Plus } from "lucide-react";
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
  CONCEPTOS_MOVIMIENTO,
  METODOS_PAGO,
  etiquetaConcepto,
  etiquetaMetodo,
  listCuentasActivas,
  listMovimientos,
  listSaldosCuentas,
  registrarMovimientoManual,
  resumenCajaDelDia,
  transferirEntreCuentas,
  type ConceptoMovimiento,
  type CuentaFinancieraRow,
  type MetodoPago,
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

function etiquetaFormaPago(tipo: CuentaFinancieraRow["tipo"]): string {
  switch (tipo) {
    case "banco":
      return "Transferencia";
    case "tarjeta":
      return "Tarjeta";
    case "cheque":
      return "Cheque";
    case "caja":
      return "Efectivo";
    default:
      return "Otro";
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
  const [busy, setBusy] = useState(false);

  const hoy = new Date().toISOString().slice(0, 10);
  const [resumenDia, setResumenDia] = useState<{
    ingresos: number;
    egresos: number;
    neto: number;
    porMetodo: Record<string, number>;
  } | null>(null);

  const [movForm, setMovForm] = useState({
    tipo: "ingreso" as "ingreso" | "egreso",
    metodo: "efectivo" as MetodoPago,
    concepto: "trabajo" as Exclude<ConceptoMovimiento, "transferencia">,
    monto: "",
    moneda: "ars" as "ars" | "usd",
    fecha: hoy,
    descripcion: "",
  });

  const conceptosDisponibles = useMemo(
    () =>
      CONCEPTOS_MOVIMIENTO.filter(
        (c) => c.para === "ambos" || c.para === movForm.tipo,
      ),
    [movForm.tipo],
  );

  const [transfForm, setTransfForm] = useState({
    origenId: "",
    destinoId: "",
    monto: "",
    moneda: "ars" as "ars" | "usd",
    fecha: hoy,
    descripcion: "",
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

  async function onRegistrarMovimiento() {
    const n = Number(String(movForm.monto).replace(",", "."));
    if (!movForm.metodo || !Number.isFinite(n) || n <= 0) {
      toast.error("Completá forma de pago y monto válido.");
      return;
    }
    setBusy(true);
    const res = await registrarMovimientoManual({
      tipo: movForm.tipo,
      metodo: movForm.metodo,
      concepto: movForm.concepto,
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
    setMovForm({
      tipo: "ingreso",
      metodo: "efectivo",
      concepto: "trabajo",
      monto: "",
      moneda: "ars",
      fecha: hoy,
      descripcion: "",
    });
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
            <p className="text-sm text-muted-foreground">
              Los cobros de trabajos y pagos normales entran por Ventas y sus procesos. Acá ves el libro y ajustás excepciones.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogMov(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Ajuste manual
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
                    .map(([k, v]) => `${etiquetaMetodo(k)} ${Math.round(v).toLocaleString("es-AR")}`)
                    .join(" · ")}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="cuentas">
          <TabsList>
            <TabsTrigger value="cuentas">Por forma de pago</TabsTrigger>
            <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          </TabsList>

          <TabsContent value="cuentas" className="mt-4">
            <Card>
              <CardHeader className="border-b space-y-1">
                <CardTitle className="text-base">Saldos por forma de pago</CardTitle>
                <p className="text-sm font-normal text-muted-foreground">
                  Cajones del libro según cómo se pagó o cobró. No son cuentas bancarias conectadas.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Forma de pago</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead className="text-right">Saldo registrado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saldos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                          {cargando ? "Cargando…" : "Sin saldos."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      saldos.map((s) => (
                        <TableRow key={s.cuenta_id}>
                          <TableCell className="font-medium">
                            {etiquetaFormaPago(s.tipo)}
                          </TableCell>
                          <TableCell className="uppercase text-muted-foreground">
                            {s.moneda}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatMonto(Number(s.saldo_actual), s.moneda)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movimientos" className="mt-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Últimos movimientos</CardTitle>
                <Select value={filtroCuenta} onValueChange={setFiltroCuenta}>
                  <SelectTrigger className="h-9 w-full sm:w-52">
                    <SelectValue placeholder="Forma de pago" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las formas</SelectItem>
                    {cuentas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {etiquetaFormaPago(c.tipo)} {c.moneda.toUpperCase()}
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
                      <TableHead>Método</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          {cargando ? "Cargando…" : "Sin movimientos."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      movFiltrados.map((m) => {
                        const esSalida = m.tipo === "egreso" || m.tipo === "transferencia_salida";
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="tabular-nums text-sm">{m.fecha}</TableCell>
                            <TableCell className="text-sm">{etiquetaMetodo(m.metodo)}</TableCell>
                            <TableCell className="text-sm">{etiquetaConcepto(m.concepto)}</TableCell>
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
            <DialogTitle>Ajuste manual</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Solo para plata fuera de proceso: un ingreso/egreso suelto. Cobros de trabajo, señas y boletas van por Ventas / compras.
            </p>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={movForm.tipo}
                  onValueChange={(v) => {
                    const tipo = v as "ingreso" | "egreso";
                    setMovForm((f) => ({
                      ...f,
                      tipo,
                      concepto: tipo === "ingreso" ? "trabajo" : "gastos",
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="egreso">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Cómo se paga</Label>
                <Select
                  value={movForm.metodo}
                  onValueChange={(v) => setMovForm((f) => ({ ...f, metodo: v as MetodoPago }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METODOS_PAGO.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Concepto</Label>
                <Select
                  value={movForm.concepto}
                  onValueChange={(v) =>
                    setMovForm((f) => ({
                      ...f,
                      concepto: v as Exclude<ConceptoMovimiento, "transferencia">,
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {conceptosDisponibles.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
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
            <DialogTitle>Mover entre formas de pago</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Desde</Label>
              <Select value={transfForm.origenId} onValueChange={(v) => setTransfForm((f) => ({ ...f, origenId: v }))}>
                <SelectTrigger><SelectValue placeholder="Origen" /></SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {etiquetaFormaPago(c.tipo)} {c.moneda.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Hacia</Label>
              <Select value={transfForm.destinoId} onValueChange={(v) => setTransfForm((f) => ({ ...f, destinoId: v }))}>
                <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {etiquetaFormaPago(c.tipo)} {c.moneda.toUpperCase()}
                    </SelectItem>
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

    </div>
  );
}
