"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, FileText, Paperclip, Plus } from "lucide-react";
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
import { GastosFijosPanel } from "@/components/finanzas/GastosFijosPanel";
import { Checkbox } from "@/components/ui/checkbox";
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
  FINANZAS_SECCION_LABELS,
  finanzasSeccionDesdeParam,
  type FinanzasSeccion,
} from "@/types/workspace";
import {
  CONCEPTOS_MOVIMIENTO,
  METODOS_PAGO,
  etiquetaConcepto,
  etiquetaMetodo,
  acreditarMovimientoTarjeta,
  adjuntarComprobanteMovimiento,
  abrirComprobanteMovimiento,
  listCuentasActivas,
  listMovimientos,
  listSaldosCuentas,
  listTarjetaPendiente,
  registrarMovimientoManual,
  resumenCajaDelDia,
  sugerirCuentaPorMetodo,
  transferirEntreCuentas,
  validarMontoAcreditado,
  type ConceptoMovimiento,
  type CuentaFinancieraRow,
  type MetodoPago,
  type MovimientoCajaRow,
  type SaldoCuentaRow,
} from "@/lib/finanzas-api";
import { fetchSuppliers, type SupplierRow } from "@/lib/suppliers-api";
import { validateFinanzasComprobanteFile } from "@/lib/finanzas-documentos-storage";
import { OtDetalleDialog } from "@/components/produccion/OtDetalleDialog";
import { getOtsDesdePagoId, type OtProduccionItem } from "@/lib/produccion-api";
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

function etiquetaAcreditacion(a: MovimientoCajaRow["acreditacion"]): string | null {
  if (a === "pendiente") return "Tarjeta pendiente";
  if (a === "acreditado") return "Tarjeta acreditada";
  return null;
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
  const [searchParams] = useSearchParams();
  const seccion = useMemo(
    () => finanzasSeccionDesdeParam(searchParams.get("fn")),
    [searchParams],
  );

  if (seccion === "gastos_fijos") {
    return <VistaGastosFijos />;
  }

  return <VistaFinanzasLibro />;
}

function FinanzasShell({
  seccion,
  children,
}: {
  seccion: FinanzasSeccion;
  children: ReactNode;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white">
        <div className="px-8 pt-5 pb-5">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Finanzas · {FINANZAS_SECCION_LABELS[seccion]}
          </h1>
        </div>
      </header>
      <main className="p-8 [scrollbar-gutter:stable]">{children}</main>
    </div>
  );
}

function VistaGastosFijos() {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Finanzas requiere Supabase configurado y la migración M15 aplicada.
      </div>
    );
  }

  return (
    <FinanzasShell seccion="gastos_fijos">
      <GastosFijosPanel />
    </FinanzasShell>
  );
}

