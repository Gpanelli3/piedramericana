"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FechaInput } from "@/components/ui/fecha-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ExportacionFormDialog } from "@/components/comercio-exterior/ExportacionFormDialog";
import { useAuth } from "@/contexts/AuthContext";
import { hoyISO, medioLabel } from "@/lib/comercio-exterior-api";
import {
  cambiarEtapaExportacion,
  deleteDocumentoExportacion,
  deleteGastoExportacion,
  documentoExportacionLabel,
  documentosExportacionPorEtapa,
  estadoExportacionLabel,
  EXPORTACION_DOCUMENTOS,
  EXPORTACION_ESTADOS,
  EXPORTACION_GASTOS,
  fetchExportacionDetalle,
  gastoExportacionLabel,
  getExportacionDocumentoSignedUrl,
  insertGastoExportacion,
  marcarExportacionCobrada,
  pideDatosCobro,
  summarizeGastosExportacion,
  uploadExportacionDocumento,
  yaTieneIngreso,
  type ExportacionDetalle,
  type ExportacionListRow,
} from "@/lib/exportaciones-api";
import { listCuentasActivas, type CuentaFinancieraRow } from "@/lib/finanzas-api";
import { cn } from "@/lib/utils";
import type { ExportacionDocumentoTipo, ExportacionEstado, ExportacionGastoConcepto } from "@/types/database";

