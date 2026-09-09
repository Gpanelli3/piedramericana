"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
};

export function emptyClienteDraft(prefillNombre = ""): ClienteDraft {
  return {
    nombre: prefillNombre,
    contacto: "",
    tel: "",
    email: "",
    direccion: "",
    notes: "",
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

    const input: ClienteInput = {
      nombre: draft.nombre,
      contacto: draft.contacto,
      tel: draft.tel,
      email: draft.email,
      direccion: draft.direccion,
      notes: draft.notes,
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
      <DialogContent className="sm:max-w-md" showCloseButton>
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