function VistaFinanzasLibro() {
  const [saldos, setSaldos] = useState<SaldoCuentaRow[]>([]);
  const [cuentas, setCuentas] = useState<CuentaFinancieraRow[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCajaRow[]>([]);
  const [tarjetaPendiente, setTarjetaPendiente] = useState<MovimientoCajaRow[]>([]);
  const [tarjetaDraft, setTarjetaDraft] = useState<Record<string, { checked: boolean; monto: string }>>({});
  const [fechaAcreditacion, setFechaAcreditacion] = useState(() => new Date().toISOString().slice(0, 10));
  const [cargando, setCargando] = useState(true);
  const [filtroCuenta, setFiltroCuenta] = useState<string>("todas");
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adjuntoTargetId, setAdjuntoTargetId] = useState<string | null>(null);

  const [dialogMov, setDialogMov] = useState(false);
  const [dialogTransf, setDialogTransf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [otDetalle, setOtDetalle] = useState<OtProduccionItem | null>(null);
  const [otDetalleOpen, setOtDetalleOpen] = useState(false);
  const [abriendoOt, setAbriendoOt] = useState(false);
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
    const [s, c, m, r, t] = await Promise.all([
      listSaldosCuentas(),
      listCuentasActivas(),
      listMovimientos({ limit: 100 }),
      resumenCajaDelDia(hoy),
      listTarjetaPendiente(),
    ]);
    void fetchSuppliers().then(setSuppliersFinanzas).catch(() => {});
    if (s.error) toast.error(s.error.message);
    if (c.error) toast.error(c.error.message);
    if (m.error) toast.error(m.error.message);
    if (r.error) toast.error(r.error.message);
    if (t.error) toast.error(t.error.message);
    setSaldos(s.data);
    setCuentas(c.data);
    setMovimientos(m.data);
    setResumenDia(r.data);
    setTarjetaPendiente(t.data);
    setTarjetaDraft((prev) => {
      const next: Record<string, { checked: boolean; monto: string }> = {};
      for (const row of t.data) {
        next[row.id] = prev[row.id] ?? {
          checked: false,
          monto: String(row.monto),
        };
      }
      return next;
    });
    setCargando(false);
  }, [hoy]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const movFiltrados = useMemo(() => {
    if (filtroCuenta === "todas") return movimientos;
    return movimientos.filter((m) => m.cuenta_id === filtroCuenta);
  }, [movimientos, filtroCuenta]);

  const abrirOtDesdeMovimiento = async (m: MovimientoCajaRow) => {
    if (m.referencia_tipo !== "venta_pago" || !m.referencia_id) {
      toast.message("Este movimiento no está ligado a una OT.");
      return;
    }
    if (abriendoOt) return;
    setAbriendoOt(true);
    const res = await getOtsDesdePagoId(m.referencia_id);
    setAbriendoOt(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    const item = res.data[0] ?? null;
    if (!item) {
      toast.error("No hay OT para este cobro.");
      return;
    }
    setOtDetalle(item);
    setOtDetalleOpen(true);
  };

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
      comprobante: comprobanteFile,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(movForm.tipo === "ingreso" ? "Ingreso anotado." : "Egreso anotado.");
    setDialogMov(false);
    setMovForm(emptyMovForm(hoy, movForm.tipo));
    setComprobanteFile(null);
    await recargar();
  }

  async function onAcreditarSeleccion() {
    const seleccion = tarjetaPendiente.filter((m) => tarjetaDraft[m.id]?.checked);
    if (seleccion.length === 0) {
      toast.error("Tildá al menos un cobro pendiente.");
      return;
    }
    if (!fechaAcreditacion.trim()) {
      toast.error("Indicá la fecha de acreditación.");
      return;
    }
    setBusy(true);
    try {
      for (const m of seleccion) {
        const n = Number(String(tarjetaDraft[m.id]?.monto ?? "").replace(",", "."));
        const check = validarMontoAcreditado(Number(m.monto), n);
        if (!check.ok) {
          toast.error(check.error);
          return;
        }
        const res = await acreditarMovimientoTarjeta({
          movimientoId: m.id,
          montoAcreditado: n,
          fecha: fechaAcreditacion,
        });
        if (res.error) {
          toast.error(res.error.message);
          return;
        }
      }
      toast.success(
        seleccion.length === 1
          ? "Acreditación registrada."
          : `${seleccion.length} acreditaciones registradas.`,
      );
      setTarjetaDraft({});
      await recargar();
    } finally {
      setBusy(false);
    }
  }

  async function onElegirComprobante(file: File | null, movimientoId?: string) {
    if (!file) return;
    const err = validateFinanzasComprobanteFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    if (!movimientoId) {
      setComprobanteFile(file);
      return;
    }
    setBusy(true);
    const res = await adjuntarComprobanteMovimiento(movimientoId, file);
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Comprobante adjunto.");
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
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Finanzas · Libro</h1>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMovForm(emptyMovForm(hoy, "egreso"));
                setComprobanteFile(null);
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
            <TabsTrigger value="tarjeta">
              Tarjeta por acreditar
              {tarjetaPendiente.length > 0 ? ` (${tarjetaPendiente.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          </TabsList>

          <TabsContent value="cuentas" className="mt-4">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base">Saldos por forma de pago</CardTitle>
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

          <TabsContent value="tarjeta" className="mt-4">
            <Card>
              <CardHeader className="space-y-3 border-b">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">Tarjeta por acreditar</CardTitle>
                    <p className="text-sm font-normal text-muted-foreground">
                      Se cobró hoy, la plata entra cuando la ves en el banco. Cargá cuánto ingresó de verdad (puede ser menos).
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Fecha de acreditación</Label>
                      <FechaInput value={fechaAcreditacion} onChange={setFechaAcreditacion} />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || tarjetaPendiente.length === 0}
                      onClick={() => void onAcreditarSeleccion()}
                    >
                      Registrar acreditación
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Fecha cobro</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Cobrado</TableHead>
                      <TableHead className="w-40 text-right">Ingresó</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tarjetaPendiente.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          {cargando ? "Cargando…" : "No hay cobros de tarjeta pendientes."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      tarjetaPendiente.map((m) => {
                        const draft = tarjetaDraft[m.id] ?? {
                          checked: false,
                          monto: String(m.monto),
                        };
                        return (
                          <TableRow key={m.id}>
                            <TableCell>
                              <Checkbox
                                checked={draft.checked}
                                onCheckedChange={(v) =>
                                  setTarjetaDraft((prev) => ({
                                    ...prev,
                                    [m.id]: { ...draft, checked: v === true },
                                  }))
                                }
                                aria-label={`Seleccionar cobro ${m.fecha}`}
                              />
                            </TableCell>
                            <TableCell className="tabular-nums text-sm">{m.fecha}</TableCell>
                            <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                              {m.descripcion ?? "Cobro con tarjeta"}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {formatMonto(Number(m.monto), m.moneda)}
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8 text-right"
                                inputMode="decimal"
                                value={draft.monto}
                                onChange={(e) =>
                                  setTarjetaDraft((prev) => ({
                                    ...prev,
                                    [m.id]: { ...draft, monto: e.target.value },
                                  }))
                                }
                              />
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
                      <TableHead>Comprobante</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                          {cargando ? "Cargando…" : "Sin movimientos."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      movFiltrados.map((m) => {
                        const esSalida = m.tipo === "egreso" || m.tipo === "transferencia_salida";
                        const ligaOt = m.referencia_tipo === "venta_pago" && Boolean(m.referencia_id);
                        return (
                          <TableRow
                            key={m.id}
                            className={ligaOt ? "cursor-pointer" : undefined}
                            onClick={() => void abrirOtDesdeMovimiento(m)}
                          >
                            <TableCell className="tabular-nums text-sm">{m.fecha}</TableCell>
                            <TableCell className="text-sm">{etiquetaMetodo(m.metodo)}</TableCell>
                            <TableCell className="text-sm">{etiquetaConcepto(m.concepto)}</TableCell>
                            <TableCell className="text-sm">{etiquetaTipo(m.tipo)}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                              {m.descripcion ?? "—"}
                              {etiquetaAcreditacion(m.acreditacion) ? (
                                <span className="mt-0.5 block text-[11px]">
                                  {etiquetaAcreditacion(m.acreditacion)}
                                  {m.acreditacion === "acreditado" && m.monto_acreditado != null
                                    ? ` · ${formatMonto(Number(m.monto_acreditado), m.moneda)}`
                                    : ""}
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                {m.comprobante_path ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2"
                                    onClick={() =>
                                      void abrirComprobanteMovimiento(m.comprobante_path as string).then((r) => {
                                        if (r.error) toast.error(r.error.message);
                                      })
                                    }
                                  >
                                    <FileText className="h-4 w-4" />
                                    Ver
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2"
                                  onClick={() => {
                                    setAdjuntoTargetId(m.id);
                                    fileInputRef.current?.click();
                                  }}
                                >
                                  <Paperclip className="h-4 w-4" />
                                  {m.comprobante_path ? "Cambiar" : "Adjuntar"}
                                </Button>
                              </div>
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

      <OtDetalleDialog
        item={otDetalle}
        open={otDetalleOpen}
        onOpenChange={(o) => {
          setOtDetalleOpen(o);
          if (!o) setOtDetalle(null);
        }}
        onChanged={() => void recargar()}
        mostrarSaldo
      />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          const id = adjuntoTargetId;
          e.target.value = "";
          setAdjuntoTargetId(null);
          void onElegirComprobante(f, id ?? undefined);
        }}
      />

      <Dialog
        open={dialogMov}
        onOpenChange={(o) => {
          setDialogMov(o);
          if (!o) setComprobanteFile(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Entró o salió plata</DialogTitle>
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
            <div className="space-y-1">
              <Label htmlFor="fin-comp">Comprobante (opcional)</Label>
              <Input
                id="fin-comp"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  void onElegirComprobante(f);
                  if (!f) setComprobanteFile(null);
                }}
              />
              {comprobanteFile ? (
                <p className="text-[11px] text-muted-foreground">{comprobanteFile.name}</p>
              ) : null}
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
                <SelectTrigger className="w-full"><SelectValue placeholder="Elegí el cajón de origen" /></SelectTrigger>
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
                <SelectTrigger className="w-full"><SelectValue placeholder="Elegí el cajón de destino" /></SelectTrigger>
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
