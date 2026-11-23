"use client";

import { useConfiguracionEmpresa } from "@/lib/configuracion-api";

/** Nombre con el que firma la empresa en los documentos. */
export function useNombreEmpresa(): string {
  const e = useConfiguracionEmpresa();
  return e.nombre_fantasia?.trim() || e.razon_social;
}

/**
 * Bloque oscuro del encabezado de presupuestos y comprobantes: nombre de la
 * empresa y sus datos fiscales y de contacto (se cargan en Configuración).
 */
export function EmpresaCabecera() {
  const e = useConfiguracionEmpresa();
  const nombre = e.nombre_fantasia?.trim() || e.razon_social;
  const razonAparte = e.nombre_fantasia?.trim() && e.razon_social !== e.nombre_fantasia ? e.razon_social : null;
  const fiscal = [e.cuit ? `CUIT ${e.cuit}` : null, e.condicion_iva].filter(Boolean).join(" · ");
  const lugar = [e.direccion, e.localidad].filter(Boolean).join(", ");
  const contacto = [e.telefono, e.email, e.sitio_web].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col items-center justify-center bg-neutral-900 px-3 py-4 text-center text-white">
      <p className="text-sm font-bold uppercase tracking-[0.12em]">{nombre}</p>
      {razonAparte ? <p className="mt-1 text-[9px] text-neutral-300">{razonAparte}</p> : null}
      {fiscal ? <p className="mt-1 text-[9px] text-neutral-300">{fiscal}</p> : null}
      {lugar ? <p className="text-[9px] text-neutral-300">{lugar}</p> : null}
      {contacto ? <p className="text-[9px] text-neutral-300">{contacto}</p> : null}
    </div>
  );
}
