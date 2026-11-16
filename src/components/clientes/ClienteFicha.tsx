"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpen, FileText, User, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";
import { AprobarPresupuestoDialog } from "@/components/presupuesto/AprobarPresupuestoDialog";
import { ElegirChapaReemplazoDialog } from "@/components/presupuesto/ElegirChapaReemplazoDialog";
import { PresupuestoDetallePanel } from "@/components/presupuesto/PresupuestoDetallePanel";
import { etiquetaVentaEstado, formatFechaCorta } from "@/components/produccion/ot-ui";
import { ComprobanteCobrosSheet } from "@/components/venta/ComprobanteCobrosSheet";
import { VentaCobrosDialog, type VentaCobrosResumen } from "@/components/venta/VentaCobrosDialog";
import { etiquetaMetodo } from "@/lib/finanzas-api";
import {
  fetchClienteFicha,
  type ClienteFichaData,
  type ClienteFichaMovimiento,
  type ClienteFichaPresupuesto,
  type ClienteFichaVenta,
  type ClientePresupuesto,
} from "@/lib/clients-api";
import { enviarAProduccionSiCorresponde } from "@/lib/produccion-api";
import { eliminarPresupuestoPendiente } from "@/lib/presupuestos-api";
import {
  aprobarPresupuestoConVentaInicial,
  type ChapaReservaPendiente,
} from "@/lib/ventas-api";
import type { PresupuestoEstado } from "@/types/database";
import { cn } from "@/lib/utils";

function fmtMonto(n: number, moneda: "ars" | "usd") {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: moneda === "usd" ? 2 : 0,
    maximumFractionDigits: moneda === "usd" ? 2 : 0,
  };
  if (moneda === "usd") return `USD ${n.toLocaleString("es-AR", opts)}`;
  return `$ ${n.toLocaleString("es-AR", opts)}`;
}

function fmtFechaIso(iso: string) {
  return formatFechaCorta(iso) === "—" ? iso.slice(0, 10) : formatFechaCorta(iso);
}

function statusLabel(s: PresupuestoEstado): string {
  if (s === "pendiente") return "Pendiente";
  if (s === "aprobado") return "Aprobado";
  return "Rechazado";
}

function badgeTone(s: PresupuestoEstado) {
  if (s === "pendiente") return "border-amber-300 bg-amber-50 text-amber-900";
  if (s === "aprobado") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  return "border-rose-300 bg-rose-50 text-rose-900";
}

type ClienteFichaProps = {
  cliente: ClientePresupuesto;
  onBack: () => void;
  onUpdated: (c: ClientePresupuesto) => void;
  dialogAbierto: boolean;
  setDialogAbierto: (v: boolean) => void;
  onEdit: () => void;
};

