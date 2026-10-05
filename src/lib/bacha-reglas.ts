export const MOTIVO_BLOQUEO_BACHA = "Bacha pendiente";

export type PuedeAvanzarBachaInput = {
  bachaRequerida: boolean;
  bachaAsignada: boolean;
};

export type PuedeAvanzarBachaResultado = {
  ok: boolean;
  faltantes: string[];
};

export function bachaResuelta(input: PuedeAvanzarBachaInput): PuedeAvanzarBachaResultado {
  const faltantes: string[] = [];
  if (input.bachaRequerida && !input.bachaAsignada) {
    faltantes.push(MOTIVO_BLOQUEO_BACHA);
  }
  return { ok: faltantes.length === 0, faltantes };
}

export function motivoBloqueoBacha(r: PuedeAvanzarBachaResultado): string | null {
  if (r.ok) return null;
  return r.faltantes.join(" ");
}

export function esBloqueoPorBacha(motivo: string | null | undefined): boolean {
  return (motivo ?? "").trim() === MOTIVO_BLOQUEO_BACHA;
}

export type BachaOrigen = "propia" | "cliente";

export type CamposRequisitoBacha = {
  bacha_requerida: boolean;
  bacha_origen: BachaOrigen | null;
  bacha_tipo: string | null;
  bacha_colocacion: string | null;
};

/** Campos de la OT que salen del presupuesto. No toca `bacha_id` (la pieza del stock). */
export function camposRequisitoBacha(input: {
  llevaBacha: boolean;
  origen: BachaOrigen;
  tipoEtiqueta: string | null;
  colocacion: string | null;
}): CamposRequisitoBacha {
  if (!input.llevaBacha) {
    return {
      bacha_requerida: false,
      bacha_origen: null,
      bacha_tipo: null,
      bacha_colocacion: null,
    };
  }
  return {
    bacha_requerida: true,
    bacha_origen: input.origen === "cliente" ? "cliente" : "propia",
    bacha_tipo: input.tipoEtiqueta,
    bacha_colocacion: input.colocacion,
  };
}

const ETAPAS_EXIGEN_BACHA = new Set(["corte", "produccion", "despacho"]);

export function etapaExigeBachaAsignada(etapa: string | null | undefined): boolean {
  return ETAPAS_EXIGEN_BACHA.has((etapa ?? "").trim());
}

export function ordenBachaParaOt<T extends { key: string }>(
  ot: { orden_key: string | null },
  ots: { orden_key: string | null }[],
  ordenes: T[],
): T | null {
  if (ot.orden_key) {
    return ordenes.find((orden) => orden.key === ot.orden_key) ?? null;
  }
  const sinClave = ots.filter((row) => !row.orden_key);
  if (sinClave.length === 1 && ordenes.length === 1) return ordenes[0] ?? null;
  return null;
}
