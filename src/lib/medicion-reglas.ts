export const MEDICION_ESTADOS = [
  "sin_solicitar",
  "listo_para_medir",
  "medido",
  "no_requiere",
] as const;

export type MedicionEstado = (typeof MEDICION_ESTADOS)[number];

export function esMedicionEstado(v: unknown): v is MedicionEstado {
  return typeof v === "string" && (MEDICION_ESTADOS as readonly string[]).includes(v);
}

export function medicionResuelta(estado: MedicionEstado): boolean {
  return estado === "medido";
}

/** Seña o pedido explícito: tiene que verse en Medición → Para medir. */
export function enColaParaMedir(estado: MedicionEstado, tieneSena: boolean): boolean {
  if (estado === "listo_para_medir") return true;
  return estado === "sin_solicitar" && tieneSena;
}

/**
 * Tras medir, si el precio cambió hace falta que el cliente esté de acuerdo
 * con el nuevo importe antes de pasar a producción.
 */
export function requiereConformidadCliente(opts: {
  totalAnterior: number;
  totalNuevo: number;
}): boolean {
  return Math.abs(opts.totalNuevo - opts.totalAnterior) > 0.009;
}

/**
 * Estado de la conformidad después de confirmar las medidas.
 * Si ya había una conformidad pendiente, se compara contra el importe que el cliente
 * había aceptado (no contra el intermedio): si vuelve a ese importe, ya no hace falta.
 */
export function conformidadTrasMedir(opts: {
  pendienteActual: boolean;
  totalAceptadoPrevio: number | null;
  totalAnterior: number;
  totalNuevo: number;
}): { pendiente: boolean; totalAnterior: number | null; totalNuevo: number | null } {
  const base =
    opts.pendienteActual && opts.totalAceptadoPrevio != null
      ? opts.totalAceptadoPrevio
      : opts.totalAnterior;
  if (!requiereConformidadCliente({ totalAnterior: base, totalNuevo: opts.totalNuevo })) {
    return { pendiente: false, totalAnterior: null, totalNuevo: null };
  }
  return { pendiente: true, totalAnterior: base, totalNuevo: opts.totalNuevo };
}

/**
 * Valida el importe que el vendedor acuerda con el cliente cuando este no acepta
 * el que resultó de la medición. Devuelve el mensaje de error o null si está bien.
 */
export function validarImporteRenegociado(opts: {
  nuevoTotal: number;
  cobrado: number;
  motivo: string;
}): string | null {
  if (!Number.isFinite(opts.nuevoTotal) || opts.nuevoTotal <= 0) {
    return "Cargá el importe acordado con el cliente.";
  }
  if (opts.nuevoTotal + 0.009 < opts.cobrado) {
    return "El nuevo importe no puede ser menor a lo que ya se cobró.";
  }
  if (!opts.motivo.trim()) {
    return "Anotá el motivo o cómo se acordó con el cliente.";
  }
  return null;
}

export type PuedeEnviarAProduccionInput = {
  presupuestoAprobado: boolean;
  tieneSena: boolean;
  medicionEstado: MedicionEstado;
  /** El precio cambió al medir y el cliente todavía no dio su conformidad. */
  conformidadPendiente?: boolean;
};

export type PuedeEnviarAProduccionResultado = {
  ok: boolean;
  faltantes: string[];
};

/** Única regla de “listo para producir”. */
export function puedeEnviarAProduccion(
  input: PuedeEnviarAProduccionInput,
): PuedeEnviarAProduccionResultado {
  const faltantes: string[] = [];
  if (!input.presupuestoAprobado) {
    faltantes.push("El presupuesto no está aprobado.");
  }
  if (!input.tieneSena) {
    faltantes.push("Falta la seña.");
  }
  if (!medicionResuelta(input.medicionEstado)) {
    if (input.medicionEstado === "listo_para_medir") {
      faltantes.push("La medición todavía no se confirmó.");
    } else {
      faltantes.push("Falta confirmar las medidas.");
    }
  }
  if (input.conformidadPendiente) {
    faltantes.push("Falta la conformidad del cliente con el nuevo importe.");
  }
  return { ok: faltantes.length === 0, faltantes };
}

export function motivoBloqueoEnvio(r: PuedeEnviarAProduccionResultado): string | null {
  if (r.ok) return null;
  return r.faltantes.join(" ");
}

export function etiquetaMedicionEstado(estado: MedicionEstado): string {
  switch (estado) {
    case "sin_solicitar":
      return "Sin solicitar";
    case "listo_para_medir":
      return "Para medir";
    case "medido":
      return "Medido";
    case "no_requiere":
      return "Sin medición";
    default:
      return estado;
  }
}
