export type RoturaTipo = "chapa" | "pieza";
export type RoturaMomento = "corte" | "instalacion" | "viaje" | "otro";

export const ROTURA_TIPOS: { value: RoturaTipo; label: string }[] = [
  { value: "chapa", label: "Rotura de chapa" },
  { value: "pieza", label: "Rotura de pieza / mesada" },
];

export const ROTURA_MOMENTOS: { value: RoturaMomento; label: string }[] = [
  { value: "corte", label: "En corte" },
  { value: "instalacion", label: "En instalación" },
  { value: "viaje", label: "En viaje" },
  { value: "otro", label: "Otro" },
];

const EPS_CM = 0.05;

export type PiezaMedida = {
  label: string;
  largoCm: number;
  anchoCm: number;
};

export type RetazoMedida = {
  id: string;
  bulto: string;
  largoCm: number;
  anchoCm: number;
  materialLabel: string;
};

export type MatchRetazoPieza = {
  pieza: PiezaMedida;
  retazo: RetazoMedida;
};

export type MedidaCm = { largoCm: number; anchoCm: number };

/**
 * Cada retazo tiene que entrar en el pedazo y, juntos, no superar su superficie.
 * Devuelve el motivo si no se pueden dar de alta.
 */
export function validarRetazosEnPedazo(
  retazos: MedidaCm[],
  pedazoLargoCm: number,
  pedazoAnchoCm: number,
): string | null {
  if (retazos.length === 0) return "Agregá al menos un retazo.";
  if (!(pedazoLargoCm > 0) || !(pedazoAnchoCm > 0)) {
    return "El pedazo bloqueado no tiene medidas.";
  }
  const areaPedazo = pedazoLargoCm * pedazoAnchoCm;
  let area = 0;
  for (let i = 0; i < retazos.length; i++) {
    const r = retazos[i]!;
    const n = i + 1;
    if (!(r.largoCm > 0) || !(r.anchoCm > 0)) {
      return `El retazo ${n} necesita largo y ancho.`;
    }
    if (!piezaCabeEnRetazo(r.largoCm, r.anchoCm, pedazoLargoCm, pedazoAnchoCm)) {
      return `El retazo ${n} no entra en el pedazo bloqueado.`;
    }
    area += r.largoCm * r.anchoCm;
  }
  if (area > areaPedazo + 0.5) {
    return "La suma de los retazos supera la superficie del pedazo.";
  }
  return null;
}

/** La pieza cabe en el retazo en cualquiera de las dos orientaciones. */
export function piezaCabeEnRetazo(
  piezaLargoCm: number,
  piezaAnchoCm: number,
  retazoLargoCm: number,
  retazoAnchoCm: number,
): boolean {
  if (!(piezaLargoCm > 0) || !(piezaAnchoCm > 0)) return false;
  if (!(retazoLargoCm > 0) || !(retazoAnchoCm > 0)) return false;
  const pL = piezaLargoCm;
  const pA = piezaAnchoCm;
  const rL = retazoLargoCm + EPS_CM;
  const rA = retazoAnchoCm + EPS_CM;
  return (pL <= rL && pA <= rA) || (pL <= rA && pA <= rL);
}

export function metrosACm(metros: number): number {
  return metros * 100;
}

export function materialCoincide(
  aId: string | null | undefined,
  aLabel: string | null | undefined,
  bId: string | null | undefined,
  bLabel: string | null | undefined,
): boolean {
  const idA = (aId ?? "").trim();
  const idB = (bId ?? "").trim();
  if (idA && idB) return idA === idB;
  const la = (aLabel ?? "").trim().toLowerCase();
  const lb = (bLabel ?? "").trim().toLowerCase();
  if (!la || !lb) return false;
  return la === lb || la.includes(lb) || lb.includes(la);
}

export function sugerirRetazosParaPiezas(
  piezas: PiezaMedida[],
  retazos: RetazoMedida[],
): MatchRetazoPieza[] {
  const out: MatchRetazoPieza[] = [];
  const usados = new Set<string>();
  for (const pieza of piezas) {
    const match = retazos.find(
      (r) =>
        !usados.has(r.id) &&
        piezaCabeEnRetazo(pieza.largoCm, pieza.anchoCm, r.largoCm, r.anchoCm),
    );
    if (!match) continue;
    usados.add(match.id);
    out.push({ pieza, retazo: match });
  }
  return out;
}

export function etiquetaRoturaTipo(tipo: RoturaTipo | null | undefined): string {
  return ROTURA_TIPOS.find((t) => t.value === tipo)?.label ?? tipo ?? "Rotura";
}

export function etiquetaRoturaMomento(momento: RoturaMomento | null | undefined): string {
  return ROTURA_MOMENTOS.find((m) => m.value === momento)?.label ?? momento ?? "";
}

/** El texto guardado repite tipo y momento. Acá queda solo lo que escribieron. */
export function motivoRoturaVisible(texto: string | null | undefined): string {
  const t = texto?.trim() ?? "";
  if (!t.startsWith("Rotura de ")) return t;
  const partes = t.split(" · ");
  if (partes.length < 3) return "";
  return partes.slice(2).join(" · ").trim();
}

export function formatCm(l: number, a: number): string {
  const fmt = (n: number) =>
    n.toLocaleString("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  return `${fmt(l)}×${fmt(a)} cm`;
}
