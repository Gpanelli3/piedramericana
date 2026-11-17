"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  createClient,
  updateClient,
  type ClienteInput,
  type ClientePresupuesto,
} from "@/lib/clients-api";
import { isSupabaseConfigured } from "@/lib/supabase";

export type ClienteDraft = {
  nombre: string;
  contacto: string;
  tel: string;
  email: string;
  direccion: string;
  notes: string;
  esAgenteRetencion: boolean;
  retencionPorcentaje: string;
};

export function emptyClienteDraft(prefillNombre = ""): ClienteDraft {
  return {
    nombre: prefillNombre,
    contacto: "",
    tel: "",
    email: "",
    direccion: "",
    notes: "",
    esAgenteRetencion: false,
    retencionPorcentaje: "",
  };
}

export function clienteToDraft(c: ClientePresupuesto): ClienteDraft {
  return {
    nombre: c.nombre,
    contacto: c.contacto === c.nombre ? "" : c.contacto,
    tel: c.tel,
    email: c.email,
    direccion: c.direccion,
    notes: c.notes,
    esAgenteRetencion: c.esAgenteRetencion,
    retencionPorcentaje:
      c.esAgenteRetencion && c.retencionPorcentaje != null
        ? String(c.retencionPorcentaje)
        : "",
  };
}

function CampoLectura({ label, value, multilinea = false }: {
  label: string;
  value: string;
  multilinea?: boolean;
}) {
  const texto = value.trim() || "—";
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className={multilinea ? "whitespace-pre-wrap text-sm" : "min-h-9 text-sm leading-9"}>
        {texto}
      </p>
    </div>
  );
}

type ClienteFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si viene, edita; si no, crea. */
  cliente?: ClientePresupuesto | null;
  /** Prefill al abrir en modo alta (p. ej. texto del buscador del presupuesto). */
  prefillNombre?: string;
  titulo?: string;
  descripcion?: string;
  /** Abre en lectura; el lápiz pasa a edición. */
  modoVista?: boolean;
  onSaved: (cliente: ClientePresupuesto) => void;
};