export function ClienteFicha({
  cliente,
  onBack,
  onUpdated,
  dialogAbierto,
  setDialogAbierto,
  onEdit,
}: ClienteFichaProps) {
  const [, setSearchParams] = useSearchParams();
  const [act, setAct] = useState<ClienteFichaData | null>(null);
  const [cargando, setCargando] = useState(true);

  const [comprobanteMov, setComprobanteMov] = useState<ClienteFichaMovimiento | null>(null);
  const [comprobanteOpen, setComprobanteOpen] = useState(false);
  const [presupuestoPid, setPresupuestoPid] = useState<string | null>(null);
  const [presupuestoOpen, setPresupuestoOpen] = useState(false);
  const [detalleRefresh, setDetalleRefresh] = useState(0);
  const [statusBusy, setStatusBusy] = useState(false);

  const [ventaPid, setVentaPid] = useState<string | null>(null);
  const [ventaOpen, setVentaOpen] = useState(false);
  const [ventaResumen, setVentaResumen] = useState<VentaCobrosResumen | null>(null);

  const [aprobDialogAbierto, setAprobDialogAbierto] = useState(false);
  const [aprobDialogRow, setAprobDialogRow] = useState<ClienteFichaPresupuesto | null>(null);
  const [aprobBusy, setAprobBusy] = useState(false);
  const [chapasPendientes, setChapasPendientes] = useState<ChapaReservaPendiente[]>([]);
  const [reemplazoOpen, setReemplazoOpen] = useState(false);

  const recargar = useCallback(async (opts?: { silencioso?: boolean }) => {
    if (!opts?.silencioso) setCargando(true);
    const res = await fetchClienteFicha(cliente.id, cliente.nombre);
    if (res.error) {
      toast.error(res.error.message);
      setAct(null);
    } else {
      setAct(res.data);
    }
    setCargando(false);
  }, [cliente.id, cliente.nombre]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const abrirComprobante = (m: ClienteFichaMovimiento) => {
    setComprobanteMov(m);
    setComprobanteOpen(true);
  };

  const abrirPresupuesto = (id: string) => {
    setPresupuestoPid(id);
    setPresupuestoOpen(true);
  };

  const abrirVenta = (v: ClienteFichaVenta) => {
    setVentaPid(v.presupuestoId);
    setVentaResumen({
      cliente: cliente.nombre,
      numero: v.numero,
      total: v.total,
      moneda: v.moneda,
    });
    setVentaOpen(true);
  };

  const irAEditar = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("ws", "ventas");
          n.set("pv", "nuevo");
          n.set("id", id);
          n.delete("cid");
          n.delete("rid");
          n.delete("pid");
          n.delete("ft");
          n.delete("ot");
          n.delete("eq");
          return n;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const iniciarAprobacion = useCallback(
    (id: string) => {
      const r = act?.presupuestos.find((x) => x.id === id);
      if (!r || r.status !== "pendiente") return;
      setAprobDialogRow(r);
      setAprobDialogAbierto(true);
    },
    [act],
  );

  const onConfirmacionAprobar = useCallback(
    async (payload: {
      totalAprobado: number;
      montoSenia: number;
      fecha: string;
      metodo: string;
      nota: string;
      retencionPorcentaje?: number;
      retencionMonto?: number;
      comprobante?: File | null;
    }) => {
      if (!aprobDialogRow) return;
      setAprobBusy(true);
      const res = await aprobarPresupuestoConVentaInicial({
        presupuestoId: aprobDialogRow.id,
        totalAprobado: payload.totalAprobado,
        montoSenia: payload.montoSenia,
        fecha: payload.fecha,
        metodo: payload.metodo,
        nota: payload.nota || undefined,
        created_by: null,
        retencionPorcentaje: payload.retencionPorcentaje,
        retencionMonto: payload.retencionMonto,
        comprobante: payload.comprobante,
      });
      setAprobBusy(false);
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      setAprobDialogAbierto(false);
      setAprobDialogRow(null);
      if (res.chapasPendientes && res.chapasPendientes.length > 0) {
        toast.warning("Algunas chapas señaladas ya no están disponibles. Elegí reemplazo.");
        setChapasPendientes(res.chapasPendientes);
        setReemplazoOpen(true);
      } else {
        toast.success(
          payload.montoSenia > 0
            ? "Aprobado con seña. Chapas señaladas reservadas si había stock."
            : "Aprobado. Podés registrar la primera seña cuando quieras desde Ventas.",
        );
      }
      if (payload.montoSenia > 0) {
        const envio = await enviarAProduccionSiCorresponde(aprobDialogRow.id);
        if (envio.error) toast.error(envio.error.message);
        else if (envio.enviado) toast.success("Ya tenía medidas: pasó a producción.");
      }
      setDetalleRefresh((n) => n + 1);
      await recargar({ silencioso: true });
    },
    [aprobDialogRow, recargar],
  );

  const onRechazar = useCallback(
    async (id: string) => {
      const row = act?.presupuestos.find((r) => r.id === id);
      const etiqueta = row ? `${row.numero} · ${cliente.nombre}` : "este presupuesto";
      if (
        !window.confirm(
          `¿Borrar ${etiqueta}?\nSale de medición y no queda historial.`,
        )
      ) {
        return;
      }
      setStatusBusy(true);
      const res = await eliminarPresupuestoPendiente(id);
      setStatusBusy(false);
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Presupuesto eliminado.");
      setPresupuestoOpen(false);
      await recargar({ silencioso: true });
    },
    [act, cliente.nombre, recargar],
  );

  const hayUsd = Boolean(
    act &&
      (act.saldoUsd > 0.009 ||
        act.cobradoUsd > 0.009 ||
        act.movimientos.some((m) => m.moneda === "usd")),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{cliente.nombre}</h2>
            {cliente.esAgenteRetencion ? (
              <Badge variant="outline" className="shrink-0 text-[10px] font-medium">
                Retención
                {cliente.retencionPorcentaje != null ? ` ${cliente.retencionPorcentaje}%` : ""}
              </Badge>
            ) : null}
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
          <User className="h-3.5 w-3.5" />
          Ver datos personales
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Saldo
            </p>
            {cargando ? (
              <p className="mt-1 text-lg font-semibold">…</p>
            ) : (
              <div className="mt-1 space-y-0.5">
                <p className="text-xl font-semibold tabular-nums tracking-tight">
                  {fmtMonto(act?.saldoArs ?? 0, "ars")}
                </p>
                {hayUsd ? (
                  <p className="text-sm font-medium tabular-nums text-muted-foreground">
                    {fmtMonto(act?.saldoUsd ?? 0, "usd")}
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Cobrado
            </p>
            {cargando ? (
              <p className="mt-1 text-lg font-semibold">…</p>
            ) : (
              <div className="mt-1 space-y-0.5">
                <p className="text-xl font-semibold tabular-nums tracking-tight">
                  {fmtMonto(act?.cobradoArs ?? 0, "ars")}
                </p>
                {hayUsd ? (
                  <p className="text-sm font-medium tabular-nums text-muted-foreground">
                    {fmtMonto(act?.cobradoUsd ?? 0, "usd")}
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cuenta-corriente" className="gap-3">
        <TabsList>
          <TabsTrigger value="cuenta-corriente" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Cuenta corriente ({act?.movimientos.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="presupuestos" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Presupuestos ({act?.presupuestos.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="ventas" className="gap-1.5">
            <Wallet className="h-3.5 w-3.5" />
            Ventas ({act?.ventas.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cuenta-corriente">
          {cargando ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : !act?.movimientos.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no hay movimientos en la cuenta corriente.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Debe</TableHead>
                    <TableHead className="text-right">Haber</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {act.movimientos.map((m) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer"
                      onClick={() => abrirComprobante(m)}
                    >
                      <TableCell className="whitespace-nowrap">{fmtFechaIso(m.fecha)}</TableCell>
                      <TableCell>
                        <p className="font-medium">
                          {m.tipo === "cargo" ? `Cargo ${m.numero}` : `Pago ${m.numero}`}
                        </p>
                        {m.tipo === "pago" ? (
                          <p className="text-xs text-muted-foreground">
                            {etiquetaMetodo(m.metodo)}
                            {m.nota?.trim() ? ` · ${m.nota.trim()}` : ""}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.debe > 0.009 ? fmtMonto(m.debe, m.moneda) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-green-700 dark:text-green-400">
                        {m.haber > 0.009 ? fmtMonto(m.haber, m.moneda) : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          m.saldo > 0.009
                            ? "text-destructive"
                            : m.saldo < -0.009
                              ? "text-green-700 dark:text-green-400"
                              : "text-muted-foreground",
                        )}
                      >
                        {fmtMonto(m.saldo, m.moneda)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="presupuestos">
          {cargando ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : !act?.presupuestos.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no hay presupuestos de este cliente.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {act.presupuestos.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => abrirPresupuesto(p.id)}
                    >
                      <TableCell className="font-medium text-accent">{p.numero}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px] font-medium", badgeTone(p.status))}>
                          {statusLabel(p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{fmtFechaIso(p.created_at)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMonto(p.total, p.moneda)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ventas">
          {cargando ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : !act?.ventas.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay ventas (seña) de este cliente.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Presupuesto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Cobrado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {act.ventas.map((v) => (
                    <TableRow
                      key={v.id}
                      className="cursor-pointer"
                      onClick={() => abrirVenta(v)}
                    >
                      <TableCell className="font-medium text-accent">{v.numero}</TableCell>
                      <TableCell>{etiquetaVentaEstado(v.estado)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMonto(v.total, v.moneda)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMonto(v.cobrado, v.moneda)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {v.saldo <= 0.009 ? (
                          <span className="text-green-700 dark:text-green-400">Pagado</span>
                        ) : (
                          <span className="text-destructive">{fmtMonto(v.saldo, v.moneda)}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ClienteFormDialog
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
        cliente={cliente}
        titulo="Datos personales"
        descripcion="Teléfono, mail, contacto de obra y dirección."
        modoVista
        onSaved={onUpdated}
      />

      <ComprobanteCobrosSheet
        open={comprobanteOpen}
        onOpenChange={setComprobanteOpen}
        movimiento={comprobanteMov}
        telCliente={cliente.tel}
      />

      <PresupuestoDetallePanel
        open={presupuestoOpen}
        presupuestoId={presupuestoPid}
        onClose={() => setPresupuestoOpen(false)}
        onEditar={irAEditar}
        onAprobar={iniciarAprobacion}
        onRechazar={onRechazar}
        statusBusy={statusBusy}
        refreshKey={detalleRefresh}
      />

      <AprobarPresupuestoDialog
        open={aprobDialogAbierto}
        onOpenChange={(o) => {
          setAprobDialogAbierto(o);
          if (!o) setAprobDialogRow(null);
        }}
        row={
          aprobDialogRow
            ? {
                id: aprobDialogRow.id,
                numero: aprobDialogRow.numero,
                cliente: cliente.nombre,
                total: aprobDialogRow.total,
                moneda: aprobDialogRow.moneda,
              }
            : null
        }
        busy={aprobBusy}
        onConfirm={onConfirmacionAprobar}
      />

      <ElegirChapaReemplazoDialog
        open={reemplazoOpen}
        onOpenChange={(o) => {
          setReemplazoOpen(o);
          if (!o) setChapasPendientes([]);
        }}
        pendientes={chapasPendientes}
        onResuelto={async () => {
          setChapasPendientes([]);
          await recargar({ silencioso: true });
        }}
      />

      <VentaCobrosDialog
        open={ventaOpen}
        onOpenChange={setVentaOpen}
        presupuestoId={ventaPid}
        rowResumen={ventaResumen}
        onDatosCambiaron={() => recargar({ silencioso: true })}
      />
    </div>
  );
}
