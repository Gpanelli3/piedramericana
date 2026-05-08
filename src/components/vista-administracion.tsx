"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  ChevronRight,
  FileText,
  DollarSign,
  Calendar,
  User,
  Search,
} from "lucide-react";

type OTFinanciera = {
  id: string;
  cliente: string;
  obra: string;
  totalUSD: number;
  senaUSD: number;
  moneda: "USD" | "ARS";
  estado: "al-dia" | "bloqueada" | "saldo-pendiente";
};

const ots: OTFinanciera[] = [
  {
    id: "1042",
    cliente: "Familia Pérez",
    obra: "Mesada Cocina - Puan 1340, CABA",
    totalUSD: 1500,
    senaUSD: 750,
    moneda: "USD",
    estado: "al-dia",
  },
  {
    id: "1045",
    cliente: "Arq. Gómez",
    obra: "Baño Principal - Av. Rivadavia 5200, CABA",
    totalUSD: 2200,
    senaUSD: 0,
    moneda: "USD",
    estado: "bloqueada",
  },
  {
    id: "1038",
    cliente: "Estudio Valeria Ponce",
    obra: "Mesada + Zócalos - San Martín 88, Tigre",
    totalUSD: 3400,
    senaUSD: 1700,
    moneda: "USD",
    estado: "saldo-pendiente",
  },
  {
    id: "1031",
    cliente: "Jorge Mansilla",
    obra: "Encimera Baño - Belgrano 1100, GBA",
    totalUSD: 980,
    senaUSD: 980,
    moneda: "USD",
    estado: "al-dia",
  },
];

type Pago = {
  fecha: string;
  concepto: string;
  montoUSD: number;
  metodo: string;
};

const pagos1042: Pago[] = [
  {
    fecha: "28/04/2025",
    concepto: "Seña inicial (50%)",
    montoUSD: 750,
    metodo: "Transferencia",
  },
];

const adicionales1042 = [
  {
    id: 1,
    descripcion: "Cambio a bacha Johnson Luxor",
    montoUSD: 45,
    fecha: "12/05/2025",
    motivo: "Añadido tras medición en obra",
    estado: "pendiente-cobro",
  },
  {
    id: 2,
    descripcion: "Zócalo lateral adicional 0.45 ml",
    montoUSD: 18,
    fecha: "14/05/2025",
    motivo: "Solicitado por cliente en obra",
    estado: "pendiente-cobro",
  },
];

function estadoBadge(estado: OTFinanciera["estado"], compact?: boolean) {
  switch (estado) {
    case "al-dia":
      return (
        <Badge
          variant="secondary"
          className="border border-green-200 bg-green-50 text-green-800 font-medium text-xs gap-1"
        >
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Al día
        </Badge>
      );
    case "bloqueada":
      return (
        <Badge
          variant="secondary"
          className="border border-red-200 bg-red-50 text-red-800 font-medium text-xs gap-1"
        >
          <XCircle className="h-3 w-3 shrink-0" aria-hidden />
          {compact ? "Sin seña" : "Sin seña · obra detenida"}
        </Badge>
      );
    case "saldo-pendiente":
      return (
        <Badge
          variant="secondary"
          className="border border-amber-200 bg-amber-50 text-amber-900 font-medium text-xs gap-1"
        >
          <Clock className="h-3 w-3" aria-hidden />
          Saldo pendiente
        </Badge>
      );
  }
}

