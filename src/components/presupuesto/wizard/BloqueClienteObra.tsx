"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Plus } from "lucide-react";
import type { ClientePresupuesto } from "@/lib/clients-api";
import { ORIGEN_VENTA_OPCIONES } from "@/data/origen-venta";
import { PickCliente } from "./fields";
import { OtUbicacionYPlano } from "./OtUbicacionYPlano";
import { mecAlgunoActivo } from "./validacion";
import type { OrdenTrabajoWizard } from "./types";

type BloqueClienteObraProps = {
  clientesLocales: ClientePresupuesto[];
  clientesCargando?: boolean;
  clienteSeleccionadoId: string | null;
  aplicarCliente: (c: ClientePresupuesto) => void;
  limpiarCliente: () => void;
  abrirNuevoCliente: (prefillNombre?: string) => void;
  origenVentas: string;
  setOrigenVentas: (v: string) => void;
  contacto: string;
  setContacto: (v: string) => void;
  tel: string;
  setTel: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  obsCabecera: string;
  setObsCabecera: (v: string) => void;
  mMedicionGlobal: boolean;
  setMMedicionGlobal: (v: boolean) => void;
  mEntregaGlobal: boolean;
  setMEntregaGlobal: (v: boolean) => void;
  mColocacionGlobal: boolean;
  setMColocacionGlobal: (v: boolean) => void;
  totalMecGlobal: string;
  setTotalMecGlobal: (v: string) => void;
  obsServiciosMec: string;
  setObsServiciosMec: (v: string) => void;
  mecExcluidoTodasOts: boolean;
  monedaPresupuesto: "ars" | "usd";
  otUbicacion: OrdenTrabajoWizard | null;
  patchUbicacion: (key: string, patch: Partial<OrdenTrabajoWizard>) => void;
  mostrarUbicacionCompartida: boolean;
};

function ChipServicio({
  label,
  checked,
  onToggle,
  disabled,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        checked
          ? "border-emerald-500/40 bg-emerald-50 text-emerald-800"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {checked ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <span className="h-3.5 w-3.5 rounded-full border border-current/30" aria-hidden />
      )}
      {label}
    </button>
  );
}

