"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FechaInput } from "@/components/ui/fecha-input";
import {
  Dialog,
  DialogClose,
  DialogContent,
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
import { useAuth } from "@/contexts/AuthContext";
import { listEmpleados, nombreEmpleado, type EmpleadoRow } from "@/lib/empleados-api";
import {
  createAdelanto,
  updateAdelanto,
  type AdelantoConEmpleado,
} from "@/lib/sueldos-api";
import { hoyIso, parseMonto } from "@/lib/sueldos-calculos";
import { isSupabaseConfigured } from "@/lib/supabase";

type Draft = {
  empleado_id: string;
  fecha: string;
  monto: string;
  metodo: "efectivo" | "transferencia";
  notas: string;
};

function emptyDraft(): Draft {
  return {
    empleado_id: "",
    fecha: hoyIso(),
    monto: "",
    metodo: "efectivo",
    notas: "",
  };
}

type AdelantoFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adelanto?: AdelantoConEmpleado | null;
  /** Empleado preseleccionado al registrar uno nuevo (p. ej. desde la ficha). */
  empleadoIdInicial?: string | null;
  onSaved: (row: AdelantoConEmpleado) => void;
};

export function AdelantoFormDialog({
  open,
  onOpenChange,
  adelanto = null,
  empleadoIdInicial = null,
  onSaved,
}: AdelantoFormDialogProps) {
  const { user } = useAuth();
  const editando = Boolean(adelanto?.id);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [guardando, setGuardando] = useState(false);
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);

  useEffect(() => {
    if (!open) return;
    if (adelanto) {
      setDraft({
        empleado_id: adelanto.empleado_id,
        fecha: adelanto.fecha,
        monto: String(adelanto.monto),
        metodo: adelanto.metodo,
        notas: adelanto.notas ?? "",
      });
    } else {
      setDraft({ ...emptyDraft(), empleado_id: empleadoIdInicial ?? "" });
    }
    void listEmpleados().then(({ data }) => setEmpleados(data));
  }, [open, adelanto, empleadoIdInicial]);

  const opciones = useMemo(
    () => empleados.filter((e) => e.activo || e.id === draft.empleado_id),
    [empleados, draft.empleado_id],
  );

  const puedeGuardar = Boolean(draft.empleado_id && draft.fecha && draft.monto.trim());

  const guardar = async () => {
    if (!puedeGuardar) return;
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado; no se puede guardar el adelanto.");
      return;
    }
    const monto = parseMonto(draft.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error("El monto tiene que ser mayor a 0");
      return;
    }

    setGuardando(true);
    try {
      const input = {
        empleado_id: draft.empleado_id,
        fecha: draft.fecha,
        monto,
        metodo: draft.metodo,
        notas: draft.notas,
        created_by: user?.id ?? null,
      };
      const result =
        editando && adelanto
          ? await updateAdelanto(adelanto.id, input)
          : await createAdelanto(input);

      if (result.error || !result.data) {
        toast.error(result.error?.message ?? "No se pudo guardar el adelanto");
        return;
      }
      onSaved(result.data);
      onOpenChange(false);
      toast.success(editando ? "Adelanto actualizado" : "Adelanto registrado");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogFormClassName} showCloseButton aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editando ? "Editar adelanto" : "Nuevo adelanto"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Empleado</Label>
            <Select
              value={draft.empleado_id || undefined}
              onValueChange={(v) => setDraft((d) => ({ ...d, empleado_id: v }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Seleccionar…" />
              </SelectTrigger>
              <SelectContent>
                {opciones.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {nombreEmpleado(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <FechaInput
                value={draft.fecha}
                onChange={(iso) => setDraft((d) => ({ ...d, fecha: iso }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Método</Label>
              <Select
                value={draft.metodo}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, metodo: v as Draft["metodo"] }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monto</Label>
            <Input
              className="h-9 text-sm"
              inputMode="decimal"
              value={draft.monto}
              onChange={(e) => setDraft((d) => ({ ...d, monto: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notas</Label>
            <Textarea
              className="min-h-[72px] resize-y text-sm"
              maxLength={500}
              value={draft.notas}
              onChange={(e) => setDraft((d) => ({ ...d, notas: e.target.value }))}
              placeholder="Viático, motivo, referencia…"
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
