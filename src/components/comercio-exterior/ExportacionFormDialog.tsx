"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FechaInput } from "@/components/ui/fecha-input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormClassName,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";
import { useAuth } from "@/contexts/AuthContext";
import { listClients, type ClientePresupuesto } from "@/lib/clients-api";
import { listCuentasActivas, type CuentaFinancieraRow } from "@/lib/finanzas-api";
import { MEDIOS_TRANSPORTE } from "@/lib/comercio-exterior-api";
import {
  deleteDocumentoExportacion,
  documentoExportacionLabel,
  estadoExportacionLabel,
  EXPORTACION_DOCUMENTOS,
  fetchExportacionDocumentos,
  getExportacionDocumentoSignedUrl,
  insertExportacion,
  updateExportacion,
  uploadExportacionDocumento,
  validateExportacionFile,
  type ExportacionDocumentoRow,
  type ExportacionListRow,
} from "@/lib/exportaciones-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ExportacionDocumentoTipo, ImportacionMedioTransporte } from "@/types/database";

type Draft = {
  client_id: string;
  descripcion: string;
  pais_destino: string;
  nro_pedido: string;
  fecha_pedido: string;
  nro_factura: string;
  fecha_factura: string;
  monto_factura: string;
  moneda: "ars" | "usd";
  medio_transporte: string;
  nro_bl: string;
  fecha_embarque: string;
  banco_nombre: string;
  banco_cuenta: string;
  cuenta_id: string;
  notas: string;
};

type PendingDoc = {
  key: string;
  tipo: ExportacionDocumentoTipo;
  file: File;
};

function emptyDraft(): Draft {
  return {
    client_id: "",
    descripcion: "",
    pais_destino: "",
    nro_pedido: "",
    fecha_pedido: "",
    nro_factura: "",
    fecha_factura: "",
    monto_factura: "",
    moneda: "usd",
    medio_transporte: "",
    nro_bl: "",
    fecha_embarque: "",
    banco_nombre: "",
    banco_cuenta: "",
    cuenta_id: "",
    notas: "",
  };
}

function fromRow(r: ExportacionListRow): Draft {
  return {
    client_id: r.client_id,
    descripcion: r.descripcion,
    pais_destino: r.pais_destino ?? "",
    nro_pedido: r.nro_pedido ?? "",
    fecha_pedido: r.fecha_pedido ?? "",
    nro_factura: r.nro_factura ?? "",
    fecha_factura: r.fecha_factura ?? "",
    monto_factura: r.monto_factura != null ? String(r.monto_factura) : "",
    moneda: r.moneda,
    medio_transporte: r.medio_transporte ?? "",
    nro_bl: r.nro_bl ?? "",
    fecha_embarque: r.fecha_embarque ?? "",
    banco_nombre: r.banco_nombre ?? "",
    banco_cuenta: r.banco_cuenta ?? "",
    cuenta_id: r.cuenta_id ?? "",
    notas: r.notas ?? "",
  };
}

function emptyToNull(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function newKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `d-${Math.random().toString(36).slice(2)}`;
}

type ExportacionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportacion?: ExportacionListRow | null;
  onSaved: (row: ExportacionListRow) => void;
};

