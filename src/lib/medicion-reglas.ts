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
  return estado === "medido" || estado === "no_requiere";
}

export type PuedeEnviarAProduccionInput = {
  presupuestoAprobado: boolean;
  tieneSena: boolean;
  medicionEstado: MedicionEstado;
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
      faltantes.push("Falta resolver la medición (medir o saltar).");
    }
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
      return "Listo para medir";
    case "medido":
      return "Medido";
    case "no_requiere":
      return "Sin medición";
    default:
      return estado;
  }
}
