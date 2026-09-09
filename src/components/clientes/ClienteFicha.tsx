"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, User, Wallet, Wrench } from "lucide-react";
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
import { etiquetaEtapaOt } from "@/lib/etiquetas-ot";
import { etiquetaVentaEstado, formatFechaCorta } from "@/components/produccion/ot-ui";
import {
  fetchClienteFicha,
  type ClienteFichaData,
  type ClientePresupuesto,
} from "@/lib/clients-api";
import type { PresupuestoEstado } from "@/types/database";
import type { ProduccionOtFiltro } from "@/types/workspace";
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

  const irOt = (tab: ProduccionOtFiltro) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("ws", "produccion");
        n.set("ot", tab);
        n.delete("cid");
        n.delete("pv");
        n.delete("ft");
        n.delete("rid");
        n.delete("id");
        n.delete("pid");
        n.delete("eq");
        return n;
      },
      { replace: false },
    );
  };

  const hayUsd = Boolean(
    act && (act.saldoUsd > 0.009 || act.cobradoUsd > 0.009),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{cliente.nombre}</h2>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
          <User className="h-3.5 w-3.5" />
          Ver datos personales
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Saldo ARS</p>
            <p className="text-lg font-semibold tabular-nums">
              {cargando ? "…" : fmtMonto(act?.saldoArs ?? 0, "ars")}
            </p>
          </CardContent>
        </Card>
        {hayUsd ? (
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Saldo USD</p>
              <p className="text-lg font-semibold tabular-nums">
                {fmtMonto(act?.saldoUsd ?? 0, "usd")}
              </p>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Cobrado ARS</p>
            <p className="text-lg font-semibold tabular-nums">
              {cargando ? "…" : fmtMonto(act?.cobradoArs ?? 0, "ars")}
            </p>
          </CardContent>
        </Card>
        {hayUsd ? (
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Cobrado USD</p>
              <p className="text-lg font-semibold tabular-nums">
                {fmtMonto(act?.cobradoUsd ?? 0, "usd")}
              </p>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Presupuestos</p>
            <p className="text-lg font-semibold tabular-nums">
              {cargando ? "…" : (act?.presupuestos.length ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">OTs abiertas</p>
            <p className="text-lg font-semibold tabular-nums">
              {cargando ? "…" : (act?.otsAbiertas ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="presupuestos" className="gap-3">
        <TabsList>
          <TabsTrigger value="presupuestos" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Presupuestos ({act?.presupuestos.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="ventas" className="gap-1.5">
            <Wallet className="h-3.5 w-3.5" />
            Ventas ({act?.ventas.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="ots" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            OTs ({act?.ots.length ?? 0})
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="ots">
          {cargando ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : !act?.ots.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay órdenes de trabajo de este cliente.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>OT</TableHead>
                    <TableHead>Presupuesto</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Entrega</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {act.ots.map((ot) => (
                    <TableRow
                      key={ot.id}
                      className="cursor-pointer"
                      onClick={() => irOt(ot.tabProduccion)}
                    >
                      <TableCell className="font-medium">{ot.titulo}</TableCell>
                      <TableCell className="text-muted-foreground">{ot.presupuestoNumero}</TableCell>
                      <TableCell>{etiquetaEtapaOt(ot.etapa, ot.estado)}</TableCell>
                      <TableCell>{formatFechaCorta(ot.fecha_programada)}</TableCell>
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
