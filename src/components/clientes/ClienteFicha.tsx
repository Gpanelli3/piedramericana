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
import { etiquetaVentaEstado, formatFechaCorta } from "@/components/produccion/ot-ui";
import { etiquetaMetodo } from "@/lib/finanzas-api";
import {
  fetchClienteFicha,
  type ClienteFichaData,
  type ClienteFichaMovimiento,
  type ClientePresupuesto,
} from "@/lib/clients-api";
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

  const recargar = useCallback(async () => {
    setCargando(true);
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

  const irPresupuesto = (id: string) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("ws", "ventas");
        n.set("pv", "list");
        n.set("ft", "todos");
        n.set("rid", id);
        n.delete("cid");
        n.delete("id");
        n.delete("pid");
        n.delete("ot");
        n.delete("eq");
        return n;
      },
      { replace: false },
    );
  };

  const irVenta = (presupuestoId: string) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("ws", "administracion");
        n.set("pid", presupuestoId);
        n.delete("cid");
        n.delete("pv");
        n.delete("ft");
        n.delete("rid");
        n.delete("id");
        n.delete("ot");
        n.delete("eq");
        return n;
      },
      { replace: false },
    );
  };

  const irMovimiento = (m: ClienteFichaMovimiento) => {
    const tieneVenta = Boolean(act?.ventas.some((v) => v.presupuestoId === m.presupuestoId));
    if (tieneVenta) irVenta(m.presupuestoId);
    else irPresupuesto(m.presupuestoId);
  };

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
                      onClick={() => irMovimiento(m)}
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
                      onClick={() => irPresupuesto(p.id)}
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
                      onClick={() => irVenta(v.presupuestoId)}
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
    </div>
  );
}