export function BloqueClienteObra({
  clientesLocales,
  clientesCargando = false,
  clienteSeleccionadoId,
  aplicarCliente,
  limpiarCliente,
  abrirNuevoCliente,
  origenVentas,
  setOrigenVentas,
  contacto,
  setContacto,
  tel,
  setTel,
  email,
  setEmail,
  obsCabecera,
  setObsCabecera,
  mMedicionGlobal,
  setMMedicionGlobal,
  mEntregaGlobal,
  setMEntregaGlobal,
  mColocacionGlobal,
  setMColocacionGlobal,
  totalMecGlobal,
  setTotalMecGlobal,
  obsServiciosMec,
  setObsServiciosMec,
  mecExcluidoTodasOts,
  monedaPresupuesto,
  otUbicacion,
  patchUbicacion,
  mostrarUbicacionCompartida,
}: BloqueClienteObraProps) {
  const [abierto, setAbierto] = useState(true);
  const direccionObra = otUbicacion?.direccionObra.trim() ?? "";
  const campos = [
    Boolean(clienteSeleccionadoId),
    Boolean(tel.trim()),
    Boolean(email.trim()),
    Boolean(contacto.trim()),
    Boolean(origenVentas.trim()),
    Boolean(direccionObra),
    Boolean(obsCabecera.trim()),
  ];
  const completos = campos.filter(Boolean).length;
  const faltantes: string[] = [];
  if (!clienteSeleccionadoId) faltantes.push("cliente");
  if (!direccionObra) faltantes.push("dirección de obra");
  const faltaTexto =
    faltantes.length === 0
      ? null
      : faltantes.length === 1
        ? `Falta ${faltantes[0]}`
        : `Falta ${faltantes.join(" y ")}`;
  const mecActivo =
    !mecExcluidoTodasOts &&
    mecAlgunoActivo(mMedicionGlobal, mEntregaGlobal, mColocacionGlobal);

  return (
    <Collapsible open={abierto} onOpenChange={setAbierto}>
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-foreground">Cliente y obra</h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {completos} de {campos.length} datos
          </span>
          {faltaTexto ? (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
              {faltaTexto}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">
              Datos cargados
            </span>
          )}
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-8 gap-1 text-xs text-muted-foreground"
            >
              {abierto ? "Plegar" : "Desplegar"}
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", abierto && "rotate-180")}
                aria-hidden
              />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="space-y-5 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground">Servicios</p>
                <div className="flex flex-wrap items-center gap-2">
                  <ChipServicio
                    label="Medición"
                    checked={mMedicionGlobal}
                    disabled={mecExcluidoTodasOts}
                    onToggle={() => setMMedicionGlobal(!mMedicionGlobal)}
                  />
                  <ChipServicio
                    label="Envío"
                    checked={mEntregaGlobal}
                    disabled={mecExcluidoTodasOts}
                    onToggle={() => setMEntregaGlobal(!mEntregaGlobal)}
                  />
                  <ChipServicio
                    label="Colocación"
                    checked={mColocacionGlobal}
                    disabled={mecExcluidoTodasOts}
                    onToggle={() => setMColocacionGlobal(!mColocacionGlobal)}
                  />
                </div>
                {mecExcluidoTodasOts ? (
                  <p className="text-[11px] text-muted-foreground">
                    Todas las OT están marcadas sin MEC: el importe pasa a $0.
                  </p>
                ) : monedaPresupuesto === "usd" ? (
                  <p className="text-[11px] text-muted-foreground">
                    El MEC se carga en pesos y se pasa a dólares con el tipo de cambio.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-44 space-y-1">
                  <Label className="text-xs">Origen</Label>
                  <Select value={origenVentas || undefined} onValueChange={setOrigenVentas}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Origen" />
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
                {mecActivo ? (
                  <div className="w-36 space-y-1">
                    <Label className="text-xs">Importe MEC (ARS)</Label>
                    <Input
                      className="h-9 text-sm tabular-nums"
                      inputMode="decimal"
                      value={totalMecGlobal}
                      onChange={(e) => setTotalMecGlobal(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {mecActivo ? (
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <Label className="text-xs">Observaciones MEC</Label>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {obsServiciosMec.length}/500
                  </span>
                </div>
                <Textarea
                  className="min-h-16 resize-y text-sm"
                  placeholder="Notas sobre medición, envío o colocación…"
                  maxLength={500}
                  value={obsServiciosMec}
                  onChange={(e) => setObsServiciosMec(e.target.value)}
                />
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <Label>
                  Cliente <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <PickCliente
                      clientes={clientesLocales}
                      value={clienteSeleccionadoId}
                      onChange={aplicarCliente}
                      onClear={limpiarCliente}
                      onNuevoCliente={abrirNuevoCliente}
                      loading={clientesCargando}
                      placeholder="Buscar cliente por nombre o teléfono…"
                    />
                  </div>
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
              <div className="space-y-1">
                <Label>
                  Teléfono <span className="text-destructive">*</span>
                </Label>
                <Input value={tel} onChange={(e) => setTel(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Contacto</Label>
                <Input
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  placeholder="Quien recibe la obra"
                />
              </div>
            </div>

            {mostrarUbicacionCompartida && otUbicacion ? (
              <OtUbicacionYPlano
                ot={otUbicacion}
                patchOrden={patchUbicacion}
                variant="cabecera"
              />
            ) : !mostrarUbicacionCompartida ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                Este presupuesto tiene direcciones o planos distintos por OT. Cargalos en cada
                artículo para no pisar los datos.
              </p>
            ) : null}

            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <Label>Observaciones generales</Label>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {obsCabecera.length}/500
                </span>
              </div>
              <Textarea
                className="max-h-32 resize-y"
                placeholder="Notas que van en el presupuesto"
                maxLength={500}
                value={obsCabecera}
                onChange={(e) => setObsCabecera(e.target.value)}
              />
            </div>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
