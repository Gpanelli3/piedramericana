"use client";

import { useEffect, useMemo, useState } from "react";
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
import { ProveedorFormDialog } from "@/components/proveedores/ProveedorFormDialog";
import { useAuth } from "@/contexts/AuthContext";
import { fetchSuppliers, type SupplierRow } from "@/lib/suppliers-api";
import {
  deleteDocumento,
  documentoLabel,
  estadoLabel,
  fetchImportacionDocumentos,
  getDocumentoSignedUrl,
  IMPORTACION_DOCUMENTOS,
  insertImportacion,
  MEDIOS_TRANSPORTE,
  updateImportacion,
  uploadImportacionDocumento,
  validateImportacionFile,
  type ImportacionDocumentoRow,
  type ImportacionListRow,
} from "@/lib/comercio-exterior-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ImportacionDocumentoTipo, ImportacionMedioTransporte } from "@/types/database";

type Draft = {
  supplier_id: string;
  descripcion: string;
  pais_origen: string;
  nro_orden_compra: string;
  fecha_orden_compra: string;
  monto_factura_usd: string;
  fecha_factura_provisoria: string;
  medio_transporte: string;
  nro_conocimiento: string;
  fecha_embarque: string;
  fecha_estimada_llegada: string;
  fecha_llegada_real: string;
  fecha_nacionalizacion: string;
  nro_despacho: string;
  despachante_nombre: string;
  despachante_telefono: string;
  notas: string;
};

type PendingDoc = {
  key: string;
  tipo: ImportacionDocumentoTipo;
  file: File;
};

function emptyDraft(): Draft {
  return {
    supplier_id: "",
    descripcion: "",
    pais_origen: "",
    nro_orden_compra: "",
    fecha_orden_compra: "",
    monto_factura_usd: "",
    fecha_factura_provisoria: "",
    medio_transporte: "",
    nro_conocimiento: "",
    fecha_embarque: "",
    fecha_estimada_llegada: "",
    fecha_llegada_real: "",
    fecha_nacionalizacion: "",
    nro_despacho: "",
    despachante_nombre: "",
    despachante_telefono: "",
    notas: "",
  };
}

