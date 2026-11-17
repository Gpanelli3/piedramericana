"use client";

import { useEffect, useState } from "react";
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
  createIncentivo,
  INCENTIVO_TIPOS,
  type IncentivoConEmpleado,
} from "@/lib/incentivos-api";
import { hoyIso, parseMonto } from "@/lib/sueldos-calculos";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { IncentivoTipo } from "@/types/database";

type Draft = {
  empleado_id: string;
  fecha: string;
  tipo: IncentivoTipo;
  descripcion: string;
  monto: string;
  moneda: "ars" | "usd";
  metodo: "efectivo" | "transferencia" | "cheque";
};

function emptyDraft(): Draft {
  return {
    empleado_id: "",
    fecha: hoyIso(),
    tipo: "premio",
    descripcion: "",
    monto: "",
    moneda: "ars",
    metodo: "efectivo",
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (row: IncentivoConEmpleado) => void;
};

export function IncentivoFormDialog({ open, onOpenChange, onSaved }: Props) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [guardando, setGuardando] = useState(false);
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setDraft(emptyDraft());
    if (!isSupabaseConfigured) return;
    void listEmpleados().then((res) => {
      if (!res.error) setEmpleados(res.data.filter((e) => e.activo));
    });
  }, [open]);

  const guardar = async () => {
    const monto = parseMonto(draft.monto);
    if (!(monto > 0)) {
      toast.error("Indicá un monto.");
      return;
    }
    setGuardando(true);
    const res = await createIncentivo({
      ...draft,
      monto,
      created_by: user?.id ?? null,
    });
    setGuardando(false);
    if (res.error || !res.data) {
      toast.error(res.error?.message ?? "No se pudo guardar.");
      return;
    }
    toast.success("Incentivo registrado y cargado en finanzas.");
    onSaved(res.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogFormClassName}>
        <DialogHeader>
          <DialogTitle>Nuevo incentivo</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Empleado</Label>
            <Select
              value={draft.empleado_id}
              onValueChange={(v) => setDraft((d) => ({ ...d, empleado_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elegí" />
              </SelectTrigger>
              <SelectContent>
                {empleados.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {nombreEmpleado(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={draft.tipo}
                onValueChange={(v) => setDraft((d) => ({ ...d, tipo: v as IncentivoTipo }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCENTIVO_TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha</Label>
              <FechaInput value={draft.fecha} onChange={(iso) => setDraft((d) => ({ ...d, fecha: iso }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Monto</Label>
              <Input
                inputMode="decimal"
                value={draft.monto}
                onChange={(e) => setDraft((d) => ({ ...d, monto: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select
                value={draft.moneda}
                onValueChange={(v) => setDraft((d) => ({ ...d, moneda: v as "ars" | "usd" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ars">Pesos</SelectItem>
                  <SelectItem value="usd">Dólares</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Pago</Label>
              <Select
                value={draft.metodo}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, metodo: v as Draft["metodo"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Nota</Label>
            <Textarea
              rows={2}
              value={draft.descripcion}
              onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" disabled={guardando} onClick={() => void guardar()}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
