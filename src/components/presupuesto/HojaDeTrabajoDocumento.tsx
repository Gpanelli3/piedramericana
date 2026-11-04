"use client";

import { cn } from "@/lib/utils";
import type { ArticuloConPrecio } from "@/types/articulos";
import type { MaterialWizardRow } from "@/types/material-catalog";
import type { PresupuestoPayloadV1 } from "@/types/presupuesto-payload";
import {
  buildPresupuestoDetalleVista,
  formatMetrajeDetalle,
} from "@/lib/presupuesto-detalle";
import { formatMetraje, labelUnidad } from "@/lib/presupuesto-calculos";

export type HojaDeTrabajoDocumentoProps = {
  numero: string;
  fecha: string;
  clienteNombre: string;
  direccion?: string;
  contacto?: string;
  tel?: string;
  vendedorLabel?: string;
  payload: PresupuestoPayloadV1;
  articulos: ArticuloConPrecio[];
  materials: MaterialWizardRow[];
  className?: string;
};

export function HojaDeTrabajoDocumento({
  numero,
  fecha,
  clienteNombre,
  direccion = "",
  contacto = "",
  tel = "",
  vendedorLabel = "",
  payload,
  articulos,
  materials,
  className,
}: HojaDeTrabajoDocumentoProps) {
  const vista = buildPresupuestoDetalleVista({ payload, articulos, materials });
  const totalItems = vista.ambientes.reduce((s, a) => s + a.filas.length, 0);

  return (
    <div
      className={cn(
        "bg-white text-neutral-900 text-[12px] leading-snug print:text-[11px]",
        className,
      )}
    >
      <header className="grid grid-cols-[1fr_1.4fr_1fr] border border-neutral-800 mb-4">
        <div className="flex items-center justify-center px-3 py-4 font-bold uppercase tracking-wide text-sm">
          Piedra Americana
        </div>
        <div className="flex flex-col items-center justify-center border-x border-neutral-800 px-3 py-3">
          <p className="text-sm font-extrabold tracking-[0.14em] uppercase">Hoja de trabajo</p>
          <p className="text-[10px] uppercase tracking-wide text-neutral-500 mt-0.5">
            Sin valores · uso en obra
          </p>
        </div>
        <div className="px-3 py-2 text-[11px] space-y-0.5">
          <p>
            <span className="text-neutral-500">Presupuesto:</span>{" "}
            <span className="font-semibold tabular-nums">{numero}</span>
          </p>
          <p>
            <span className="text-neutral-500">Fecha:</span> {fecha}
          </p>
          <p>
            <span className="text-neutral-500">Ítems:</span> {totalItems}
          </p>
        </div>
      </header>

      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="space-y-0.5">
          <p className="text-sm font-bold uppercase tracking-wide">
            Cliente: {clienteNombre.trim() || "—"}
          </p>
          {direccion.trim() ? <p className="text-neutral-700">{direccion}</p> : null}
          <p className="text-neutral-700">
            Contacto: {contacto.trim() || "—"}
            {tel.trim() ? ` · ${tel}` : ""}
          </p>
          {vendedorLabel.trim() ? (
            <p className="text-neutral-700">Vendedor: {vendedorLabel}</p>
          ) : null}
        </div>
        <p className="text-[11px] tabular-nums text-neutral-600 shrink-0">{fecha}</p>
      </div>

      {vista.ambientes.map((amb) => (
        <section key={amb.key} className="mb-4">
          <p className="text-sm font-extrabold uppercase tracking-wide">{amb.titulo}</p>
          {amb.materialNombre ? (
            <p className="text-[11px] text-neutral-600 mb-1">{amb.materialNombre}</p>
          ) : null}
          <ul className="divide-y divide-neutral-200">
            {amb.filas.map((fila) => (
              <li key={fila.key} className="flex items-start gap-2 py-2">
                <span
                  className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-[2px] border border-neutral-700"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{fila.descripcion}</p>
                  {fila.medidas ? (
                    <p className="text-[11px] text-neutral-600">{fila.medidas}</p>
                  ) : null}
                </div>
                <p className="tabular-nums text-neutral-800 shrink-0">
                  {fila.m2 > 0
                    ? formatMetrajeDetalle(fila.m2)
                    : `${formatMetraje(fila.cant)} ${fila.unidad || labelUnidad("UNI")}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