export function ExportacionFormDialog({
  open,
  onOpenChange,
  exportacion = null,
  onSaved,
}: ExportacionFormDialogProps) {
  const { user } = useAuth();
  const editando = Boolean(exportacion?.id);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [guardando, setGuardando] = useState(false);
  const [clientes, setClientes] = useState<ClientePresupuesto[]>([]);
  const [clienteDialog, setClienteDialog] = useState(false);
  const [cuentas, setCuentas] = useState<CuentaFinancieraRow[]>([]);
  const [docTipo, setDocTipo] = useState<ExportacionDocumentoTipo>("factura");
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [existentes, setExistentes] = useState<ExportacionDocumentoRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setDraft(exportacion ? fromRow(exportacion) : emptyDraft());
    setPendingDocs([]);
    setDocTipo("factura");
    setExistentes([]);
    void listClients()
      .then((res) => setClientes(res.data))
      .catch(() => setClientes([]));
    void listCuentasActivas()
      .then((res) => setCuentas(res.data))
      .catch(() => setCuentas([]));
    if (exportacion?.id) {
      void fetchExportacionDocumentos(exportacion.id)
        .then(setExistentes)
        .catch(() => setExistentes([]));
    }
  }, [open, exportacion]);

  const cuentasMoneda = cuentas.filter((c) => c.moneda === draft.moneda && c.activa);

  const agregarArchivos = (files: FileList | File[] | null) => {
    if (!files) return;
    const next: PendingDoc[] = [];
    for (const file of Array.from(files)) {
      const err = validateExportacionFile(file);
      if (err) {
        toast.error(`${file.name}: ${err}`);
        continue;
      }
      next.push({ key: newKey(), tipo: docTipo, file });
    }
    if (next.length) setPendingDocs((prev) => [...prev, ...next]);
  };

  const quitarExistente = async (doc: ExportacionDocumentoRow) => {
    try {
      await deleteDocumentoExportacion(doc);
      setExistentes((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo quitar el archivo.");
    }
  };

  const abrirExistente = async (path: string) => {
    try {
      const url = await getExportacionDocumentoSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir el archivo.");
    }
  };

  const guardar = async () => {
    if (!draft.descripcion.trim()) {
      toast.error("Indicá una descripción de la mercadería.");
      return;
    }
    if (!draft.client_id) {
      toast.error("Elegí el cliente.");
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado.");
      return;
    }

    const montoRaw = draft.monto_factura.replace(",", ".").trim();
    const monto = montoRaw ? Number(montoRaw) : null;
    if (montoRaw && (!Number.isFinite(monto) || (monto ?? 0) < 0)) {
      toast.error("El monto de factura no es válido.");
      return;
    }

    const payload = {
      client_id: draft.client_id,
      descripcion: draft.descripcion.trim(),
      pais_destino: emptyToNull(draft.pais_destino),
      nro_pedido: emptyToNull(draft.nro_pedido),
      fecha_pedido: emptyToNull(draft.fecha_pedido),
      nro_factura: emptyToNull(draft.nro_factura),
      fecha_factura: emptyToNull(draft.fecha_factura),
      monto_factura: monto,
      moneda: draft.moneda,
      medio_transporte: emptyToNull(draft.medio_transporte) as ImportacionMedioTransporte | null,
      nro_bl: emptyToNull(draft.nro_bl),
      fecha_embarque: emptyToNull(draft.fecha_embarque),
      banco_nombre: emptyToNull(draft.banco_nombre),
      banco_cuenta: emptyToNull(draft.banco_cuenta),
      cuenta_id: emptyToNull(draft.cuenta_id),
      notas: emptyToNull(draft.notas),
    };

    const clientName = clientes.find((c) => c.id === draft.client_id)?.nombre ?? "—";

    setGuardando(true);
    try {
      let id = exportacion?.id ?? "";
      if (editando && exportacion) {
        await updateExportacion(exportacion.id, payload);
        onSaved({ ...exportacion, ...payload, client_name: clientName });
      } else {
        id = await insertExportacion({
          ...payload,
          created_by: user?.id ?? null,
        });
        onSaved({
          id,
          estado: "pedido",
          fecha_cobro: null,
          movimiento_id: null,
          created_by: user?.id ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          client_name: clientName,
          ...payload,
        });
      }

      if (pendingDocs.length && id) {
        let fallidos = 0;
        for (const doc of pendingDocs) {
          try {
            await uploadExportacionDocumento({
              exportacionId: id,
              tipo: doc.tipo,
              file: doc.file,
              etapa: editando && exportacion ? exportacion.estado : "pedido",
              createdBy: user?.id ?? null,
            });
          } catch {
            fallidos += 1;
          }
        }
        if (fallidos) {
          toast.error(
            `La exportación se guardó, pero ${fallidos} archivo${fallidos === 1 ? "" : "s"} no se subieron.`,
          );
        } else {
          toast.success(editando ? "Exportación actualizada." : "Exportación creada.");
        }
      } else {
        toast.success(editando ? "Exportación actualizada." : "Exportación creada.");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <ClienteFormDialog
        open={clienteDialog}
        onOpenChange={setClienteDialog}
        onSaved={(c) => {
          setClientes((prev) => {
            const sin = prev.filter((p) => p.id !== c.id);
            return [c, ...sin];
          });
          setDraft((d) => ({ ...d, client_id: c.id }));
        }}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={dialogFormClassName}>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar exportación" : "Nueva exportación"}</DialogTitle>
            <DialogDescription>
              Expediente de pedido, factura, embarque y cobro. El BL lo carga el cliente: queda opcional.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cliente *</Label>
                <div className="flex w-full min-w-0 gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      value={draft.client_id || undefined}
                      onValueChange={(v) => setDraft((d) => ({ ...d, client_id: v }))}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                        <SelectValue placeholder="Elegí cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setClienteDialog(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descripción *</Label>
                <Input
                  className="h-9 w-full text-sm"
                  value={draft.descripcion}
                  onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
                  placeholder="Ej. Placas de cuarcita para obra en Uruguay"
                  autoFocus
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">País de destino</Label>
                  <Input
                    className="h-9 w-full text-sm"
                    value={draft.pais_destino}
                    onChange={(e) => setDraft((d) => ({ ...d, pais_destino: e.target.value }))}
                    placeholder="Uruguay, Chile…"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">N° pedido</Label>
                  <Input
                    className="h-9 w-full text-sm"
                    value={draft.nro_pedido}
                    onChange={(e) => setDraft((d) => ({ ...d, nro_pedido: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fecha pedido</Label>
                  <FechaInput
                    className="h-9 w-full text-sm"
                    value={draft.fecha_pedido}
                    onChange={(iso) => setDraft((d) => ({ ...d, fecha_pedido: iso }))}
                  />
                </div>
              </div>
            </div>

            <hr className="border-border" />

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">N° factura</Label>
                <Input
                  className="h-9 w-full text-sm"
                  value={draft.nro_factura}
                  onChange={(e) => setDraft((d) => ({ ...d, nro_factura: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha factura</Label>
                <FechaInput
                  className="h-9 w-full text-sm"
                  value={draft.fecha_factura}
                  onChange={(iso) => setDraft((d) => ({ ...d, fecha_factura: iso }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Monto</Label>
                <Input
                  className="h-9 w-full text-sm"
                  inputMode="decimal"
                  value={draft.monto_factura}
                  onChange={(e) => setDraft((d) => ({ ...d, monto_factura: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Moneda</Label>
                <Select
                  value={draft.moneda}
                  onValueChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      moneda: v as "ars" | "usd",
                      cuenta_id: d.cuenta_id && cuentas.find((c) => c.id === d.cuenta_id)?.moneda === v
                        ? d.cuenta_id
                        : "",
                    }))
                  }
                >
                  <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD</SelectItem>
                    <SelectItem value="ars">ARS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Medio de transporte</Label>
                <Select
                  value={draft.medio_transporte || "__none__"}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, medio_transporte: v === "__none__" ? "" : v }))
                  }
                >
                  <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                    <SelectValue placeholder="Sin especificar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin especificar</SelectItem>
                    {MEDIOS_TRANSPORTE.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">N° BL (opcional)</Label>
                <Input
                  className="h-9 w-full text-sm"
                  value={draft.nro_bl}
                  onChange={(e) => setDraft((d) => ({ ...d, nro_bl: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha de embarque</Label>
                <FechaInput
                  className="h-9 w-full text-sm"
                  value={draft.fecha_embarque}
                  onChange={(iso) => setDraft((d) => ({ ...d, fecha_embarque: iso }))}
                />
              </div>
            </div>

            <hr className="border-border" />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Banco (dónde entra el pago)</Label>
                <Input
                  className="h-9 w-full text-sm"
                  value={draft.banco_nombre}
                  onChange={(e) => setDraft((d) => ({ ...d, banco_nombre: e.target.value }))}
                  placeholder="Nombre del banco"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cuenta / CBU</Label>
                <Input
                  className="h-9 w-full text-sm"
                  value={draft.banco_cuenta}
                  onChange={(e) => setDraft((d) => ({ ...d, banco_cuenta: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Cajón en Finanzas</Label>
                <Select
                  value={draft.cuenta_id || "__none__"}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, cuenta_id: v === "__none__" ? "" : v }))
                  }
                >
                  <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                    <SelectValue placeholder="Sin especificar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin especificar</SelectItem>
                    {cuentasMoneda.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Notas</Label>
                <Textarea
                  className="min-h-[56px] w-full resize-y text-sm"
                  maxLength={500}
                  value={draft.notas}
                  onChange={(e) => setDraft((d) => ({ ...d, notas: e.target.value }))}
                />
              </div>
            </div>

            <hr className="border-border" />

            <div className="grid gap-3">
              <div>
                <Label className="text-xs">Documentos</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  PDF o imagen. El BL lo maneja el cliente: si llega, lo adjuntás acá.
                  Los nuevos quedan en{" "}
                  {estadoExportacionLabel(editando && exportacion ? exportacion.estado : "pedido")}.
                </p>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <Select
                    value={docTipo}
                    onValueChange={(v) => setDocTipo(v as ExportacionDocumentoTipo)}
                  >
                    <SelectTrigger className="h-9 w-full min-w-0 text-sm">
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
                </div>
                <label className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium hover:bg-muted/50">
                  <Upload className="h-4 w-4" />
                  Adjuntar archivo
                  <input
                    type="file"
                    className="sr-only"
                    multiple
                    accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => {
                      agregarArchivos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {existentes.length === 0 && pendingDocs.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  Todavía no hay archivos. Podés cargarlos ahora o después en la ficha.
                </p>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
                  {existentes.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className="block truncate text-left font-medium text-primary underline-offset-2 hover:underline"
                          onClick={() => void abrirExistente(d.url)}
                        >
                          {d.nombre_archivo}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {documentoExportacionLabel(d.tipo)}
                          {d.etapa ? ` · ${estadoExportacionLabel(d.etapa)}` : " · Sin etapa"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive"
                        onClick={() => void quitarExistente(d)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                  {pendingDocs.map((d) => (
                    <li key={d.key} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{d.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {documentoExportacionLabel(d.tipo)} · pendiente
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive"
                        onClick={() => setPendingDocs((prev) => prev.filter((x) => x.key !== d.key))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => void guardar()}
              disabled={!draft.descripcion.trim() || !draft.client_id || guardando}
            >
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear exportación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