function formatUsdAmount(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Mock: suma de adicionales pendientes de cobro por OT (conectar a backend después). */
function adicionalesPendientesUSD(otId: string): number {
  if (otId === "1042") return adicionales1042.reduce((a, x) => a + x.montoUSD, 0);
  return 0;
}

export function VistaAdministracion() {
  const [expedienteAbierto, setExpedienteAbierto] = useState(false);
  const [otSeleccionada, setOtSeleccionada] = useState<OTFinanciera | null>(null);
  const [busqueda, setBusqueda] = useState("");

  function abrirExpediente(ot: OTFinanciera) {
    setOtSeleccionada(ot);
    setExpedienteAbierto(true);
  }

  const otsFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ots;
    return ots.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.cliente.toLowerCase().includes(q) ||
        o.obra.toLowerCase().includes(q)
    );
  }, [busqueda]);

  const otExp = otSeleccionada;
  const saldoContratoExp = otExp ? otExp.totalUSD - otExp.senaUSD : 0;
  const extrasExp = otExp ? adicionalesPendientesUSD(otExp.id) : 0;
  const totalACobrarExp = saldoContratoExp + extrasExp;

  const totalCuentasCobrar = ots.reduce(
    (acc, ot) => acc + (ot.totalUSD - ot.senaUSD),
    0
  );
  const totalSenasRecibidas = ots.reduce((acc, ot) => acc + ot.senaUSD, 0);
  const otsSinSena = ots.filter((ot) => ot.senaUSD === 0).length;
  const montoRiesgoUSD = ots
    .filter((o) => o.senaUSD === 0)
    .reduce((a, o) => a + o.totalUSD, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <header className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Ventas — Caja y cuentas corrientes
            </h1>
            <p className="text-sm text-muted-foreground">
              Cobranzas, señas y saldos por obra. La caja del día en pesos; contratos en dólares (mock).
            </p>
          </div>
          <p className="shrink-0 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Dólar ref.</span> 1 USD = $1.180 ARS
          </p>
        </div>
      </header>

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border shadow-sm">
            <CardContent className="flex gap-4 p-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Wallet className="h-5 w-5 text-foreground/80" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Caja diaria (ARS)</p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  $2.124.000
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-700 dark:text-green-400">+ $840.000</span> ingresos ·{" "}
                  <span className="text-red-600 dark:text-red-400">− $312.000</span> egresos
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="flex gap-4 p-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <TrendingUp className="h-5 w-5 text-foreground/80" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Por cobrar (USD)</p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  USD {formatUsdAmount(totalCuentasCobrar)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ots.filter((o) => o.totalUSD > o.senaUSD).length} obras con saldo · Señas recibidas USD{" "}
                  {formatUsdAmount(totalSenasRecibidas)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm sm:col-span-2 lg:col-span-1">
            <CardContent className="flex gap-4 p-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-5 w-5 text-foreground/80" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Sin seña (obras detenidas)</p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {otsSinSena}
                </p>
                <p className="text-xs text-muted-foreground">
                  Riesgo contrato: USD{" "}
                  <span className="font-medium text-amber-900 dark:text-amber-200">
                    {formatUsdAmount(montoRiesgoUSD)}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-4 border-b border-border pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Obras y pagos
                </CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Tocá una fila o usá el botón para abrir el expediente.
                </p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por OT, cliente u obra…"
                  className="h-9 w-full pl-9 sm:w-[260px]"
                  aria-label="Filtrar obras"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="whitespace-nowrap pl-4 text-xs font-medium text-muted-foreground sm:pl-6">
                      Obra
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Contrato (USD)
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Avance
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Falta (USD)
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Estado
                    </TableHead>
                    <TableHead className="whitespace-nowrap pr-4 text-right text-xs font-medium text-muted-foreground sm:pr-6">
                      Acción
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otsFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No hay resultados para «{busqueda}».
                      </TableCell>
                    </TableRow>
                  ) : (
                    otsFiltradas.map((ot) => {
                      const saldo = ot.totalUSD - ot.senaUSD;
                      const porcentaje =
                        ot.totalUSD > 0 ? Math.round((ot.senaUSD / ot.totalUSD) * 100) : 0;
                      return (
                        <TableRow
                          key={ot.id}
                          className="cursor-pointer transition-colors hover:bg-muted/50"
                          onClick={() => abrirExpediente(ot)}
                        >
                          <TableCell className="max-w-[220px] py-3 pl-4 sm:max-w-[280px] sm:pl-6">
                            <p className="text-sm font-medium text-accent">OT #{ot.id}</p>
                            <p className="truncate text-xs text-muted-foreground">{ot.cliente}</p>
                            <p className="line-clamp-2 text-xs text-muted-foreground/90">{ot.obra}</p>
                          </TableCell>
                          <TableCell className="py-3 tabular-nums text-sm font-medium">
                            {formatUsdAmount(ot.totalUSD)}
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex w-[7rem] flex-col gap-1">
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    porcentaje === 0
                                      ? "bg-red-400"
                                      : porcentaje === 100
                                        ? "bg-green-600"
                                        : "bg-amber-500"
                                  )}
                                  style={{ width: `${porcentaje}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                {formatUsdAmount(ot.senaUSD)} · {porcentaje}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 tabular-nums text-sm font-semibold">
                            {saldo === 0 ? (
                              <span className="font-medium text-green-700 dark:text-green-400">Listo</span>
                            ) : (
                              <span className="text-destructive">{formatUsdAmount(saldo)}</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3">{estadoBadge(ot.estado)}</TableCell>
                          <TableCell className="py-3 pr-4 text-right sm:pr-6">
                            {ot.estado === "bloqueada" ? (
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirExpediente(ot);
                                }}
                              >
                                Registrar seña
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirExpediente(ot);
                                }}
                              >
                                Expediente
                                <ChevronRight className="h-3 w-3 opacity-70" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={expedienteAbierto} onOpenChange={setExpedienteAbierto}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 space-y-3 border-b border-border px-5 pb-4 pt-5 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-foreground" aria-hidden />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold leading-snug sm:text-lg">
                  OT #{otSeleccionada?.id}
                </DialogTitle>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {otSeleccionada?.obra}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1 font-normal">
                <User className="h-3 w-3" aria-hidden />
                {otSeleccionada?.cliente}
              </Badge>
              {otSeleccionada ? estadoBadge(otSeleccionada.estado, true) : null}
            </div>
          </DialogHeader>

          {otSeleccionada ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground">Pagos registrados</h3>
                  {otSeleccionada.id === "1042" ? (
                    <ul className="space-y-2">
                      {pagos1042.map((pago, i) => (
                        <li
                          key={i}
                          className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{pago.concepto}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                              {pago.fecha} · {pago.metodo}
                            </p>
                          </div>
                          <span className="shrink-0 tabular-nums font-semibold text-green-700 dark:text-green-400">
                            +{formatUsdAmount(pago.montoUSD)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                      Sin pagos cargados. Registrá la seña para desbloquear la obra.
                    </p>
                  )}

                  <Separator className="my-4" />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4 text-muted-foreground">
                      <span>Total acordado</span>
                      <span className="tabular-nums font-medium text-foreground">
                        USD {formatUsdAmount(otSeleccionada.totalUSD)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 text-muted-foreground">
                      <span>Pagado</span>
                      <span className="tabular-nums font-medium text-green-700 dark:text-green-400">
                        − USD {formatUsdAmount(otSeleccionada.senaUSD)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-border pt-2 font-medium text-foreground">
                      <span>Saldo contrato</span>
                      <span
                        className={cn(
                          "tabular-nums",
                          saldoContratoExp === 0
                            ? "text-green-700 dark:text-green-400"
                            : "text-destructive"
                        )}
                      >
                        USD {formatUsdAmount(saldoContratoExp)}
                      </span>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-foreground">Adicionales en obra</h3>
                    <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                      <Plus className="h-3.5 w-3.5" />
                      Agregar
                    </Button>
                  </div>
                  {otSeleccionada.id === "1042" ? (
                    <ul className="space-y-2">
                      {adicionales1042.map((ad) => (
                        <li
                          key={ad.id}
                          className="flex flex-col gap-1 rounded-md border border-border px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{ad.descripcion}</p>
                            <p className="text-xs text-muted-foreground">{ad.fecha}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="tabular-nums font-semibold text-foreground">
                              +{formatUsdAmount(ad.montoUSD)}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-normal">
                              A cobrar
                            </Badge>
                          </div>
                        </li>
                      ))}
                      <li className="flex justify-between rounded-md bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                        <span>Subtotal adicionales</span>
                        <span className="tabular-nums text-foreground">
                          USD {formatUsdAmount(extrasExp)}
                        </span>
                      </li>
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin adicionales en esta obra.</p>
                  )}

                  {otSeleccionada.estado !== "bloqueada" && totalACobrarExp > 0 ? (
                    <div className="mt-6 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Monto del próximo registro
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Importe del próximo registro de cobro en esta obra (contrato + adicionales pendientes, si
                        hay).
                      </p>
                      <div className="space-y-2 rounded-md border border-border bg-background px-3 py-3 text-sm">
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>Saldo contrato</span>
                          <span className="tabular-nums font-medium text-foreground">
                            USD {formatUsdAmount(saldoContratoExp)}
                          </span>
                        </div>
                        {extrasExp > 0 ? (
                          <div className="flex justify-between gap-4 text-muted-foreground">
                            <span>Adicionales pendientes</span>
                            <span className="tabular-nums font-medium text-foreground">
                              USD {formatUsdAmount(extrasExp)}
                            </span>
                          </div>
                        ) : null}
                        <Separator />
                        <div className="flex justify-between gap-4 text-base font-semibold text-foreground">
                          <span>Total a registrar</span>
                          <span className="tabular-nums">USD {formatUsdAmount(totalACobrarExp)}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setExpedienteAbierto(false)}
                >
                  Cerrar
                </Button>
                {otSeleccionada.estado === "bloqueada" ? (
                  <Button type="button" className="w-full gap-1.5 sm:w-auto">
                    <Plus className="h-4 w-4" />
                    Registrar pago / seña
                  </Button>
                ) : totalACobrarExp > 0 ? (
                  <Button type="button" className="w-full gap-1.5 sm:w-auto">
                    <DollarSign className="h-4 w-4" />
                    Registrar cobro
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled>
                    Sin monto pendiente
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
