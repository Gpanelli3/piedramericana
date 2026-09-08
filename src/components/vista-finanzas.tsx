"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FechaInput } from "@/components/ui/fecha-input";
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
  DialogDescription,
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
  sugerirCuentaPorMetodo,
  transferirEntreCuentas,
  type ConceptoMovimiento,
  type CuentaFinancieraRow,
  type MetodoPago,
  type MovimientoCajaRow,
  type SaldoCuentaRow,
} from "@/lib/finanzas-api";
import { fetchSuppliers, type SupplierRow } from "@/lib/suppliers-api";
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

function etiquetaCajon(c: { tipo: CuentaFinancieraRow["tipo"]; moneda: "ars" | "usd" }): string {
  return `${etiquetaFormaPago(c.tipo)} ${c.moneda.toUpperCase()}`;
}

function emptyMovForm(hoy: string, tipo: "ingreso" | "egreso" = "egreso") {
  return {
    tipo,
    metodo: "efectivo" as MetodoPago,
    concepto: (tipo === "ingreso" ? "otro" : "gastos") as Exclude<ConceptoMovimiento, "transferencia">,
    monto: "",
    moneda: "ars" as "ars" | "usd",
    fecha: hoy,
    descripcion: "",
    supplier_id: "" as string,
  };
}