function fromRow(r: ImportacionListRow): Draft {
  return {
    supplier_id: r.supplier_id,
    descripcion: r.descripcion,
    pais_origen: r.pais_origen,
    nro_orden_compra: r.nro_orden_compra ?? "",
    fecha_orden_compra: r.fecha_orden_compra ?? "",
    monto_factura_usd: r.monto_factura_usd != null ? String(r.monto_factura_usd) : "",
    fecha_factura_provisoria: r.fecha_factura_provisoria ?? "",
    medio_transporte: r.medio_transporte ?? "",
    nro_conocimiento: r.nro_conocimiento ?? "",
    fecha_embarque: r.fecha_embarque ?? "",
    fecha_estimada_llegada: r.fecha_estimada_llegada ?? "",
    fecha_llegada_real: r.fecha_llegada_real ?? "",
    fecha_nacionalizacion: r.fecha_nacionalizacion ?? "",
    nro_despacho: r.nro_despacho ?? "",
    despachante_nombre: r.despachante_nombre ?? "",
    despachante_telefono: r.despachante_telefono ?? "",
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

type ImportacionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importacion?: ImportacionListRow | null;
  onSaved: (row: ImportacionListRow) => void;
};

export function ImportacionFormDialog({
  open,
  onOpenChange,
  importacion = null,
  onSaved,
}: ImportacionFormDialogProps) {
  const { user } = useAuth();
  const editando = Boolean(importacion?.id);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [guardando, setGuardando] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [proveedorDialog, setProveedorDialog] = useState(false);
  const [docTipo, setDocTipo] = useState<ImportacionDocumentoTipo>("factura_provisoria");
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [existentes, setExistentes] = useState<ImportacionDocumentoRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setDraft(importacion ? fromRow(importacion) : emptyDraft());
    setPendingDocs([]);
    setDocTipo("factura_provisoria");
    setExistentes([]);
    void fetchSuppliers()
      .then(setSuppliers)
      .catch(() => setSuppliers([]));
    if (importacion?.id) {
      void fetchImportacionDocumentos(importacion.id)
        .then(setExistentes)
        .catch(() => setExistentes([]));
    }
  }, [open, importacion]);

  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      const aExt = a.origen === "exterior" ? 0 : 1;
      const bExt = b.origen === "exterior" ? 0 : 1;
      if (aExt !== bExt) return aExt - bExt;
      return a.name.localeCompare(b.name, "es");
    });
  }, [suppliers]);

  const agregarArchivos = (files: FileList | File[] | null) => {
    if (!files) return;
    const next: PendingDoc[] = [];
    for (const file of Array.from(files)) {
      const err = validateImportacionFile(file);
      if (err) {
        toast.error(`${file.name}: ${err}`);
        continue;
      }
      next.push({ key: newKey(), tipo: docTipo, file });
    }
    if (next.length) setPendingDocs((prev) => [...prev, ...next]);
  };

  const quitarExistente = async (doc: ImportacionDocumentoRow) => {
    try {
      await deleteDocumento(doc);
      setExistentes((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo quitar el archivo.");
    }
  };

  const abrirExistente = async (path: string) => {
    try {
      const url = await getDocumentoSignedUrl(path);
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
    if (!draft.pais_origen.trim()) {
      toast.error("Indicá el país de origen.");
      return;
    }
    if (!draft.supplier_id) {
      toast.error("Elegí el proveedor del exterior.");
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado.");
      return;
    }

    const montoRaw = draft.monto_factura_usd.replace(",", ".").trim();
    const monto = montoRaw ? Number(montoRaw) : null;
    if (montoRaw && (!Number.isFinite(monto) || (monto ?? 0) < 0)) {
      toast.error("El monto USD no es válido.");
      return;
    }

    const payload = {
      supplier_id: draft.supplier_id,
      descripcion: draft.descripcion.trim(),
      pais_origen: draft.pais_origen.trim(),
      nro_orden_compra: emptyToNull(draft.nro_orden_compra),
      fecha_orden_compra: emptyToNull(draft.fecha_orden_compra),
      monto_factura_usd: monto,
      fecha_factura_provisoria: emptyToNull(draft.fecha_factura_provisoria),
      medio_transporte: (emptyToNull(draft.medio_transporte) as ImportacionMedioTransporte | null),
      nro_conocimiento: emptyToNull(draft.nro_conocimiento),
      fecha_embarque: emptyToNull(draft.fecha_embarque),
      fecha_estimada_llegada: emptyToNull(draft.fecha_estimada_llegada),
      fecha_llegada_real: emptyToNull(draft.fecha_llegada_real),
      fecha_nacionalizacion: emptyToNull(draft.fecha_nacionalizacion),
      nro_despacho: emptyToNull(draft.nro_despacho),
      despachante_nombre: emptyToNull(draft.despachante_nombre),
      despachante_telefono: emptyToNull(draft.despachante_telefono),
      notas: emptyToNull(draft.notas),
    };

    const supplierName = suppliers.find((s) => s.id === draft.supplier_id)?.name ?? "—";

    setGuardando(true);
    try {
      let id = importacion?.id ?? "";
      if (editando && importacion) {
        await updateImportacion(importacion.id, payload);
        onSaved({ ...importacion, ...payload, supplier_name: supplierName });
      } else {
        id = await insertImportacion(payload);
        onSaved({
          id,
          estado: "orden_compra",
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          supplier_name: supplierName,
          ...payload,
        });
      }

      if (pendingDocs.length && id) {
        let fallidos = 0;
        for (const doc of pendingDocs) {
          try {
            await uploadImportacionDocumento({
              importacionId: id,
              tipo: doc.tipo,
              file: doc.file,
              etapa: editando && importacion ? importacion.estado : "orden_compra",
              createdBy: user?.id ?? null,
            });
          } catch {
            fallidos += 1;
          }
        }
        if (fallidos) {
          toast.error(`La importación se guardó, pero ${fallidos} archivo${fallidos === 1 ? "" : "s"} no se subieron.`);
        } else if (editando) {
          toast.success("Importación actualizada.");
        } else {
          toast.success("Importación creada.");
        }
      } else {
        toast.success(editando ? "Importación actualizada." : "Importación creada.");
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
      <ProveedorFormDialog
        open={proveedorDialog}
        onOpenChange={setProveedorDialog}
        defaultOrigen="exterior"
        onSaved={(s) => {
          setSuppliers((prev) => {
            const sin = prev.filter((p) => p.id !== s.id);
            return [s, ...sin];
          });
          setDraft((d) => ({
            ...d,
            supplier_id: s.id,
            pais_origen: d.pais_origen || s.pais || "",
          }));
        }}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={dialogFormClassName}>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar importación" : "Nueva importación"}</DialogTitle>
            <DialogDescription>
              Expediente desde la orden de compra hasta la nacionalización. Podés adjuntar facturas y comprobantes ahora o más tarde.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Proveedor *</Label>
                <div className="flex w-full min-w-0 gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      value={draft.supplier_id || undefined}
                      onValueChange={(v) => {
                        const s = suppliers.find((x) => x.id === v);
                        setDraft((d) => ({
                          ...d,
                          supplier_id: v,
                          pais_origen: d.pais_origen || s?.pais || "",
                        }));
                      }}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                        <SelectValue placeholder="Elegí proveedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedSuppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                            {s.origen === "exterior" && s.pais ? ` · ${s.pais}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setProveedorDialog(true)}>
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
                  placeholder="Ej. Placas de cuarcita Taj Mahal"
                  autoFocus
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">País de origen *</Label>
                  <Input
                    className="h-9 w-full text-sm"
                    value={draft.pais_origen}
                    onChange={(e) => setDraft((d) => ({ ...d, pais_origen: e.target.value }))}
                    placeholder="Brasil, Italia…"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">N° orden de compra</Label>
                  <Input
                    className="h-9 w-full text-sm"
                    value={draft.nro_orden_compra}
                    onChange={(e) => setDraft((d) => ({ ...d, nro_orden_compra: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fecha OC</Label>
                  <FechaInput
                    className="h-9 w-full text-sm"
                    value={draft.fecha_orden_compra}
                    onChange={(iso) => setDraft((d) => ({ ...d, fecha_orden_compra: iso }))}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Monto factura USD</Label>
                  <Input
                    className="h-9 w-full text-sm"
                    inputMode="decimal"
                    value={draft.monto_factura_usd}
                    onChange={(e) => setDraft((d) => ({ ...d, monto_factura_usd: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Factura provisoria</Label>
                  <FechaInput
                    className="h-9 w-full text-sm"
                    value={draft.fecha_factura_provisoria}
                    onChange={(iso) => setDraft((d) => ({ ...d, fecha_factura_provisoria: iso }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Medio de transporte</Label>
                  <Select
                    value={draft.medio_transporte || "__none__"}
                    onValueChange={(v) => setDraft((d) => ({ ...d, medio_transporte: v === "__none__" ? "" : v }))}
                  >
                    <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                      <SelectValue placeholder="Sin especificar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin especificar</SelectItem>
                      {MEDIOS_TRANSPORTE.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <hr className="border-border" />

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">N° BL / AWB</Label>
                <Input
                  className="h-9 w-full text-sm"
                  value={draft.nro_conocimiento}
                  onChange={(e) => setDraft((d) => ({ ...d, nro_conocimiento: e.target.value }))}
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
              <div className="space-y-1">
                  <Label className="text-xs">Llegada estimada</Label>
                  <FechaInput
                    className="h-9 w-full text-sm"
                    value={draft.fecha_estimada_llegada}
                    onChange={(iso) => setDraft((d) => ({ ...d, fecha_estimada_llegada: iso }))}
                  />
              </div>
              <div className="space-y-1">
                  <Label className="text-xs">Llegada real</Label>
                  <FechaInput
                    className="h-9 w-full text-sm"
                    value={draft.fecha_llegada_real}
                    onChange={(iso) => setDraft((d) => ({ ...d, fecha_llegada_real: iso }))}
                  />
              </div>
              <div className="space-y-1">
                  <Label className="text-xs">Nacionalización</Label>
                  <FechaInput
                    className="h-9 w-full text-sm"
                    value={draft.fecha_nacionalizacion}
                    onChange={(iso) => setDraft((d) => ({ ...d, fecha_nacionalizacion: iso }))}
                  />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">N° despacho</Label>
                <Input
                  className="h-9 w-full text-sm"
                  value={draft.nro_despacho}
                  onChange={(e) => setDraft((d) => ({ ...d, nro_despacho: e.target.value }))}
                />
              </div>
            </div>

            <hr className="border-border" />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Despachante</Label>
                <Input
                  className="h-9 w-full text-sm"
                  value={draft.despachante_nombre}
                  onChange={(e) => setDraft((d) => ({ ...d, despachante_nombre: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tel. despachante</Label>
                <Input
                  className="h-9 w-full text-sm"
                  value={draft.despachante_telefono}
                  onChange={(e) => setDraft((d) => ({ ...d, despachante_telefono: e.target.value }))}
                />
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
                <Label className="text-xs">Documentos, facturas y comprobantes</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  PDF o imagen. Elegí el tipo y adjuntá uno o varios archivos.
                  Los nuevos quedan en {estadoLabel(editando && importacion ? importacion.estado : "orden_compra")}.
                </p>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <Select value={docTipo} onValueChange={(v) => setDocTipo(v as ImportacionDocumentoTipo)}>
                    <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPORTACION_DOCUMENTOS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
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
                          {documentoLabel(d.tipo)}
                          {d.etapa ? ` · ${estadoLabel(d.etapa)}` : " · Sin etapa"}
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
                          {documentoLabel(d.tipo)} · pendiente · {estadoLabel(editando && importacion ? importacion.estado : "orden_compra")}
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
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => void guardar()}
              disabled={!draft.descripcion.trim() || !draft.pais_origen.trim() || !draft.supplier_id || guardando}
            >
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear importación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