export function ClienteFormDialog({
  open,
  onOpenChange,
  cliente = null,
  prefillNombre = "",
  titulo,
  descripcion,
  modoVista = false,
  onSaved,
}: ClienteFormDialogProps) {
  const editando = Boolean(cliente?.id);
  const [draft, setDraft] = useState<ClienteDraft>(() => emptyClienteDraft());
  const [guardando, setGuardando] = useState(false);
  const [enEdicion, setEnEdicion] = useState(!modoVista);

  useEffect(() => {
    if (!open) return;
    setDraft(cliente ? clienteToDraft(cliente) : emptyClienteDraft(prefillNombre));
    setEnEdicion(!modoVista);
  }, [open, cliente, prefillNombre, modoVista]);

  const soloLectura = modoVista && !enEdicion;

  const guardar = async () => {
    if (!draft.nombre.trim()) return;
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado; no se puede guardar el cliente.");
      return;
    }

    const pctRaw = draft.retencionPorcentaje.trim().replace(",", ".");
    const pct = pctRaw === "" ? null : Number(pctRaw);
    if (draft.esAgenteRetencion && (pct == null || !Number.isFinite(pct) || pct < 0 || pct > 100)) {
      toast.error("Indicá el porcentaje de retención (entre 0 y 100).");
      return;
    }

    const input: ClienteInput = {
      nombre: draft.nombre,
      contacto: draft.contacto,
      tel: draft.tel,
      email: draft.email,
      direccion: draft.direccion,
      notes: draft.notes,
      esAgenteRetencion: draft.esAgenteRetencion,
      retencionPorcentaje: draft.esAgenteRetencion ? pct : null,
    };

    setGuardando(true);
    try {
      const result = editando && cliente
        ? await updateClient(cliente.id, input)
        : await createClient(input);

      if (result.error || !result.data) {
        toast.error(result.error?.message ?? "No se pudo guardar el cliente");
        return;
      }

      onSaved(result.data);
      onOpenChange(false);
      toast.success(editando ? "Cliente actualizado" : "Cliente guardado");
    } finally {
      setGuardando(false);
    }
  };

  const cancelarEdicion = () => {
    if (modoVista && cliente) {
      setDraft(clienteToDraft(cliente));
      setEnEdicion(false);
      return;
    }
    onOpenChange(false);
  };

  const tituloMostrado = titulo ?? (editando ? "Editar cliente" : "Nuevo cliente");
  const descripcionMostrada = soloLectura
    ? (descripcion ?? "Teléfono, mail, contacto de obra y dirección.")
    : modoVista
      ? "Los cambios quedan en el maestro y se usan en próximos presupuestos."
      : (descripcion ??
        (editando
          ? "Los cambios quedan en el maestro y se usan en próximos presupuestos."
          : "Se guarda en la base de datos y queda disponible para próximos presupuestos."));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogFormClassName} showCloseButton>
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0 space-y-2">
              <DialogTitle>{tituloMostrado}</DialogTitle>
              <DialogDescription>{descripcionMostrada}</DialogDescription>
            </div>
            {soloLectura ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                title="Editar"
                onClick={() => setEnEdicion(true)}
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Editar</span>
              </Button>
            ) : null}
          </div>
        </DialogHeader>
        {soloLectura ? (
          <div className="grid gap-3 py-2">
            <CampoLectura label="Nombre / razón social" value={draft.nombre} />
            <CampoLectura label="Contacto" value={draft.contacto} />
            <div className="grid grid-cols-2 gap-2">
              <CampoLectura label="Tel. / Celular" value={draft.tel} />
              <CampoLectura label="Email" value={draft.email} />
            </div>
            <CampoLectura label="Dirección" value={draft.direccion} />
            <CampoLectura
              label="Agente de retención"
              value={
                draft.esAgenteRetencion
                  ? draft.retencionPorcentaje.trim()
                    ? `${draft.retencionPorcentaje.trim()}%`
                    : "Sí"
                  : "No"
              }
            />
            <CampoLectura label="Notas internas" value={draft.notes} multilinea />
          </div>
        ) : (
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nombre / razón social</Label>
              <Input
                className="h-9 text-sm"
                value={draft.nombre}
                onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contacto</Label>
              <Input
                className="h-9 text-sm"
                value={draft.contacto}
                onChange={(e) => setDraft((d) => ({ ...d, contacto: e.target.value }))}
                placeholder="Quien recibe / habla por la obra"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Tel. / Celular</Label>
                <Input
                  className="h-9 text-sm"
                  value={draft.tel}
                  onChange={(e) => setDraft((d) => ({ ...d, tel: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  className="h-9 text-sm"
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dirección</Label>
              <Input
                className="h-9 text-sm"
                value={draft.direccion}
                onChange={(e) => setDraft((d) => ({ ...d, direccion: e.target.value }))}
              />
            </div>
            <div className="space-y-2 rounded-md border border-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="agente-retencion"
                  checked={draft.esAgenteRetencion}
                  onCheckedChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      esAgenteRetencion: v === true,
                      retencionPorcentaje: v === true ? d.retencionPorcentaje : "",
                    }))
                  }
                />
                <Label htmlFor="agente-retencion" className="text-xs font-medium">
                  Agente de retención
                </Label>
              </div>
              {draft.esAgenteRetencion ? (
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="retencion-porcentaje">
                    Porcentaje
                  </Label>
                  <div className="relative max-w-[8rem]">
                    <Input
                      id="retencion-porcentaje"
                      className="h-9 pr-7 text-sm"
                      inputMode="decimal"
                      placeholder="5 o 10"
                      value={draft.retencionPorcentaje}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, retencionPorcentaje: e.target.value }))
                      }
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas internas</Label>
              <Textarea
                className="min-h-[72px] resize-y text-sm"
                maxLength={500}
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Referencias, preferencias, etc. (no salen en el PDF)"
              />
              <p className="text-right text-[10px] text-muted-foreground">
                {draft.notes.length}/500
              </p>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          {soloLectura ? (
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cerrar
              </Button>
            </DialogClose>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={cancelarEdicion}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void guardar()}
                disabled={!draft.nombre.trim() || guardando}
              >
                {guardando ? "Guardando…" : "Guardar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