function emptyTransfForm(hoy: string) {
  return {
    origenId: "",
    destinoId: "",
    monto: "",
    moneda: "ars" as "ars" | "usd",
    fecha: hoy,
    descripcion: "",
  };
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
  const [suppliersFinanzas, setSuppliersFinanzas] = useState<SupplierRow[]>([]);

  const hoy = new Date().toISOString().slice(0, 10);
  const [resumenDia, setResumenDia] = useState<{
    ingresos: number;
    egresos: number;
    neto: number;
    porMetodo: Record<string, number>;
  } | null>(null);

  const [movForm, setMovForm] = useState(() => emptyMovForm(hoy));

  const conceptosDisponibles = useMemo(
    () =>
      CONCEPTOS_MOVIMIENTO.filter(
        (c) =>
          c.value !== "trabajo" &&
          (c.para === "ambos" || c.para === movForm.tipo),
      ),
    [movForm.tipo],
  );

  const cajonMovimiento = useMemo(() => {
    const id = sugerirCuentaPorMetodo(movForm.metodo, movForm.moneda, cuentas);
    return cuentas.find((c) => c.id === id) ?? null;
  }, [cuentas, movForm.metodo, movForm.moneda]);

  const [transfForm, setTransfForm] = useState(() => emptyTransfForm(hoy));

  const origenTransf = useMemo(
    () => cuentas.find((c) => c.id === transfForm.origenId) ?? null,
    [cuentas, transfForm.origenId],
  );
  const destinoTransf = useMemo(
    () => cuentas.find((c) => c.id === transfForm.destinoId) ?? null,
    [cuentas, transfForm.destinoId],
  );
  const saldoOrigen = useMemo(
    () => saldos.find((s) => s.cuenta_id === transfForm.origenId)?.saldo_actual ?? null,
    [saldos, transfForm.origenId],
  );

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
    void fetchSuppliers().then(setSuppliersFinanzas).catch(() => {});
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
      supplier_id: movForm.supplier_id || null,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(movForm.tipo === "ingreso" ? "Ingreso anotado." : "Egreso anotado.");
    setDialogMov(false);
    setMovForm(emptyMovForm(hoy, movForm.tipo));
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
    toast.success("Plata movida entre cajones.");
    setDialogTransf(false);
    setTransfForm(emptyTransfForm(hoy));
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Finanzas</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Acá ves cuánta plata hay en cada cajón (efectivo, banco, cheques, tarjeta). Los cobros de clientes se cargan en Ventas.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMovForm(emptyMovForm(hoy, "egreso"));
                setDialogMov(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Entró o salió plata
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTransfForm(emptyTransfForm(hoy));
                setDialogTransf(true);
              }}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Mover entre cajas
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Entró o salió plata</DialogTitle>
            <DialogDescription>
              Para un movimiento suelto (nafta, alquiler, un ingreso extra). El cobro de un trabajo se carga en Ventas, no acá.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setMovForm((f) => ({
                    ...f,
                    tipo: "ingreso",
                    concepto: "otro",
                    supplier_id: "",
                  }))
                }
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors",
                  movForm.tipo === "ingreso"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/60",
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <ArrowDownLeft className="h-4 w-4 text-green-700" />
                  Entró plata
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">Suma al cajón</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setMovForm((f) => ({
                    ...f,
                    tipo: "egreso",
                    concepto: "gastos",
                  }))
                }
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors",
                  movForm.tipo === "egreso"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/60",
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <ArrowUpRight className="h-4 w-4 text-destructive" />
                  Salió plata
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">Resta del cajón</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cómo se pagó</Label>
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
              <div className="space-y-1">
                <Label>Moneda</Label>
                <Select
                  value={movForm.moneda}
                  onValueChange={(v) => setMovForm((f) => ({ ...f, moneda: v as "ars" | "usd" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ars">Pesos</SelectItem>
                    <SelectItem value="usd">Dólares</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {conceptosDisponibles.length > 1 ? (
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
              ) : null}
              <div className={cn("space-y-1", conceptosDisponibles.length <= 1 && "col-span-2")}>
                <Label>Monto</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0"
                  value={movForm.monto}
                  onChange={(e) => setMovForm((f) => ({ ...f, monto: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Fecha</Label>
              <FechaInput value={movForm.fecha} onChange={(iso) => setMovForm((f) => ({ ...f, fecha: iso }))} />
            </div>
            <div className="space-y-1">
              <Label>Para qué fue</Label>
              <Textarea
                rows={2}
                placeholder={
                  movForm.tipo === "ingreso"
                    ? "Ej: devolución, venta de recorte…"
                    : "Ej: nafta, viático, alquiler…"
                }
                value={movForm.descripcion}
                onChange={(e) => setMovForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </div>
            {movForm.tipo === "egreso" ? (
              <div className="space-y-1">
                <Label>Proveedor (si aplica)</Label>
                <Select
                  value={movForm.supplier_id || "__none__"}
                  onValueChange={(v) => setMovForm((f) => ({ ...f, supplier_id: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin proveedor</SelectItem>
                    {suppliersFinanzas.filter((s) => s.activo !== false).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <p
              className={cn(
                "rounded-md px-3 py-2 text-xs",
                cajonMovimiento ? "bg-muted text-muted-foreground" : "bg-amber-50 text-amber-800",
              )}
            >
              {cajonMovimiento
                ? `Se anota en el cajón ${etiquetaCajon(cajonMovimiento)}.`
                : "No hay un cajón para esa forma de pago y moneda."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMov(false)}>Cancelar</Button>
            <Button disabled={busy || !cajonMovimiento} onClick={() => void onRegistrarMovimiento()}>
              {movForm.tipo === "ingreso" ? "Anotar ingreso" : "Anotar egreso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogTransf} onOpenChange={setDialogTransf}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover entre cajas</DialogTitle>
            <DialogDescription>
              No es plata nueva: sale de un cajón y entra en otro. Ejemplo: depositás efectivo en el banco.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Sale de</Label>
              <Select
                value={transfForm.origenId || undefined}
                onValueChange={(v) => {
                  const c = cuentas.find((x) => x.id === v);
                  setTransfForm((f) => ({
                    ...f,
                    origenId: v,
                    moneda: c?.moneda ?? f.moneda,
                  }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Elegí el cajón de origen" /></SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {etiquetaCajon(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {origenTransf && saldoOrigen != null ? (
                <p className="text-[11px] text-muted-foreground">
                  Saldo actual: {formatMonto(Number(saldoOrigen), origenTransf.moneda)}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Entra en</Label>
              <Select
                value={transfForm.destinoId || undefined}
                onValueChange={(v) => setTransfForm((f) => ({ ...f, destinoId: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Elegí el cajón de destino" /></SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={c.id === transfForm.origenId}>
                      {etiquetaCajon(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {origenTransf && destinoTransf ? (
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                <span className="font-medium">{etiquetaCajon(origenTransf)}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{etiquetaCajon(destinoTransf)}</span>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monto</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0"
                  value={transfForm.monto}
                  onChange={(e) => setTransfForm((f) => ({ ...f, monto: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Fecha</Label>
                <FechaInput value={transfForm.fecha} onChange={(iso) => setTransfForm((f) => ({ ...f, fecha: iso }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nota (opcional)</Label>
              <Input
                placeholder="Ej: depósito en el banco"
                value={transfForm.descripcion}
                onChange={(e) => setTransfForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTransf(false)}>Cancelar</Button>
            <Button disabled={busy} onClick={() => void onTransferir()}>Mover plata</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
