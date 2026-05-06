"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  MapPin,
  AlertTriangle,
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

function estadoBadge(estado: OTFinanciera["estado"]) {
  switch (estado) {
    case "al-dia":
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 font-semibold text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Al día
        </Badge>
      );
    case "bloqueada":
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 font-semibold text-xs">
          <XCircle className="h-3 w-3 mr-1" />
          Falta Seña — Obra Bloqueada
        </Badge>
      );
    case "saldo-pendiente":
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-semibold text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Saldo Pendiente
        </Badge>
      );
  }
}

export function VistaAdministracion() {
  const [expedienteAbierto, setExpedienteAbierto] = useState(false);
  const [otSeleccionada, setOtSeleccionada] = useState<OTFinanciera | null>(null);

  function abrirExpediente(ot: OTFinanciera) {
    setOtSeleccionada(ot);
    setExpedienteAbierto(true);
  }

  const totalCuentasCobrar = ots.reduce(
    (acc, ot) => acc + (ot.totalUSD - ot.senaUSD),
    0
  );
  const totalSenasRecibidas = ots.reduce((acc, ot) => acc + ot.senaUSD, 0);
  const otsConSena = ots.filter((ot) => ot.senaUSD === 0).length;

  return (
    <div className="flex-1 flex flex-col bg-background overflow-auto">
      {/* Header */}
      <header className="bg-card border-b border-border px-8 py-5 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Administración y Cuentas Corrientes
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Seguimiento financiero de obras activas
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
            <DollarSign className="h-3.5 w-3.5" />
            Cotización hoy: 1 USD = $1.180 ARS
          </div>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-border shadow-sm">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Caja Diaria
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    $2.124.000
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">ARS</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-green-700" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Ingresos hoy: <span className="text-green-600 font-semibold">$840.000</span>
                  &nbsp;·&nbsp;
                  Egresos: <span className="text-red-500 font-semibold">$312.000</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Cuentas por Cobrar
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    USD ${totalCuentasCobrar.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    En {ots.filter((o) => o.totalUSD > o.senaUSD).length} obras activas
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-700" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Señas recibidas: <span className="text-foreground font-semibold">USD ${totalSenasRecibidas.toLocaleString()}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Señas Pendientes
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {otsConSena}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {otsConSena === 1 ? "obra bloqueada sin seña" : "obras bloqueadas sin seña"}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-red-700" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Monto en riesgo:{" "}
                  <span className="text-red-600 font-semibold">
                    USD ${ots.filter((o) => o.senaUSD === 0).reduce((a, o) => a + o.totalUSD, 0).toLocaleString()}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de OTs */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground">
                Seguimiento de Pagos por Obra
              </CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Nuevo Ingreso
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold text-muted-foreground pl-6">OT / Obra</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Total Acordado</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Seña Pagada</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Saldo Deudor</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Estado Financiero</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground pr-6">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ots.map((ot) => {
                  const saldo = ot.totalUSD - ot.senaUSD;
                  const porcentaje =
                    ot.totalUSD > 0
                      ? Math.round((ot.senaUSD / ot.totalUSD) * 100)
                      : 0;
                  return (
                    <TableRow
                      key={ot.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => abrirExpediente(ot)}
                    >
                      <TableCell className="pl-6 py-4">
                        <div>
                          <span className="font-semibold text-accent text-sm">
                            OT #{ot.id}
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5 max-w-[180px] truncate">
                            {ot.obra}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-foreground font-medium">
                        {ot.cliente}
                      </TableCell>
                      <TableCell className="text-sm text-foreground font-semibold">
                        USD ${ot.totalUSD.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span className="text-sm text-foreground font-semibold">
                            USD ${ot.senaUSD.toLocaleString()}
                          </span>
                          {/* Progress bar */}
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={
                                porcentaje === 0
                                  ? "h-full bg-red-400 rounded-full"
                                  : porcentaje === 100
                                  ? "h-full bg-green-500 rounded-full"
                                  : "h-full bg-amber-400 rounded-full"
                              }
                              style={{ width: `${porcentaje}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {porcentaje}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            saldo === 0
                              ? "text-sm font-semibold text-green-600"
                              : "text-sm font-semibold text-red-600"
                          }
                        >
                          {saldo === 0 ? "—" : `USD $${saldo.toLocaleString()}`}
                        </span>
                      </TableCell>
                      <TableCell>{estadoBadge(ot.estado)}</TableCell>
                      <TableCell className="pr-6">
                        {ot.estado === "bloqueada" ? (
                          <Button
                            size="sm"
                            className="text-xs bg-primary text-primary-foreground h-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirExpediente(ot);
                            }}
                          >
                            Registrar Pago Inicial
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirExpediente(ot);
                            }}
                          >
                            Ver Expediente
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modal Expediente */}
      <Dialog open={expedienteAbierto} onOpenChange={setExpedienteAbierto}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Expediente de Obra — OT #{otSeleccionada?.id}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {otSeleccionada?.cliente} · {otSeleccionada?.obra}
                </p>
              </div>
            </div>
          </DialogHeader>

          {otSeleccionada && (
            <div className="space-y-5 pt-2">
              {/* Info rápida */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Cliente</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{otSeleccionada.cliente}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Estado</span>
                  </div>
                  <div>{estadoBadge(otSeleccionada.estado)}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Total acordado</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    USD ${otSeleccionada.totalUSD.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Resumen financiero */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2.5 border-b border-border">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Resumen de Pagos
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {otSeleccionada.id === "1042" ? (
                    pagos1042.map((pago, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm text-foreground font-medium">{pago.concepto}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {pago.fecha} · {pago.metodo}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-green-600">
                          + USD ${pago.montoUSD.toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-4 flex items-center gap-3 text-muted-foreground">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      <p className="text-sm">Sin pagos registrados. La obra está bloqueada.</p>
                    </div>
                  )}
                </div>

                {/* Totales */}
                <div className="bg-muted/30 px-4 py-3 border-t border-border space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Total acordado</span>
                    <span className="font-medium text-foreground">
                      USD ${otSeleccionada.totalUSD.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Señas / pagos recibidos</span>
                    <span className="font-medium text-green-600">
                      − USD ${otSeleccionada.senaUSD.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-border pt-1.5">
                    <span className="text-foreground">Saldo deudor</span>
                    <span
                      className={
                        otSeleccionada.totalUSD - otSeleccionada.senaUSD === 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      USD ${(otSeleccionada.totalUSD - otSeleccionada.senaUSD).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Adicionales en obra */}
              <div className="border border-amber-200 rounded-lg overflow-hidden">
                <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                      Adicionales en Obra
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Agregar
                  </Button>
                </div>

                {otSeleccionada.id === "1042" ? (
                  <div className="divide-y divide-amber-100">
                    {adicionales1042.map((ad) => (
                      <div key={ad.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-foreground font-medium">{ad.descripcion}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3" />
                            {ad.fecha} · {ad.motivo}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-bold text-amber-700">
                            + USD ${ad.montoUSD}
                          </span>
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                            Pendiente cobro
                          </Badge>
                        </div>
                      </div>
                    ))}
                    <div className="bg-amber-50/50 px-4 py-2.5 flex justify-between items-center">
                      <span className="text-xs text-muted-foreground font-medium">
                        Total adicionales
                      </span>
                      <span className="text-sm font-bold text-amber-700">
                        + USD ${adicionales1042.reduce((a, ad) => a + ad.montoUSD, 0)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-4">
                    <p className="text-sm text-muted-foreground">
                      Sin adicionales registrados para esta obra.
                    </p>
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpedienteAbierto(false)}
                >
                  Cerrar
                </Button>
                {otSeleccionada.estado === "bloqueada" ? (
                  <Button size="sm" className="bg-primary text-primary-foreground gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Registrar Pago Inicial
                  </Button>
                ) : (
                  <Button size="sm" className="bg-primary text-primary-foreground gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Cobrar Saldo USD ${(otSeleccionada.totalUSD - otSeleccionada.senaUSD).toLocaleString()}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
