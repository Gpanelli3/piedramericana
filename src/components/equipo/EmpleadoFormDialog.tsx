"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FechaInput } from "@/components/ui/fecha-input";
import {
  Dialog,
  DialogClose,
  DialogContent,
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
  createEmpleado,
  updateEmpleado,
  PUESTOS_EMPLEADO,
  type EmpleadoInput,
  type EmpleadoRow,
} from "@/lib/empleados-api";
import { isSupabaseConfigured } from "@/lib/supabase";

export type EmpleadoDraft = {
  nombre: string;
  apellido: string;
  dni: string;
  cuil: string;
  telefono: string;
  email: string;
  fecha_ingreso: string;
  puesto: string;
  sueldo_base: string;
  activo: boolean;
  notas: string;
};

function emptyDraft(): EmpleadoDraft {
  return {
    nombre: "",
    apellido: "",
    dni: "",
    cuil: "",
    telefono: "",
    email: "",
    fecha_ingreso: "",
    puesto: "",
    sueldo_base: "",
    activo: true,
    notas: "",
  };
}

function empleadoToDraft(e: EmpleadoRow): EmpleadoDraft {
  const sueldo = Number(e.sueldo_base);
  return {
    nombre: e.nombre,
    apellido: e.apellido,
    dni: e.dni ?? "",
    cuil: e.cuil ?? "",
    telefono: e.telefono ?? "",
    email: e.email ?? "",
    fecha_ingreso: e.fecha_ingreso ?? "",
    puesto: e.puesto ?? "",
    sueldo_base: Number.isFinite(sueldo) && sueldo !== 0 ? String(sueldo) : sueldo === 0 ? "0" : "",
    activo: e.activo,
    notas: e.notas ?? "",
  };
}

function draftToInput(draft: EmpleadoDraft): EmpleadoInput {
  const sueldoRaw = draft.sueldo_base.trim().replace(",", ".");
  const sueldo = sueldoRaw === "" ? 0 : Number(sueldoRaw);
  return {
    nombre: draft.nombre,
    apellido: draft.apellido,
    dni: draft.dni,
    cuil: draft.cuil,
    telefono: draft.telefono,
    email: draft.email,
    fecha_ingreso: draft.fecha_ingreso,
    puesto: draft.puesto,
    sueldo_base: sueldo,
    activo: draft.activo,
    notas: draft.notas,
  };
}

type EmpleadoFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empleado?: EmpleadoRow | null;
  onSaved: (empleado: EmpleadoRow) => void;
};

export function EmpleadoFormDialog({
  open,
  onOpenChange,
  empleado = null,
  onSaved,
}: EmpleadoFormDialogProps) {
  const editando = Boolean(empleado?.id);
  const [draft, setDraft] = useState<EmpleadoDraft>(() => emptyDraft());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(empleado ? empleadoToDraft(empleado) : emptyDraft());
  }, [open, empleado]);

  const puedeGuardar = Boolean(draft.nombre.trim() && draft.apellido.trim());

  const guardar = async () => {
    if (!puedeGuardar) return;
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado; no se puede guardar el empleado.");
      return;
    }

    const input = draftToInput(draft);
    if (!Number.isFinite(input.sueldo_base ?? 0) || (input.sueldo_base ?? 0) < 0) {
      toast.error("El sueldo base no es válido");
      return;
    }

    setGuardando(true);
    try {
      const result =
        editando && empleado
          ? await updateEmpleado(empleado.id, input)
          : await createEmpleado(input);

      if (result.error || !result.data) {
        toast.error(result.error?.message ?? "No se pudo guardar el empleado");
        return;
      }

      onSaved(result.data);
      onOpenChange(false);
      toast.success(editando ? "Empleado actualizado" : "Empleado guardado");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editando ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input
                className="h-9 text-sm"
                value={draft.nombre}
                onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Apellido</Label>
              <Input
                className="h-9 text-sm"
                value={draft.apellido}
                onChange={(e) => setDraft((d) => ({ ...d, apellido: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">DNI</Label>
              <Input
                className="h-9 text-sm"
                value={draft.dni}
                onChange={(e) => setDraft((d) => ({ ...d, dni: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CUIL</Label>
              <Input
                className="h-9 text-sm"
                value={draft.cuil}
                onChange={(e) => setDraft((d) => ({ ...d, cuil: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Tel. / Celular</Label>
              <Input
                className="h-9 text-sm"
                value={draft.telefono}
                onChange={(e) => setDraft((d) => ({ ...d, telefono: e.target.value }))}
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
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Fecha de ingreso</Label>
              <FechaInput
                value={draft.fecha_ingreso}
                onChange={(iso) => setDraft((d) => ({ ...d, fecha_ingreso: iso }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Puesto</Label>
              <Select
                value={draft.puesto || undefined}
                onValueChange={(v) => setDraft((d) => ({ ...d, puesto: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar…" />
                </SelectTrigger>
                <SelectContent>
                  {PUESTOS_EMPLEADO.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sueldo base</Label>
            <Input
              className="h-9 text-sm"
              inputMode="decimal"
              value={draft.sueldo_base}
              onChange={(e) => setDraft((d) => ({ ...d, sueldo_base: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notas internas</Label>
            <Textarea
              className="min-h-[72px] resize-y text-sm"
              maxLength={500}
              value={draft.notas}
              onChange={(e) => setDraft((d) => ({ ...d, notas: e.target.value }))}
              placeholder="Referencias, observaciones…"
            />
            <p className="text-right text-[10px] text-muted-foreground">{draft.notas.length}/500</p>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div>
              <Label className="text-xs">Activo</Label>
              <p className="text-[11px] text-muted-foreground">
                Si está off, no figura entre el personal en actividad.
              </p>
            </div>
            <Switch
              checked={draft.activo}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, activo: v }))}
            />
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
            disabled={!puedeGuardar || guardando}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
