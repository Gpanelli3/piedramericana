"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  insertSupplier,
  updateSupplier,
  RUBROS_PROVEEDOR,
  ORIGENES_PROVEEDOR,
  CONDICIONES_IVA,
  type SupplierRow,
  type SupplierOrigen,
} from "@/lib/suppliers-api";
import { isSupabaseConfigured } from "@/lib/supabase";

export type ProveedorDraft = {
  name: string;
  rubros: string[];
  origen: SupplierOrigen;
  cuit: string;
  tax_condition: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  postal_code: string;
  province: string;
  locality: string;
  pais: string;
  notes: string;
  activo: boolean;
};

function emptyDraft(): ProveedorDraft {
  return {
    name: "",
    rubros: [],
    origen: "nacional",
    cuit: "",
    tax_condition: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    postal_code: "",
    province: "",
    locality: "",
    pais: "",
    notes: "",
    activo: true,
  };
}

function supplierToDraft(s: SupplierRow): ProveedorDraft {
  return {
    name: s.name,
    rubros: s.rubros ?? [],
    origen: s.origen ?? "nacional",
    cuit: s.cuit ?? "",
    tax_condition: s.tax_condition ?? "",
    contact_name: s.contact_name ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    address: s.address ?? "",
    postal_code: s.postal_code ?? "",
    province: s.province ?? "",
    locality: s.locality ?? "",
    pais: s.pais ?? "",
    notes: s.notes ?? "",
    activo: s.activo ?? true,
  };
}

type ProveedorFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: SupplierRow | null;
  onSaved: (supplier: SupplierRow) => void;
  defaultOrigen?: SupplierOrigen;
};

export function ProveedorFormDialog({
  open,
  onOpenChange,
  supplier = null,
  onSaved,
  defaultOrigen = "nacional",
}: ProveedorFormDialogProps) {
  const editando = Boolean(supplier?.id);
  const [draft, setDraft] = useState<ProveedorDraft>(emptyDraft);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (supplier) {
      setDraft(supplierToDraft(supplier));
      return;
    }
    const base = emptyDraft();
    setDraft({ ...base, origen: defaultOrigen });
  }, [open, supplier, defaultOrigen]);

  const toggleRubro = (rubro: string) => {
    setDraft((d) => ({
      ...d,
      rubros: d.rubros.includes(rubro)
        ? d.rubros.filter((r) => r !== rubro)
        : [...d.rubros, rubro],
    }));
  };

  const guardar = async () => {
    if (!draft.name.trim()) {
      toast.error("Indicá el nombre del proveedor.");
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado.");
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        name: draft.name.trim(),
        rubros: draft.rubros,
        origen: draft.origen,
        cuit: draft.cuit.trim() || null,
        tax_condition: draft.tax_condition.trim() || null,
        contact_name: draft.contact_name.trim() || null,
        phone: draft.phone.trim() || null,
        email: draft.email.trim() || null,
        address: draft.address.trim() || null,
        postal_code: draft.postal_code.trim() || null,
        province: draft.province.trim() || null,
        locality: draft.locality.trim() || null,
        pais: draft.pais.trim() || null,
        notes: draft.notes.trim() || null,
        activo: draft.activo,
      };

      if (editando && supplier) {
        await updateSupplier(supplier.id, payload);
        onSaved({ ...supplier, ...payload } as SupplierRow);
        toast.success("Proveedor actualizado.");
      } else {
        const id = await insertSupplier(payload);
        onSaved({ id, created_at: new Date().toISOString(), ...payload } as SupplierRow);
        toast.success("Proveedor guardado.");
      }
      onOpenChange(false);
    } catch {
      toast.error("No se pudo guardar el proveedor.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "Los cambios quedan en el maestro y se usan en próximos remitos."
              : "Se guarda en la base y queda disponible para remitos, cantera y pagos."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* ── Identidad + fiscal ── */}
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre / razón social *</Label>
              <Input
                className="h-9 text-sm"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rubros</Label>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {RUBROS_PROVEEDOR.map((r) => (
                  <label key={r.value} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={draft.rubros.includes(r.value)}
                      onCheckedChange={() => toggleRubro(r.value)}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>
            <div className={`grid gap-3 ${draft.origen === "exterior" ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
              <div className="space-y-1">
                <Label className="text-xs">Origen</Label>
                <Select
                  value={draft.origen}
                  onValueChange={(v) => setDraft((d) => ({ ...d, origen: v as SupplierOrigen }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGENES_PROVEEDOR.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {draft.origen === "exterior" && (
                <div className="space-y-1">
                  <Label className="text-xs">País</Label>
                  <Input
                    className="h-9 text-sm"
                    value={draft.pais}
                    onChange={(e) => setDraft((d) => ({ ...d, pais: e.target.value }))}
                    placeholder="Ej. Brasil, Italia"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">CUIT</Label>
                <Input
                  className="h-9 text-sm"
                  value={draft.cuit}
                  onChange={(e) => setDraft((d) => ({ ...d, cuit: e.target.value }))}
                  placeholder="XX-XXXXXXXX-X"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Condición IVA</Label>
                <Select
                  value={draft.tax_condition || "__none__"}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, tax_condition: v === "__none__" ? "" : v }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Sin especificar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin especificar</SelectItem>
                    {CONDICIONES_IVA.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <hr className="border-border" />

          {/* ── Contacto ── */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Persona de contacto</Label>
              <Input
                className="h-9 text-sm"
                value={draft.contact_name}
                onChange={(e) => setDraft((d) => ({ ...d, contact_name: e.target.value }))}
                placeholder="Quien atiende pedidos"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tel. / Celular</Label>
              <Input
                className="h-9 text-sm"
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
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

          <hr className="border-border" />

          {/* ── Domicilio ── */}
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dirección</Label>
              <Input
                className="h-9 text-sm"
                value={draft.address}
                onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Localidad</Label>
                <Input
                  className="h-9 text-sm"
                  value={draft.locality}
                  onChange={(e) => setDraft((d) => ({ ...d, locality: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Provincia</Label>
                <Input
                  className="h-9 text-sm"
                  value={draft.province}
                  onChange={(e) => setDraft((d) => ({ ...d, province: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Código postal</Label>
                <Input
                  className="h-9 text-sm"
                  value={draft.postal_code}
                  onChange={(e) => setDraft((d) => ({ ...d, postal_code: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <hr className="border-border" />

          {/* ── Notas + Activo ── */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Notas internas</Label>
              <Textarea
                className="min-h-[56px] resize-y text-sm"
                maxLength={500}
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Referencias, condiciones, etc."
              />
            </div>
            {editando && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Checkbox
                  checked={draft.activo}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, activo: Boolean(v) }))}
                />
                Proveedor activo
              </label>
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
            disabled={!draft.name.trim() || guardando}
          >
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear proveedor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
