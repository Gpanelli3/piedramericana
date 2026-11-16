"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Filter, Ban } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FechaInput } from "@/components/ui/fecha-input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listMovimientos,
  etiquetaMetodo,
  resolverContrapartesMovimientos,
  type ContraparteInfo,
  type CuentaFinancieraRow,
  type MovimientoCajaRow,
} from "@/lib/finanzas-api";
import {
  contraparteDesdeMovimiento,
  esSalida,
  etiquetaCajon,
  etiquetaOrigen,
  etiquetaTipoMov,
  exportarCsv,
  formatFechaCorta,
  formatMonto,
} from "@/components/finanzas/finanzas-helpers";
import { FinanzasTarjetaPendiente } from "@/components/finanzas/FinanzasTarjetaPendiente";
import { cn } from "@/lib/utils";

type FiltroTipo = "todos" | "ingresos" | "egresos" | "transferencias";

type Props = {
  cuentas: CuentaFinancieraRow[];
  suppliersById: Map<string, string>;
  onAbrirMovimiento: (m: MovimientoCajaRow) => void;
  recargaKey: number;
  onAcreditado: () => void;
};

function coincideTipo(m: MovimientoCajaRow, filtro: FiltroTipo): boolean {
  if (filtro === "todos") return true;
  if (filtro === "ingresos") return m.tipo === "ingreso";
  if (filtro === "egresos") return m.tipo === "egreso";
  return m.tipo === "transferencia_entrada" || m.tipo === "transferencia_salida";
}

export function FinanzasMovimientos({
  cuentas,
  suppliersById,
  onAbrirMovimiento,
  recargaKey,
  onAcreditado,
}: Props) {
  const [movimientos, setMovimientos] = useState<MovimientoCajaRow[]>([]);
  const [contrapartes, setContrapartes] = useState<Map<string, ContraparteInfo>>(new Map());
  const [cargando, setCargando] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [filtroCuenta, setFiltroCuenta] = useState("todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    const res = await listMovimientos({
      cuentaId: filtroCuenta === "todas" ? undefined : filtroCuenta,
      desde: desde || undefined,
      hasta: hasta || undefined,
      limit: 500,
    });
    if (res.error) toast.error(res.error.message);
    setMovimientos(res.data);
    setContrapartes(await resolverContrapartesMovimientos(res.data));
    setCargando(false);
  }, [filtroCuenta, desde, hasta]);

  useEffect(() => {
    void recargar();
  }, [recargar, recargaKey]);

  const filtrados = useMemo(
    () => movimientos.filter((m) => coincideTipo(m, filtroTipo)),
    [movimientos, filtroTipo],
  );

  const cuentaPorId = useMemo(() => new Map(cuentas.map((c) => [c.id, c])), [cuentas]);

  function onExportar() {
    exportarCsv(
      `movimientos-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Fecha", "Tipo", "Contraparte", "Cuenta", "Forma de pago", "Monto", "Moneda", "Detalle", "Origen"],
      filtrados.map((m) => [
        m.fecha,
        etiquetaTipoMov(m.tipo),
        contraparteDesdeMovimiento(m, suppliersById, contrapartes),
        cuentaPorId.get(m.cuenta_id) ? etiquetaCajon(cuentaPorId.get(m.cuenta_id)!) : "",
        etiquetaMetodo(m.metodo),
        String(m.monto),
        m.moneda.toUpperCase(),
        m.descripcion ?? "",
        etiquetaOrigen(m.referencia_tipo),
      ]),
    );
    toast.success("Exportación lista.");
  }

  return (
    <div className="space-y-4">
      <FinanzasTarjetaPendiente recargaKey={recargaKey} onAcreditado={onAcreditado} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as FiltroTipo)}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
            <TabsTrigger value="egresos">Egresos</TabsTrigger>
            <TabsTrigger value="transferencias">Transferencias</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {filtrados.length} movimiento{filtrados.length === 1 ? "" : "s"}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onExportar} disabled={filtrados.length === 0}>
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mostrarFiltros ? "secondary" : "outline"}
            onClick={() => setMostrarFiltros((v) => !v)}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        </div>
      </div>

      {mostrarFiltros ? (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Desde</p>
            <FechaInput value={desde} onChange={setDesde} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Hasta</p>
            <FechaInput value={hasta} onChange={setHasta} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Cuenta</p>
            <Select value={filtroCuenta} onValueChange={setFiltroCuenta}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las cuentas</SelectItem>
                {cuentas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {etiquetaCajon(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(desde || hasta || filtroCuenta !== "todas") && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDesde("");
                setHasta("");
                setFiltroCuenta("todas");
              }}
            >
              Limpiar
            </Button>
          )}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Contraparte</TableHead>
              <TableHead>Cuenta(s)</TableHead>
              <TableHead>Forma de pago</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="w-16 text-center">Anular</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  {cargando ? "Cargando…" : "Sin movimientos."}
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((m) => {
                const salida = esSalida(m.tipo);
                const cuenta = cuentaPorId.get(m.cuenta_id);
                return (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer"
                    onClick={() => onAbrirMovimiento(m)}
                  >
                    <TableCell className="tabular-nums text-sm">{formatFechaCorta(m.fecha)}</TableCell>
                    <TableCell>
                      <Badge variant={salida ? "soft" : "success"}>{etiquetaTipoMov(m.tipo)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <p className="truncate text-sm font-medium">
                        {contraparteDesdeMovimiento(m, suppliersById, contrapartes)}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cuenta ? etiquetaCajon(cuenta) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{etiquetaMetodo(m.metodo)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-sm font-semibold tabular-nums",
                        salida ? "text-destructive" : "text-emerald-700 dark:text-emerald-400",
                      )}
                    >
                      {salida ? "−" : "+"}
                      {formatMonto(Number(m.monto), m.moneda)}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                      {m.descripcion ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{etiquetaOrigen(m.referencia_tipo)}</Badge>
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        disabled
                        title="Anular estará disponible en una próxima versión"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
