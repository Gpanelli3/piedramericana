"use client";

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
import { cn } from "@/lib/utils";
import { Check, Plus } from "lucide-react";
import type { ClientePresupuesto } from "@/lib/clients-api";
import { ORIGEN_VENTA_OPCIONES } from "@/data/origen-venta";
import { PickCliente } from "./fields";
import { OtUbicacionYPlano } from "./OtUbicacionYPlano";
import { mecAlgunoActivo, type CamposFaltantes } from "./validacion";
import type { OrdenTrabajoWizard } from "./types";

export type BloqueClienteObraProps = {
  clientesLocales: ClientePresupuesto[];
  clientesCargando?: boolean;
  clienteSeleccionadoId: string | null;
  aplicarCliente: (c: ClientePresupuesto) => void;
  limpiarCliente: () => void;
  abrirNuevoCliente: (prefillNombre?: string) => void;
  origenVentas: string;
  setOrigenVentas: (v: string) => void;
  vendedorId: string;
  setVendedorId: (v: string) => void;
  usuarios: { id: string; nombre: string; email: string | null }[];
  usuariosCargando?: boolean;
  usuarioActualId: string | null;
  comisionPct: string;
  setComisionPct: (v: string) => void;
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
  ordenes: OrdenTrabajoWizard[];
  patchUbicacion: (key: string, patch: Partial<OrdenTrabajoWizard>) => void;
  /** Cambia una sola OT (cuando cada una tiene su propia dirección). */
  patchOrden: (key: string, patch: Partial<OrdenTrabajoWizard>) => void;
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
          ? "border-accent bg-accent/15 text-foreground"
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

/** Paso 1: quién es el cliente. */
export function CamposCliente({
  clientesLocales,
  clientesCargando = false,
  clienteSeleccionadoId,
  aplicarCliente,
  limpiarCliente,
  abrirNuevoCliente,
  vendedorId,
  setVendedorId,
  usuarios,
  usuariosCargando = false,
  usuarioActualId,
  contacto,
  setContacto,
  tel,
  setTel,
  email,
  setEmail,
  faltantes = null,
}: { faltantes?: CamposFaltantes | null } & Pick<
  BloqueClienteObraProps,
  | "clientesLocales"
  | "clientesCargando"
  | "clienteSeleccionadoId"
  | "aplicarCliente"
  | "limpiarCliente"
  | "abrirNuevoCliente"
  | "vendedorId"
  | "setVendedorId"
  | "usuarios"
  | "usuariosCargando"
  | "usuarioActualId"
  | "contacto"
  | "setContacto"
  | "tel"
  | "setTel"
  | "email"
  | "setEmail"
>) {
  return (
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
              invalido={Boolean(faltantes?.cliente)}
              placeholder="Buscar cliente por nombre o teléfono…"
            />
          </div>
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => abrirNuevoCliente()}
            aria-label="Nuevo cliente"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <Label>
          Teléfono <span className="text-destructive">*</span>
        </Label>
        <Input
          value={tel}
          aria-invalid={faltantes?.tel || undefined}
          onChange={(e) => setTel(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label>
          Email <span className="text-destructive">*</span>
        </Label>
        <Input
          type="email"
          value={email}
          aria-invalid={faltantes?.email || undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label>
          Contacto <span className="text-destructive">*</span>
        </Label>
        <Input
          value={contacto}
          aria-invalid={faltantes?.contacto || undefined}
          onChange={(e) => setContacto(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label>
          Vendedor <span className="text-destructive">*</span>
        </Label>
        <Select
          value={vendedorId || undefined}
          onValueChange={setVendedorId}
          disabled={usuariosCargando && usuarios.length === 0}
        >
          <SelectTrigger className="h-10 w-full" aria-invalid={faltantes?.vendedor || undefined}>
            <SelectValue placeholder={usuariosCargando ? "Cargando…" : "Vendedor"} />
          </SelectTrigger>
          <SelectContent>
            {usuarioActualId ? (
              <SelectItem value={usuarioActualId}>Asignármelo a mí</SelectItem>
            ) : null}
            {vendedorId &&
            vendedorId !== usuarioActualId &&
            !usuarios.some((u) => u.id === vendedorId) ? (
              <SelectItem value={vendedorId}>Vendedor asignado</SelectItem>
            ) : null}
            {usuarios
              .filter((u) => u.id !== usuarioActualId)
              .map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.email ? `${u.nombre} — ${u.email}` : u.nombre}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** Paso 2: dónde es la obra. */
export function CamposObra({
  ordenes,
  patchUbicacion,
  patchOrden,
  mostrarUbicacionCompartida,
  direccionesFaltantes,
}: { direccionesFaltantes?: Set<string> } & Pick<
  BloqueClienteObraProps,
  "ordenes" | "patchUbicacion" | "patchOrden" | "mostrarUbicacionCompartida"
>) {
  const primera = ordenes[0] ?? null;

  if (mostrarUbicacionCompartida) {
    return primera ? (
      <OtUbicacionYPlano
        ot={primera}
        patchOrden={patchUbicacion}
        variant="cabecera"
        direccionInvalida={direccionesFaltantes?.has(primera.key)}
      />
    ) : null;
  }

  return (
    <div className="space-y-5">
      {ordenes.map((ot, idx) => (
        <div key={`${ot.key}-ubicacion`} className="space-y-2">
          {ordenes.length > 1 ? (
            <p className="text-xs font-medium text-muted-foreground">
              OT {idx + 1}
              {ot.titulo.trim() ? ` · ${ot.titulo.trim()}` : ""}
            </p>
          ) : null}
          <OtUbicacionYPlano
            ot={ot}
            patchOrden={patchOrden}
            direccionInvalida={direccionesFaltantes?.has(ot.key)}
          />
        </div>
      ))}
    </div>
  );
}

/** Paso 4: medición, envío y colocación. */
export function CamposServicios({
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
  importeFaltante = false,
}: { importeFaltante?: boolean } & Pick<
  BloqueClienteObraProps,
  | "mMedicionGlobal"
  | "setMMedicionGlobal"
  | "mEntregaGlobal"
  | "setMEntregaGlobal"
  | "mColocacionGlobal"
  | "setMColocacionGlobal"
  | "totalMecGlobal"
  | "setTotalMecGlobal"
  | "obsServiciosMec"
  | "setObsServiciosMec"
  | "mecExcluidoTodasOts"
>) {
  const mecActivo =
    !mecExcluidoTodasOts &&
    mecAlgunoActivo(mMedicionGlobal, mEntregaGlobal, mColocacionGlobal);

  return (
    <div className="space-y-5">
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

      {mecActivo ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="importe-mec">
              Importe MEC (ARS)
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="importe-mec"
                aria-invalid={importeFaltante || undefined}
                className="h-10 pl-7 text-sm tabular-nums"
                inputMode="decimal"
                value={totalMecGlobal}
                onChange={(e) => setTotalMecGlobal(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="obs-mec">
              Observaciones MEC
            </Label>
            <Input
              id="obs-mec"
              className="h-10 text-sm"
              maxLength={500}
              value={obsServiciosMec}
              onChange={(e) => setObsServiciosMec(e.target.value)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Origen y comisión: chiquitos, arriba de los pasos. */
export function OrigenYComision({
  origenVentas,
  setOrigenVentas,
  comisionPct,
  setComisionPct,
}: Pick<
  BloqueClienteObraProps,
  "origenVentas" | "setOrigenVentas" | "comisionPct" | "setComisionPct"
>) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Select value={origenVentas || undefined} onValueChange={setOrigenVentas}>
        <SelectTrigger
          aria-label="Origen"
          className="h-8 w-40 border-border/60 bg-transparent text-xs text-muted-foreground shadow-none data-[placeholder]:text-muted-foreground/70"
        >
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
      <div className="relative w-28">
        <Input
          id="comision-vendedor"
          aria-label="Comisión"
          placeholder="Comisión"
          className="h-8 border-border/60 bg-transparent pr-6 text-xs tabular-nums shadow-none placeholder:text-muted-foreground/70"
          inputMode="decimal"
          value={comisionPct}
          onChange={(e) => setComisionPct(e.target.value)}
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/70">
          %
        </span>
      </div>
    </div>
  );
}

/** Observaciones generales: un recuadro discreto, debajo de los pasos. */
export function ObservacionesGenerales({
  obsCabecera,
  setObsCabecera,
}: Pick<BloqueClienteObraProps, "obsCabecera" | "setObsCabecera">) {
  return (
    <Textarea
      aria-label="Observaciones generales"
      placeholder="Observaciones generales"
      className="min-h-16 max-h-32 resize-y border-border/60 bg-card/60 text-sm shadow-none placeholder:text-muted-foreground/70 focus-visible:bg-background"
      maxLength={500}
      value={obsCabecera}
      onChange={(e) => setObsCabecera(e.target.value)}
    />
  );
}
