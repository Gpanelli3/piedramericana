"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { LISTAS_PRECIO_MOCK } from "@/data/presupuesto-articulos-mock";
import {
  CLIENTES_PRESUPUESTO_MOCK,
  ORIGEN_VENTA_OPCIONES,
} from "@/data/presupuesto-clientes-mock";
import { PickCliente } from "../PickCliente";

interface ClienteStepProps {
  clienteSeleccionadoId: string | null;
  onClienteChange: (clienteId: string) => void;
  onNuevoCliente: (textoBuscado: string) => void;
  listaPrecioId: string;
  onListaPrecioChange: (id: string) => void;
  monedaPresupuesto: "usd" | "ars";
  onMonedaChange: (moneda: "usd" | "ars") => void;
  origenVentas: string;
  onOrigenChange: (origen: string) => void;
  contacto: string;
  onContactoChange: (contacto: string) => void;
  tel: string;
  onTelChange: (tel: string) => void;
  email: string;
  onEmailChange: (email: string) => void;
  direccion: string;
  onDireccionChange: (direccion: string) => void;
  obsCabecera: string;
  onObsCabeceraChange: (obs: string) => void;
}

function SectionClienteStep({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-white overflow-hidden shadow-sm">
      <div className="border-b border-border bg-muted/35 px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function ClienteStep({
  clienteSeleccionadoId,
  onClienteChange,
  onNuevoCliente,
  listaPrecioId,
  onListaPrecioChange,
  monedaPresupuesto,
  onMonedaChange,
  origenVentas,
  onOrigenChange,
  contacto,
  onContactoChange,
  tel,
  onTelChange,
  email,
  onEmailChange,
  direccion,
  onDireccionChange,
  obsCabecera,
  onObsCabeceraChange,
}: ClienteStepProps) {
  const clienteSeleccionado = CLIENTES_PRESUPUESTO_MOCK.find(
    (c) => c.id === clienteSeleccionadoId,
  );

  return (
    <div className="space-y-6">
      <SectionClienteStep title="Cliente / Profesional">
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <Label className="text-xs font-medium text-foreground">
                Cliente / Profesional
              </Label>
              <PickCliente
                clientes={CLIENTES_PRESUPUESTO_MOCK}
                value={clienteSeleccionadoId}
                onChange={(c) => onClienteChange(c.id)}
                onNuevoCliente={onNuevoCliente}
              />
            </div>
            <div className="flex shrink-0 justify-end sm:justify-start sm:pb-px">
              <Button
                type="button"
                size="icon"
                className="h-9 w-9 shrink-0 bg-sky-600 hover:bg-sky-700 text-white"
                onClick={() => onNuevoCliente("")}
                title="Nuevo cliente (si no aparece en el buscador)"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Lista de precio</Label>
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                value={listaPrecioId}
                onChange={(e) => onListaPrecioChange(e.target.value)}
              >
                {LISTAS_PRECIO_MOCK.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Moneda</Label>
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                value={monedaPresupuesto}
                onChange={(e) =>
                  onMonedaChange(e.target.value as "usd" | "ars")
                }
              >
                <option value="usd">Dólares (USD)</option>
                <option value="ars">Pesos (ARS)</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs font-medium">
                Origen <span className="text-destructive">*</span>
              </Label>
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                value={origenVentas}
                onChange={(e) => onOrigenChange(e.target.value)}
              >
                {ORIGEN_VENTA_OPCIONES.map((o) => (
                  <option
                    key={o.value === "" ? "_sin_origen" : o.value}
                    value={o.value}
                  >
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {clienteSeleccionado && (
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-100">
              <span className="font-semibold">Cliente seleccionado:</span>{" "}
              {clienteSeleccionado.nombre} ({clienteSeleccionado.contacto})
            </div>
          )}
        </div>
      </SectionClienteStep>

      <SectionClienteStep title="Datos de contacto">
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Contacto</Label>
              <Input
                className="h-8 text-sm px-2.5"
                value={contacto}
                onChange={(e) => onContactoChange(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Tel. / Celular</Label>
              <Input
                className="h-8 text-sm px-2.5"
                value={tel}
                onChange={(e) => onTelChange(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Email</Label>
              <Input
                type="email"
                className="h-8 text-sm px-2.5"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 xl:items-start">
            <div className="space-y-1">
              <Label className="text-xs font-medium">
                Dirección de entrega
              </Label>
              <Input
                className="h-8 text-sm px-2.5"
                value={direccion}
                onChange={(e) => onDireccionChange(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">
                Observaciones grales.
              </Label>
              <Textarea
                className="min-h-[52px] max-h-32 resize-y py-1.5 text-sm px-2.5"
                placeholder="Observaciones Grales - Max. 500 caracteres"
                maxLength={500}
                value={obsCabecera}
                onChange={(e) => onObsCabeceraChange(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground text-right leading-none pt-0.5">
                {obsCabecera.length}/500
              </p>
            </div>
          </div>
        </div>
      </SectionClienteStep>
    </div>
  );
}
