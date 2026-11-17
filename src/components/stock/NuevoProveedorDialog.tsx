"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormClassName,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { insertSupplier } from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";

type NuevoProveedorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (supplierId: string, name: string) => void;
};

export function NuevoProveedorDialog({ open, onOpenChange, onCreated }: NuevoProveedorDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cuit, setCuit] = useState("");
  const [tax_condition, setTax_condition] = useState("");
  const [address, setAddress] = useState("");
  const [postal_code, setPostal_code] = useState("");
  const [province, setProvince] = useState("");
  const [locality, setLocality] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setPhone("");
    setEmail("");
    setCuit("");
    setTax_condition("");
    setAddress("");
    setPostal_code("");
    setProvince("");
    setLocality("");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleGrabar = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Indicá el nombre del proveedor.");
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado.");
      return;
    }
    setSaving(true);
    try {
      const id = await insertSupplier({
        name: trimmed,
        phone: phone.trim() || null,
        email: email.trim() || null,
        cuit: cuit.trim() || null,
        tax_condition: tax_condition.trim() || null,
        address: address.trim() || null,
        postal_code: postal_code.trim() || null,
        province: province.trim() || null,
        locality: locality.trim() || null,
      });
      toast.success("Proveedor guardado.");
      onCreated(id, trimmed);
      handleClose(false);
    } catch {
      toast.error("No se pudo guardar el proveedor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={dialogFormClassName}>
        <DialogHeader>
          <DialogTitle>Nuevo proveedor</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="np-nombre">Proveedor</Label>
            <Input
              id="np-nombre"
              placeholder="Nombre del proveedor"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-tel">Tel. / Celular</Label>
            <Input
              id="np-tel"
              placeholder="Teléfono contacto"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-email">Email</Label>
            <Input
              id="np-email"
              type="email"
              placeholder="Email del proveedor"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="np-cuit">Número CUIT</Label>
            <Input
              id="np-cuit"
              placeholder="Número de CUIT"
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-iva">Condición IVA</Label>
            <Input
              id="np-iva"
              placeholder="Ej. Responsable Inscripto"
              value={tax_condition}
              onChange={(e) => setTax_condition(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-dir">Dirección</Label>
            <Input
              id="np-dir"
              placeholder="Dirección"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-cp">Código postal</Label>
            <Input
              id="np-cp"
              placeholder="Código postal"
              value={postal_code}
              onChange={(e) => setPostal_code(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-prov">Provincia</Label>
            <Input
              id="np-prov"
              placeholder="Provincia"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="np-loc">Localidad / Barrio</Label>
            <Input
              id="np-loc"
              placeholder="Localidad / Barrio"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Cerrar
          </Button>
          <Button type="button" onClick={handleGrabar} disabled={saving}>
            Grabar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
