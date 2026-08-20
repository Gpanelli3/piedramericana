"use client";

import { useEffect, useState } from "react";
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

type ClienteFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si viene, edita; si no, crea. */
  cliente?: ClientePresupuesto | null;
  /** Prefill al abrir en modo alta (p. ej. texto del buscador del presupuesto). */
  prefillNombre?: string;
  onSaved: (cliente: ClientePresupuesto) => void;
};

export function ClienteFormDialog({
  open,
  onOpenChange,
  cliente = null,
  prefillNombre = "",
  onSaved,
}: ClienteFormDialogProps) {
  const editando = Boolean(cliente?.id);
  const [draft, setDraft] = useState<ClienteDraft>(() => emptyClienteDraft());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(cliente ? clienteToDraft(cliente) : emptyClienteDraft(prefillNombre));
  }, [open, cliente, prefillNombre]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{editando ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "Los cambios quedan en el maestro y se usan en próximos presupuestos."
              : "Se guarda en la base de datos y queda disponible para próximos presupuestos."}
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() => void guardar()}
            disabled={!draft.nombre.trim() || guardando}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
