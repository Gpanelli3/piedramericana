"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { ListaPrecioRow } from "@/types/articulos";
import type { ClientePresupuesto } from "@/lib/clients-api";
import { ORIGEN_VENTA_OPCIONES } from "@/data/origen-venta";
import { PickCliente, SectionPresupuesto } from "./fields";
import { ListaPrecioSelector } from "./ListaPrecioSelector";

type StepClienteProps = {
  clientesLocales: ClientePresupuesto[];
  clientesCargando?: boolean;
  clienteSeleccionadoId: string | null;
  aplicarCliente: (c: ClientePresupuesto) => void;
  limpiarCliente: () => void;
  abrirNuevoCliente: (prefillNombre?: string) => void;
  listasPrecios: ListaPrecioRow[];
  listaPrecioId: string;
  setListaPrecioId: (id: string) => void;
  monedaPresupuesto: "ars" | "usd";
  dolarHoy: number;
  setDolarHoy: (n: number) => void;
  origenVentas: string;
  setOrigenVentas: (v: string) => void;
  contacto: string;
  setContacto: (v: string) => void;
  tel: string;
  setTel: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  direccion: string;
  setDireccion: (v: string) => void;
  obsCabecera: string;
  setObsCabecera: (v: string) => void;
};

export function StepCliente({
  clientesLocales,
  clientesCargando = false,
  clienteSeleccionadoId,
  aplicarCliente,
  limpiarCliente,
  abrirNuevoCliente,
  listasPrecios,
  listaPrecioId,
  setListaPrecioId,
  monedaPresupuesto,
  dolarHoy,
  setDolarHoy,
  origenVentas,
  setOrigenVentas,
  contacto,
  setContacto,
  tel,
  setTel,
  email,
  setEmail,
  direccion,
  setDireccion,
  obsCabecera,
  setObsCabecera,
}: StepClienteProps) {
  return (
    <SectionPresupuesto borderAccentClass="">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <Label>Cliente</Label>
            <PickCliente
              clientes={clientesLocales}
              value={clienteSeleccionadoId}
              onChange={aplicarCliente}
              onClear={limpiarCliente}
              onNuevoCliente={abrirNuevoCliente}
              loading={clientesCargando}
            />
          </div>
          <div className="flex shrink-0 justify-end sm:justify-start sm:pb-px">
            <Button
              type="button"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => abrirNuevoCliente()}
              title="Nuevo cliente (si no aparece en el buscador)"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <ListaPrecioSelector
            listasPrecios={listasPrecios}
            listaPrecioId={listaPrecioId}
            onChange={setListaPrecioId}
          />
          <div className="space-y-1">
            <Label>Moneda de la lista</Label>
            <div className="flex h-10 items-center rounded-lg border border-input bg-muted/40 px-3 text-sm">
              {monedaPresupuesto === "usd" ? "Dólares (USD)" : "Pesos (ARS)"}
            </div>
          </div>
          {monedaPresupuesto === "usd" ? (
            <div className="space-y-1">
              <Label>Dólar del día</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  className="pl-7 tabular-nums"
                  inputMode="decimal"
                  value={Number.isFinite(dolarHoy) && dolarHoy > 0 ? String(dolarHoy) : ""}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    setDolarHoy(Number.isFinite(n) && n > 0 ? n : 0);
                  }}
                  placeholder="1250"
                />
              </div>
            </div>
          ) : null}
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label>Origen</Label>
            <Select value={origenVentas || undefined} onValueChange={setOrigenVentas}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegir origen…" />
              </SelectTrigger>
              <SelectContent>
                {ORIGEN_VENTA_OPCIONES.filter((o) => o.value !== "").map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Contacto</Label>
            <Input
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Tel. / Celular</Label>
            <Input
              value={tel}
              onChange={(e) => setTel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 xl:items-start">
          <div className="space-y-1">
            <Label>Dirección de entrega</Label>
            <Input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Observaciones grales.</Label>
            <Textarea
              className="max-h-32 resize-y"
              placeholder="Observaciones Grales - Max. 500 caracteres"
              maxLength={500}
              value={obsCabecera}
              onChange={(e) => setObsCabecera(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground text-right leading-none pt-0.5">
              {obsCabecera.length}/500
            </p>
          </div>
        </div>
      </div>
    </SectionPresupuesto>
  );
}