function fmtFecha(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtMonto(n: number, moneda: string) {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
  const prefix = moneda === "usd" ? "USD " : "$ ";
  return prefix + n.toLocaleString("es-AR", opts);
}

type ExportacionFichaProps = {
  exportacion: ExportacionListRow;
  onBack: () => void;
  onUpdated: (row: ExportacionListRow) => void;
  onDeleted: (id: string) => void;
};

export function ExportacionFicha({ exportacion, onBack, onUpdated, onDeleted }: ExportacionFichaProps) {
  const { user } = useAuth();
  const [detalle, setDetalle] = useState<ExportacionDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [cambiandoEtapa, setCambiandoEtapa] = useState(false);
  const [cobroOpen, setCobroOpen] = useState(false);
  const [cuentas, setCuentas] = useState<CuentaFinancieraRow[]>([]);

  const [concepto, setConcepto] = useState<ExportacionGastoConcepto>("valor_mercaderia");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<"ars" | "usd">("usd");
  const [gastoNotas, setGastoNotas] = useState("");
  const [guardandoGasto, setGuardandoGasto] = useState(false);

  const [docTipo, setDocTipo] = useState<ExportacionDocumentoTipo>("factura");
  const [subiendoDoc, setSubiendoDoc] = useState(false);

  const [cobroFecha, setCobroFecha] = useState("");
  const [cobroMonto, setCobroMonto] = useState("");
  const [cobroCuenta, setCobroCuenta] = useState("");
  const [guardandoCobro, setGuardandoCobro] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const d = await fetchExportacionDetalle(exportacion.id);
      setDetalle(d);
    } catch {
      toast.error("No se pudo cargar la exportación.");
    } finally {
      setCargando(false);
    }
  }, [exportacion.id]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  useEffect(() => {
    void listCuentasActivas()
      .then((res) => setCuentas(res.data))
      .catch(() => setCuentas([]));
  }, []);

  const exp = detalle?.exportacion ?? exportacion;
  const gastos = detalle?.gastos ?? [];
  const documentos = detalle?.documentos ?? [];
  const totales = useMemo(() => summarizeGastosExportacion(gastos), [gastos]);
  const gruposDocumentos = useMemo(() => documentosExportacionPorEtapa(documentos), [documentos]);
  const estadoIdx = EXPORTACION_ESTADOS.findIndex((e) => e.value === exp.estado);
  const tieneIngreso = yaTieneIngreso(exp);

  const aplicarEtapa = async (estado: ExportacionEstado) => {
    if (pideDatosCobro(estado, exp.movimiento_id)) {
      setCobroFecha(hoyISO());
      setCobroMonto(exp.monto_factura != null ? String(exp.monto_factura) : "");
      setCobroCuenta(exp.cuenta_id ?? "");
      setCobroOpen(true);
      return;
    }
    setCambiandoEtapa(true);
    try {
      const next = await cambiarEtapaExportacion({ exportacion: exp, estado });
      setDetalle((d) => (d ? { ...d, exportacion: next } : d));
      onUpdated(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    } finally {
      setCambiandoEtapa(false);
    }
  };

  const confirmarCobro = async () => {
    const n = Number(cobroMonto.replace(",", "."));
    setGuardandoCobro(true);
    try {
      const next = await marcarExportacionCobrada({
        exportacion: exp,
        monto: n,
        fecha: cobroFecha,
        cuentaId: cobroCuenta,
        createdBy: user?.id ?? null,
      });
      setDetalle((d) => (d ? { ...d, exportacion: next } : d));
      onUpdated(next);
      setCobroOpen(false);
      toast.success("Exportación cobrada. El ingreso quedó en Finanzas.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar el cobro.");
    } finally {
      setGuardandoCobro(false);
    }
  };

  const etapaAnterior = estadoIdx > 0 ? EXPORTACION_ESTADOS[estadoIdx - 1] : null;
  const etapaSiguiente =
    estadoIdx >= 0 && estadoIdx < EXPORTACION_ESTADOS.length - 1
      ? EXPORTACION_ESTADOS[estadoIdx + 1]
      : null;

  const agregarGasto = async () => {
    const n = Number(monto.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Indicá un monto mayor a 0.");
      return;
    }
    setGuardandoGasto(true);
    try {
      const row = await insertGastoExportacion({
        exportacion_id: exp.id,
        concepto,
        monto: n,
        moneda,
        notas: gastoNotas.trim() || null,
      });
      setDetalle((d) => (d ? { ...d, gastos: [...d.gastos, row] } : d));
      setMonto("");
      setGastoNotas("");
      toast.success("Gasto cargado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el gasto.");
    } finally {
      setGuardandoGasto(false);
    }
  };

  const quitarGasto = async (id: string) => {
    try {
      await deleteGastoExportacion(id);
      setDetalle((d) => (d ? { ...d, gastos: d.gastos.filter((g) => g.id !== id) } : d));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setSubiendoDoc(true);
    try {
      const row = await uploadExportacionDocumento({
        exportacionId: exp.id,
        tipo: docTipo,
        file,
        etapa: exp.estado,
        createdBy: user?.id ?? null,
      });
      setDetalle((d) => (d ? { ...d, documentos: [...d.documentos, row] } : d));
      toast.success("Documento subido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el archivo.");
    } finally {
      setSubiendoDoc(false);
    }
  };

  const abrirDoc = async (path: string) => {
    try {
      const url = await getExportacionDocumentoSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir el archivo.");
    }
  };

  const quitarDoc = async (id: string) => {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    try {
      await deleteDocumentoExportacion(doc);
      setDetalle((d) => (d ? { ...d, documentos: d.documentos.filter((x) => x.id !== id) } : d));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  const cuentasMoneda = cuentas.filter((c) => c.moneda === exp.moneda && c.activa);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{exp.descripcion}</h2>
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span>{exp.client_name}</span>
            {exp.pais_destino ? <span>· {exp.pais_destino}</span> : null}
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
      </div>

      <div className="overflow-x-auto">
        <ol className="flex min-w-[28rem] items-center gap-1">
          {EXPORTACION_ESTADOS.map((e, idx) => {
            const current = e.value === exp.estado;
            const done = idx < estadoIdx;
            return (
              <li key={e.value} className="flex min-w-0 flex-1 items-center gap-1">
                <div
                  className={cn(
                    "w-full rounded-lg border px-2 py-2 text-center text-[11px] font-medium leading-tight",
                    current && "border-primary bg-primary text-primary-foreground",
                    done && "border-emerald-600/40 bg-emerald-50 text-emerald-800",
                    !current && !done && "border-border bg-white text-muted-foreground",
                  )}
                >
                  {e.label}
                </div>
                {idx < EXPORTACION_ESTADOS.length - 1 && (
                  <span className="hidden h-px w-2 shrink-0 bg-border sm:block" />
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="flex justify-end">
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={!etapaAnterior || cambiandoEtapa}
            onClick={() => etapaAnterior && void aplicarEtapa(etapaAnterior.value)}
          >
            <ChevronLeft className="h-4 w-4" />
            {etapaAnterior ? `Volver a ${etapaAnterior.label}` : "Retroceder"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1"
            disabled={!etapaSiguiente || cambiandoEtapa}
            onClick={() => etapaSiguiente && void aplicarEtapa(etapaSiguiente.value)}
          >
            {etapaSiguiente ? `Pasar a ${etapaSiguiente.label}` : "Avanzar"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {tieneIngreso && exp.estado !== "cobrada" ? (
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          El cobro ya está en Finanzas. Si hay un error, corregilo desde ahí.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="gap-0 py-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className="text-sm font-medium">{estadoExportacionLabel(exp.estado)}</p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Factura</p>
            <p className="text-sm font-medium">
              {exp.nro_factura || "—"}
              {exp.monto_factura != null ? ` · ${fmtMonto(Number(exp.monto_factura), exp.moneda)}` : ""}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Banco</p>
            <p className="text-sm font-medium">
              {exp.banco_nombre || "—"}
              {exp.banco_cuenta ? ` · ${exp.banco_cuenta}` : ""}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Transporte / BL</p>
            <p className="text-sm font-medium">
              {medioLabel(exp.medio_transporte)} · {exp.nro_bl || "sin BL"}
            </p>
          </CardContent>
        </Card>
      </div>

      {(totales.usd > 0 || totales.ars > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["usd", "ars"] as const)
            .filter((m) => totales[m] > 0)
            .map((m) => (
              <Card key={m} className="gap-0 py-0">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Costos {m.toUpperCase()}</p>
                  <p className="text-lg font-semibold tabular-nums">{fmtMonto(totales[m], m)}</p>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Tabs defaultValue="gastos" className="gap-3">
        <TabsList>
          <TabsTrigger value="gastos" className="gap-1.5">
            <Wallet className="h-3.5 w-3.5" />
            Costos ({gastos.length})
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Documentos ({documentos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gastos" className="space-y-3">
          <div className="grid gap-2 rounded-lg border border-border bg-white p-3 sm:grid-cols-6">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Concepto</Label>
              <Select
                value={concepto}
                onValueChange={(v) => setConcepto(v as ExportacionGastoConcepto)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPORTACION_GASTOS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Monto</Label>
              <Input
                className="h-9 text-sm"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as "ars" | "usd")}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usd">USD</SelectItem>
                  <SelectItem value="ars">ARS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Notas</Label>
              <Input
                className="h-9 text-sm"
                value={gastoNotas}
                onChange={(e) => setGastoNotas(e.target.value)}
              />
            </div>
            <div className="sm:col-span-6 sm:justify-self-end">
              <Button
                type="button"
                className="h-9 w-full gap-1.5 sm:w-auto"
                onClick={() => void agregarGasto()}
                disabled={guardandoGasto}
              >
                <Plus className="h-4 w-4" />
                Agregar
              </Button>
            </div>
          </div>

          {cargando ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : gastos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin costos cargados.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastos.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{gastoExportacionLabel(g.concepto)}</TableCell>
                      <TableCell className="text-muted-foreground">{g.notas || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMonto(Number(g.monto), g.moneda)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => void quitarGasto(g.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="documentos" className="space-y-3">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-white p-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={docTipo}
                onValueChange={(v) => setDocTipo(v as ExportacionDocumentoTipo)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPORTACION_DOCUMENTOS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se guarda en la etapa actual: {estadoExportacionLabel(exp.estado)}
              </p>
            </div>
            <div className="relative">
              <Button type="button" variant="outline" className="h-9 gap-1.5" disabled={subiendoDoc} asChild>
                <label className={subiendoDoc ? "pointer-events-none opacity-70" : "cursor-pointer"}>
                  <Upload className="h-4 w-4" />
                  {subiendoDoc ? "Subiendo…" : "Subir PDF o imagen"}
                  <input
                    type="file"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                    disabled={subiendoDoc}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      void onFile(file);
                    }}
                  />
                </label>
              </Button>
            </div>
          </div>

          {cargando ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : documentos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin documentos.</p>
          ) : (
            <div className="space-y-3">
              {gruposDocumentos.map((grupo) => (
                <div key={grupo.label} className="overflow-hidden rounded-lg border border-border bg-white">
                  <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
                    <p className="text-sm font-medium">{grupo.label}</p>
                    <span className="text-xs text-muted-foreground">{grupo.docs.length}</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Archivo</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupo.docs.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>{documentoExportacionLabel(d.tipo)}</TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="text-left text-sm font-medium text-primary underline-offset-2 hover:underline"
                              onClick={() => void abrirDoc(d.url)}
                            >
                              {d.nombre_archivo}
                            </button>
                          </TableCell>
                          <TableCell>{fmtFecha(d.created_at.slice(0, 10))}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => void quitarDoc(d.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {exp.notas && (
        <div className="rounded-lg border border-border bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">Notas</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{exp.notas}</p>
        </div>
      )}

      <ExportacionFormDialog
        open={editOpen}
        onDeleted={onDeleted}
        onOpenChange={setEditOpen}
        exportacion={exp}
        onSaved={(row) => {
          onUpdated(row);
          void recargar();
        }}
      />

      <Dialog open={cobroOpen} onOpenChange={setCobroOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar cobro</DialogTitle>
            <DialogDescription>
              Al pasar a Cobrada se crea un ingreso en Finanzas. Si el monto no coincide, ajustalo acá.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <FechaInput className="h-9 w-full text-sm" value={cobroFecha} onChange={setCobroFecha} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Monto ({exp.moneda.toUpperCase()})</Label>
              <Input
                className="h-9 text-sm"
                inputMode="decimal"
                value={cobroMonto}
                onChange={(e) => setCobroMonto(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cuenta</Label>
              <Select value={cobroCuenta || undefined} onValueChange={setCobroCuenta}>
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder="Elegí la cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {cuentasMoneda.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCobroOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void confirmarCobro()} disabled={guardandoCobro}>
              {guardandoCobro ? "Registrando…" : "Registrar cobro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
