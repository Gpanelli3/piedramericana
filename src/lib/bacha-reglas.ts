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

const ETAPAS_EXIGEN_BACHA = new Set(["produccion", "despacho"]);

export function etapaExigeBachaAsignada(etapa: string | null | undefined): boolean {
  return ETAPAS_EXIGEN_BACHA.has((etapa ?? "").trim());
}

/** Aviso sí; la OT no se bloquea ni se frena el avance. */
export function frenaAvancePorBacha(_input: {
  bachaRequerida: boolean;
  bachaAsignada: boolean;
  nextEtapa: string | null | undefined;
}): boolean {
  return false;
}

export function avisoBachaPendiente(input: {
  bachaRequerida: boolean;
  bachaAsignada: boolean;
}): string | null {
  return bachaResuelta(input).ok ? null : MOTIVO_BLOQUEO_BACHA;
}

function normCliente(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Una bacha propia sirve en cualquier OT. La del cliente, solo en las de ese cliente. */
export function bachaCorrespondeACliente(
  bacha: {
    origen: BachaOrigen | string;
    cliente_nombre?: string | null;
    cliente_id?: string | null;
  },
  ot: { clienteNombre?: string | null; clienteId?: string | null },
): boolean {
  if (bacha.origen !== "cliente") return true;
  const bachaId = bacha.cliente_id ?? null;
  const otId = ot.clienteId ?? null;
  if (bachaId && otId) return bachaId === otId;
  const deBacha = normCliente(bacha.cliente_nombre);
  const esperado = normCliente(ot.clienteNombre);
  if (!deBacha || !esperado) return false;
  return deBacha === esperado;
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
