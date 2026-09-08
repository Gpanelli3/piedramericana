"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Package,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ImportacionFormDialog } from "@/components/comercio-exterior/ImportacionFormDialog";
import { CrearRemitoDialog } from "@/components/stock/CrearRemitoDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useStock } from "@/contexts/StockContext";
import {
  deleteDocumento,
  deleteGasto,
  documentoLabel,
  documentosPorEtapa,
  estadoLabel,
  fetchImportacionDetalle,
  gastoLabel,
  getDocumentoSignedUrl,
  IMPORTACION_DOCUMENTOS,
  IMPORTACION_ESTADOS,
  IMPORTACION_GASTOS,
  insertGasto,
  isImportacionDemorada,
  medioLabel,
  summarizeGastos,
  updateImportacion,
  uploadImportacionDocumento,
  type ImportacionDetalle,
  type ImportacionListRow,
} from "@/lib/comercio-exterior-api";
import { fetchMaterialsForStock, type MaterialOption } from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { ImportacionDocumentoTipo, ImportacionEstado, ImportacionGastoConcepto } from "@/types/database";

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

type ImportacionFichaProps = {
  importacion: ImportacionListRow;
  onBack: () => void;
  onUpdated: (row: ImportacionListRow) => void;
};

export function ImportacionFicha({ importacion, onBack, onUpdated }: ImportacionFichaProps) {
  const { user } = useAuth();
  const { chapas, setChapas, reloadChapas } = useStock();
  const [detalle, setDetalle] = useState<ImportacionDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [remitoOpen, setRemitoOpen] = useState(false);
  const [cambiandoEtapa, setCambiandoEtapa] = useState(false);
  const [materiales, setMateriales] = useState<MaterialOption[]>([]);

  const [concepto, setConcepto] = useState<ImportacionGastoConcepto>("valor_mercaderia");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<"ars" | "usd">("usd");
  const [ivaRec, setIvaRec] = useState(false);
  const [gastoNotas, setGastoNotas] = useState("");
  const [guardandoGasto, setGuardandoGasto] = useState(false);

  const [docTipo, setDocTipo] = useState<ImportacionDocumentoTipo>("bill_of_lading");
  const [subiendoDoc, setSubiendoDoc] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const d = await fetchImportacionDetalle(importacion.id);
      setDetalle(d);
    } catch {
      toast.error("No se pudo cargar la importación.");
    } finally {
      setCargando(false);
    }
  }, [importacion.id]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void fetchMaterialsForStock()
      .then(setMateriales)
      .catch(() => setMateriales([]));
  }, []);

  const imp = detalle?.importacion ?? importacion;
  const gastos = detalle?.gastos ?? [];
  const documentos = detalle?.documentos ?? [];
  const remitos = detalle?.remitos ?? [];
  const landed = useMemo(() => summarizeGastos(gastos), [gastos]);
  const gruposDocumentos = useMemo(() => documentosPorEtapa(documentos), [documentos]);
  const demorada = isImportacionDemorada(imp);
  const estadoIdx = IMPORTACION_ESTADOS.findIndex((e) => e.value === imp.estado);

  const existingBultosLower = useMemo(
    () => new Set(chapas.map((c) => c.bulto.toLowerCase())),
    [chapas],
  );

  const setEstado = async (estado: ImportacionEstado) => {
    setCambiandoEtapa(true);
    try {
      await updateImportacion(imp.id, { estado });
      const next = { ...imp, estado };
      setDetalle((d) => (d ? { ...d, importacion: next } : d));
      onUpdated(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    } finally {
      setCambiandoEtapa(false);
    }
  };

  const etapaAnterior = estadoIdx > 0 ? IMPORTACION_ESTADOS[estadoIdx - 1] : null;
  const etapaSiguiente = estadoIdx >= 0 && estadoIdx < IMPORTACION_ESTADOS.length - 1
    ? IMPORTACION_ESTADOS[estadoIdx + 1]
    : null;

  const agregarGasto = async () => {
    const n = Number(monto.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Indicá un monto mayor a 0.");
      return;
    }
    setGuardandoGasto(true);
    try {
      const row = await insertGasto({
        importacion_id: imp.id,
        concepto,
        monto: n,
        moneda,
        es_iva_recuperable: ivaRec,
        notas: gastoNotas.trim() || null,
      });
      setDetalle((d) => (d ? { ...d, gastos: [...d.gastos, row] } : d));
      setMonto("");
      setGastoNotas("");
      setIvaRec(false);
      toast.success("Gasto cargado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el gasto.");
    } finally {
      setGuardandoGasto(false);
    }
  };

  const quitarGasto = async (id: string) => {
    try {
      await deleteGasto(id);
      setDetalle((d) => (d ? { ...d, gastos: d.gastos.filter((g) => g.id !== id) } : d));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setSubiendoDoc(true);
    try {
      const row = await uploadImportacionDocumento({
        importacionId: imp.id,
        tipo: docTipo,
        file,
        etapa: imp.estado,
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
      const url = await getDocumentoSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir el archivo.");
    }
  };

  const quitarDoc = async (id: string) => {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    try {
      await deleteDocumento(doc);
      setDetalle((d) => (d ? { ...d, documentos: d.documentos.filter((x) => x.id !== id) } : d));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{imp.descripcion}</h2>
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span>{imp.supplier_name}</span>
            <span>· {imp.pais_origen}</span>
            {demorada && (
              <Badge variant="destructive" className="text-[10px]">Demorada</Badge>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
      </div>

      <div className="overflow-x-auto">
        <ol className="flex min-w-[40rem] items-center gap-1">
          {IMPORTACION_ESTADOS.map((e, idx) => {
            const current = e.value === imp.estado;
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
                {idx < IMPORTACION_ESTADOS.length - 1 && (
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
            onClick={() => etapaAnterior && void setEstado(etapaAnterior.value)}
          >
            <ChevronLeft className="h-4 w-4" />
            {etapaAnterior ? `Volver a ${etapaAnterior.label}` : "Retroceder"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1"
            disabled={!etapaSiguiente || cambiandoEtapa}
            onClick={() => etapaSiguiente && void setEstado(etapaSiguiente.value)}
          >
            {etapaSiguiente ? `Pasar a ${etapaSiguiente.label}` : "Avanzar"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="gap-0 py-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className="text-sm font-medium">{estadoLabel(imp.estado)}</p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Llegada estimada</p>
            <p className="text-sm font-medium">{fmtFecha(imp.fecha_estimada_llegada)}</p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">OC / BL</p>
            <p className="text-sm font-medium">
              {imp.nro_orden_compra || "—"} · {imp.nro_conocimiento || "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Transporte</p>
            <p className="text-sm font-medium">{medioLabel(imp.medio_transporte)}</p>
          </CardContent>
        </Card>
      </div>

      {(landed.usd.total > 0 || landed.ars.total > 0) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {(["usd", "ars"] as const)
            .filter((m) => landed[m].total > 0)
            .map((m) => (
              <Card key={m} className="gap-0 py-0">
                <CardContent className="grid gap-1 p-3">
                  <p className="text-xs text-muted-foreground">Costo {m.toUpperCase()}</p>
                  <p className="text-lg font-semibold tabular-nums">{fmtMonto(landed[m].puesto, m)}</p>
                  <p className="text-xs text-muted-foreground">
                    Total {fmtMonto(landed[m].total, m)}
                    {landed[m].iva > 0 ? ` · IVA a favor ${fmtMonto(landed[m].iva, m)}` : ""}
                  </p>
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
          <TabsTrigger value="stock" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Stock ({remitos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gastos" className="space-y-3">
          <div className="grid gap-2 rounded-lg border border-border bg-white p-3 sm:grid-cols-6">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Concepto</Label>
              <Select value={concepto} onValueChange={(v) => setConcepto(v as ImportacionGastoConcepto)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMPORTACION_GASTOS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Monto</Label>
              <Input className="h-9 text-sm" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as "ars" | "usd")}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usd">USD</SelectItem>
                  <SelectItem value="ars">ARS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Notas</Label>
              <Input className="h-9 text-sm" value={gastoNotas} onChange={(e) => setGastoNotas(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-4">
              <Checkbox checked={ivaRec} onCheckedChange={(v) => setIvaRec(Boolean(v))} />
              IVA recuperable (crédito fiscal)
            </label>
            <div className="sm:col-span-2 sm:justify-self-end">
              <Button type="button" className="h-9 w-full gap-1.5" onClick={() => void agregarGasto()} disabled={guardandoGasto}>
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
                    <TableHead>IVA</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastos.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{gastoLabel(g.concepto)}</TableCell>
                      <TableCell className="text-muted-foreground">{g.notas || "—"}</TableCell>
                      <TableCell>{g.es_iva_recuperable ? "Sí" : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMonto(Number(g.monto), g.moneda)}</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void quitarGasto(g.id)}>
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
              <Select value={docTipo} onValueChange={(v) => setDocTipo(v as ImportacionDocumentoTipo)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMPORTACION_DOCUMENTOS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se guarda en la etapa actual: {estadoLabel(imp.estado)}
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
                          <TableCell>{documentoLabel(d.tipo)}</TableCell>
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
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void quitarDoc(d.id)}>
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

        <TabsContent value="stock" className="space-y-3">
          <div className="flex justify-end">
            <Button type="button" className="gap-1.5" onClick={() => setRemitoOpen(true)}>
              <Package className="h-4 w-4" />
              Ingresar a stock
            </Button>
          </div>
          {cargando ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : remitos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no hay remitos ligados a esta importación.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Remito</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead className="text-right">Chapas</TableHead>
                    <TableHead className="text-right">m²</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remitos.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.branch_code || "—"}-{r.serial_code || "—"}
                      </TableCell>
                      <TableCell>{fmtFecha(r.issue_date)}</TableCell>
                      <TableCell className="capitalize">{r.origen_placa}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.total_slabs}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.total_m2.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {imp.notas && (
        <div className="rounded-lg border border-border bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">Notas</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{imp.notas}</p>
        </div>
      )}

      <ImportacionFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        importacion={imp}
        onSaved={(row) => {
          onUpdated(row);
          void recargar();
        }}
      />

      <CrearRemitoDialog
        open={remitoOpen}
        onOpenChange={setRemitoOpen}
        materiales={materiales}
        userId={user?.id}
        reloadChapas={reloadChapas}
        refreshRemitos={async () => {
          await recargar();
        }}
        setChapas={setChapas}
        existingBultosLower={existingBultosLower}
        initialSupplierId={imp.supplier_id}
        initialOrigen="importado"
        importacionId={imp.id}
        onSaved={() => {
          if (imp.estado !== "en_deposito") {
            void setEstado("en_deposito");
          }
        }}
      />
    </div>
  );
}
