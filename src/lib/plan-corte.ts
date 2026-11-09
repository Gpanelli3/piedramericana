import type { ArticuloConPrecio } from "@/types/articulos";
import type { LineaItemOT, OrdenTrabajoWizard } from "@/components/presupuesto/wizard/types";
import { articuloConPrecioToMock, parseDecimalInput } from "@/lib/presupuesto-calculos";

export const DISCO_CM_DEFAULT = 0.5;
export const ALTO_ZOCALO_CM = 10;
export const ALTO_ALZADA_CM = 5;
export const PLAN_CORTE_VERSION = 1 as const;

const EPS = 0.05;

export type PiezaPlanCorte = {
  key: string;
  itemKey: string;
  label: string;
  largoCm: number;
  anchoCm: number;
};

export type PlanchaCandidata = {
  id: string;
  bulto: string;
  largoCm: number;
  anchoCm: number;
  loteCodigo: string | null;
  esRetazo: boolean;
  espesorCm?: number | null;
};

export type PiezaColocada = {
  key: string;
  itemKey: string;
  label: string;
  largoCm: number;
  anchoCm: number;
  xCm: number;
  yCm: number;
  rotada: boolean;
  chapaId: string;
};

export type SobrantePlanCorte = {
  largoCm: number;
  anchoCm: number;
  xCm: number;
  yCm: number;
  chapaId: string;
};

export type PlanCortePlancha = {
  chapaId: string;
  bulto: string;
  largoCm: number;
  anchoCm: number;
  loteCodigo: string | null;
  esRetazo: boolean;
  m2Usado: number;
  m2Sobrante: number;
  m2Perdido: number;
  pctAprovechado: number;
  piezas: PiezaColocada[];
  sobrantes: SobrantePlanCorte[];
};

export type PiezaSinCabida = {
  key: string;
  itemKey: string;
  label: string;
  largoCm: number;
  anchoCm: number;
  motivo: "empalme";
};

export type PlanCorte = {
  version: typeof PLAN_CORTE_VERSION;
  fingerprint: string;
  confirmado: boolean;
  requiereConfirmacion: boolean;
  materialId: string | null;
  materialLabel: string;
  discoCm: number;
  permiteRotar: boolean;
  planchas: PlanCortePlancha[];
  piezasSinCabida: PiezaSinCabida[];
  m2TotalPiezas: number;
  m2TotalPlanchas: number;
  m2TotalSobrante: number;
  pctAprovechado: number;
};

type FreeRect = { x: number; y: number; w: number; h: number };

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function m2De(largoCm: number, anchoCm: number): number {
  return (largoCm / 100) * (anchoCm / 100);
}

function areaCm2(largoCm: number, anchoCm: number): number {
  return largoCm * anchoCm;
}

function cabe(pw: number, ph: number, fw: number, fh: number): boolean {
  return pw <= fw + EPS && ph <= fh + EPS;
}

function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function esArticuloZocalo(codigo: string, descripcion: string): boolean {
  const c = codigo.trim().toUpperCase();
  if (c === "ZOC-ML" || c === "ZOC-M2" || c.includes("ZOC")) return true;
  return normalizarTexto(descripcion).includes("zocalo");
}

export function esArticuloAlzada(codigo: string, descripcion: string): boolean {
  const c = codigo.trim().toUpperCase();
  if (c.includes("ALZ")) return true;
  return normalizarTexto(descripcion).includes("alzada");
}

export function altoTiraMlCm(codigo: string, descripcion: string, altoM?: string): number {
  const alto = parseDecimalInput(altoM ?? "");
  if (alto > 0 && alto <= 0.5) return alto * 100;
  if (esArticuloAlzada(codigo, descripcion)) return ALTO_ALZADA_CM;
  if (esArticuloZocalo(codigo, descripcion)) return ALTO_ZOCALO_CM;
  return ALTO_ZOCALO_CM;
}

export function fingerprintPlanCorte(opts: {
  materialId?: string | null;
  piezas: Array<Pick<PiezaPlanCorte, "itemKey" | "largoCm" | "anchoCm">>;
  forzarChapaIds?: string[] | null;
  discoCm?: number;
  permiteRotar?: boolean;
}): string {
  const piezas = [...opts.piezas]
    .map((p) => `${p.itemKey}:${round3(p.largoCm)}x${round3(p.anchoCm)}`)
    .sort()
    .join("|");
  const forzar = [...(opts.forzarChapaIds ?? [])].sort().join(",");
  return [
    opts.materialId ?? "",
    piezas,
    forzar,
    String(opts.discoCm ?? DISCO_CM_DEFAULT),
    opts.permiteRotar === false ? "0" : "1",
  ].join("#");
}

export function piezasDesdeOrden(
  ot: Pick<OrdenTrabajoWizard, "items" | "piedraDelCliente" | "titulo">,
  articulos: ArticuloConPrecio[],
): PiezaPlanCorte[] {
  if (ot.piedraDelCliente) return [];
  const byId = new Map(articulos.map((a) => [a.id, a]));
  const out: PiezaPlanCorte[] = [];

  for (const line of ot.items) {
    const artBd = byId.get(line.articuloId);
    if (!artBd) continue;
    const art = articuloConPrecioToMock(artBd);
    if (!art.calculaMaterial) continue;
    if (art.medidaEstandarM2 != null && art.medidaEstandarM2 > 0) continue;

    const label = art.descripcion.trim() || art.codigo || "Pieza";

    if (art.unidad === "M2" && line.modoIngreso !== "manual") {
      const largo = round3(parseDecimalInput(line.altoM) * 100);
      const ancho = round3(parseDecimalInput(line.anchoM) * 100);
      if (!(largo > 0) || !(ancho > 0)) continue;
      const qtyRaw = parseDecimalInput(line.cantidad);
      const qty = line.cantidad.trim() === "" ? 1 : Math.max(1, Math.round(qtyRaw || 1));
      for (let i = 0; i < qty; i += 1) {
        out.push({
          key: `${line.key}:${i}`,
          itemKey: line.key,
          label: qty > 1 ? `${label} ${i + 1}` : label,
          largoCm: largo,
          anchoCm: ancho,
        });
      }
      continue;
    }

    if (art.unidad === "ML") {
      const ml = parseDecimalInput(line.cantidad);
      if (!(ml > 0)) continue;
      const ancho = altoTiraMlCm(art.codigo, art.descripcion, line.altoM);
      out.push({
        key: `${line.key}:0`,
        itemKey: line.key,
        label,
        largoCm: round3(ml * 100),
        anchoCm: ancho,
      });
    }
  }
  return out;
}

function packGuillotine(
  binW: number,
  binH: number,
  piezas: PiezaPlanCorte[],
  kerf: number,
  allowRotate: boolean,
): { placed: Array<PiezaPlanCorte & { xCm: number; yCm: number; w: number; h: number; rotada: boolean }>; leftover: PiezaPlanCorte[]; remnants: FreeRect[] } {
  const free: FreeRect[] = [{ x: 0, y: 0, w: binW, h: binH }];
  const placed: Array<PiezaPlanCorte & { xCm: number; yCm: number; w: number; h: number; rotada: boolean }> = [];
  const leftover: PiezaPlanCorte[] = [];

  const sorted = [...piezas].sort((a, b) => {
    const area = areaCm2(b.largoCm, b.anchoCm) - areaCm2(a.largoCm, a.anchoCm);
    if (area !== 0) return area;
    return Math.max(b.largoCm, b.anchoCm) - Math.max(a.largoCm, a.anchoCm);
  });

  for (const pieza of sorted) {
    let bestIdx = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestW = 0;
    let bestH = 0;
    let bestRot = false;

    for (let i = 0; i < free.length; i += 1) {
      const fr = free[i]!;
      const orients: Array<[number, number, boolean]> = allowRotate
        ? [
            [pieza.largoCm, pieza.anchoCm, false],
            [pieza.anchoCm, pieza.largoCm, true],
          ]
        : [[pieza.largoCm, pieza.anchoCm, false]];
      for (const [pw, ph, rot] of orients) {
        if (!cabe(pw, ph, fr.w, fr.h)) continue;
        const short = Math.min(fr.w - pw, fr.h - ph);
        const leftoverArea = fr.w * fr.h - pw * ph;
        const score = short * 1000 + leftoverArea;
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
          bestW = pw;
          bestH = ph;
          bestRot = rot;
        }
      }
    }

    if (bestIdx < 0) {
      leftover.push(pieza);
      continue;
    }

    const fr = free[bestIdx]!;
    free.splice(bestIdx, 1);
    placed.push({
      ...pieza,
      xCm: fr.x,
      yCm: fr.y,
      w: bestW,
      h: bestH,
      rotada: bestRot,
    });

    const rightW = fr.w - bestW - kerf;
    const topH = fr.h - bestH - kerf;
    const rightArea = rightW > EPS ? rightW * fr.h : 0;
    const topArea = topH > EPS ? fr.w * topH : 0;

    if (rightArea >= topArea) {
      if (rightW > EPS) free.push({ x: fr.x + bestW + kerf, y: fr.y, w: rightW, h: fr.h });
      if (topH > EPS) free.push({ x: fr.x, y: fr.y + bestH + kerf, w: bestW, h: topH });
    } else {
      if (topH > EPS) free.push({ x: fr.x, y: fr.y + bestH + kerf, w: fr.w, h: topH });
      if (rightW > EPS) free.push({ x: fr.x + bestW + kerf, y: fr.y, w: rightW, h: bestH });
    }
  }

  return {
    placed,
    leftover,
    remnants: free.filter((r) => r.w > EPS && r.h > EPS),
  };
}

function scoreCandidato(opts: {
  placed: number;
  esRetazo: boolean;
  mismoLote: boolean;
  area: number;
}): number {
  return (
    opts.placed * 1_000_000 +
    (opts.esRetazo ? 100_000 : 0) +
    (opts.mismoLote ? 10_000 : 0) -
    opts.area / 10_000
  );
}

function planchaDesdePack(
  slab: PlanchaCandidata,
  packed: ReturnType<typeof packGuillotine>,
): PlanCortePlancha {
  const m2Plancha = m2De(slab.largoCm, slab.anchoCm);
  const m2Usado = packed.placed.reduce((s, p) => s + m2De(p.w, p.h), 0);
  const m2Sobrante = packed.remnants.reduce((s, r) => s + m2De(r.w, r.h), 0);
  const m2Perdido = Math.max(0, m2Plancha - m2Usado - m2Sobrante);
  const pct = m2Plancha > 0 ? (m2Usado / m2Plancha) * 100 : 0;
  return {
    chapaId: slab.id,
    bulto: slab.bulto,
    largoCm: slab.largoCm,
    anchoCm: slab.anchoCm,
    loteCodigo: slab.loteCodigo,
    esRetazo: slab.esRetazo,
    m2Usado: round3(m2Usado),
    m2Sobrante: round3(m2Sobrante),
    m2Perdido: round3(m2Perdido),
    pctAprovechado: round3(pct),
    piezas: packed.placed.map((p) => ({
      key: p.key,
      itemKey: p.itemKey,
      label: p.label,
      largoCm: p.w,
      anchoCm: p.h,
      xCm: p.xCm,
      yCm: p.yCm,
      rotada: p.rotada,
      chapaId: slab.id,
    })),
    sobrantes: packed.remnants.map((r) => ({
      largoCm: round3(r.w),
      anchoCm: round3(r.h),
      xCm: round3(r.x),
      yCm: round3(r.y),
      chapaId: slab.id,
    })),
  };
}

export function planificarCorte(opts: {
  piezas: PiezaPlanCorte[];
  planchas: PlanchaCandidata[];
  materialId?: string | null;
  materialLabel?: string;
  discoCm?: number;
  permiteRotar?: boolean;
  forzarChapaIds?: string[] | null;
  confirmado?: boolean;
}): PlanCorte {
  const discoCm = opts.discoCm ?? DISCO_CM_DEFAULT;
  const permiteRotar = opts.permiteRotar !== false;
  const fingerprint = fingerprintPlanCorte({
    materialId: opts.materialId,
    piezas: opts.piezas,
    forzarChapaIds: opts.forzarChapaIds,
    discoCm,
    permiteRotar,
  });
  const requiereConfirmacion = opts.piezas.length > 0;
  const base: PlanCorte = {
    version: PLAN_CORTE_VERSION,
    fingerprint,
    confirmado: Boolean(opts.confirmado) && requiereConfirmacion,
    requiereConfirmacion,
    materialId: opts.materialId ?? null,
    materialLabel: opts.materialLabel ?? "",
    discoCm,
    permiteRotar,
    planchas: [],
    piezasSinCabida: [],
    m2TotalPiezas: round3(opts.piezas.reduce((s, p) => s + m2De(p.largoCm, p.anchoCm), 0)),
    m2TotalPlanchas: 0,
    m2TotalSobrante: 0,
    pctAprovechado: 0,
  };

  if (opts.piezas.length === 0) {
    return { ...base, confirmado: false, requiereConfirmacion: false };
  }

  const used = new Set<string>();
  let remaining = [...opts.piezas];
  const planchas: PlanCortePlancha[] = [];
  let lotePreferido: string | null = null;

  const byId = new Map(opts.planchas.map((p) => [p.id, p]));
  const forzar = (opts.forzarChapaIds ?? []).map((id) => byId.get(id)).filter(Boolean) as PlanchaCandidata[];

  const tryPackOn = (slab: PlanchaCandidata): PlanCortePlancha | null => {
    if (used.has(slab.id)) return null;
    if (!(slab.largoCm > 0) || !(slab.anchoCm > 0)) return null;
    const packed = packGuillotine(slab.largoCm, slab.anchoCm, remaining, discoCm, permiteRotar);
    if (packed.placed.length === 0) return null;
    return planchaDesdePack(slab, packed);
  };

  const elegirMejor = (pool: PlanchaCandidata[]): PlanCortePlancha | null => {
    let best: PlanCortePlancha | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const slab of pool) {
      const plancha = tryPackOn(slab);
      if (!plancha) continue;
      const mismoLote =
        Boolean(lotePreferido) &&
        Boolean(slab.loteCodigo) &&
        slab.loteCodigo === lotePreferido;
      const score = scoreCandidato({
        placed: plancha.piezas.length,
        esRetazo: slab.esRetazo,
        mismoLote,
        area: areaCm2(slab.largoCm, slab.anchoCm),
      });
      if (score > bestScore) {
        bestScore = score;
        best = plancha;
      }
    }
    return best;
  };

  const commit = (plancha: PlanCortePlancha) => {
    used.add(plancha.chapaId);
    planchas.push(plancha);
    const colocadas = new Set(plancha.piezas.map((p) => p.key));
    remaining = remaining.filter((p) => !colocadas.has(p.key));
    lotePreferido = plancha.loteCodigo ?? lotePreferido;
  };

  for (const slab of forzar) {
    const plancha = tryPackOn(slab);
    if (plancha) commit(plancha);
  }

  const libres = opts.planchas.filter((p) => !used.has(p.id));
  while (remaining.length > 0) {
    const next = elegirMejor(libres.filter((p) => !used.has(p.id)));
    if (!next) break;
    commit(next);
  }

  const m2Planchas = planchas.reduce((s, p) => s + m2De(p.largoCm, p.anchoCm), 0);
  const m2Usado = planchas.reduce((s, p) => s + p.m2Usado, 0);
  const m2Sobrante = planchas.reduce((s, p) => s + p.m2Sobrante, 0);

  return {
    ...base,
    planchas,
    piezasSinCabida: remaining.map((p) => ({
      key: p.key,
      itemKey: p.itemKey,
      label: p.label,
      largoCm: p.largoCm,
      anchoCm: p.anchoCm,
      motivo: "empalme" as const,
    })),
    m2TotalPlanchas: round3(m2Planchas),
    m2TotalSobrante: round3(m2Sobrante),
    pctAprovechado: round3(m2Planchas > 0 ? (m2Usado / m2Planchas) * 100 : 0),
  };
}

export function confirmarPlanCorte(plan: PlanCorte): PlanCorte {
  if (!plan.requiereConfirmacion) return { ...plan, confirmado: false };
  if (plan.planchas.length === 0) return { ...plan, confirmado: false };
  return { ...plan, confirmado: true };
}

export function planCorteSigueValido(
  plan: PlanCorte | null | undefined,
  fingerprint: string,
): boolean {
  if (!plan) return false;
  return plan.fingerprint === fingerprint;
}

export function otRequierePlanConfirmado(
  ot: Pick<OrdenTrabajoWizard, "items" | "piedraDelCliente" | "titulo" | "planCorte">,
  articulos: ArticuloConPrecio[],
): boolean {
  return piezasDesdeOrden(ot, articulos).length > 0;
}

export function motivoPlanSinConfirmar(
  ot: OrdenTrabajoWizard,
  articulos: ArticuloConPrecio[],
  index: number,
): string | null {
  if (!otRequierePlanConfirmado(ot, articulos)) return null;
  const titulo = ot.titulo.trim() || `OT ${index + 1}`;
  const plan = ot.planCorte;
  if (!plan || plan.planchas.length === 0) {
    return `No hay plancha disponible para «${titulo}». Elegí otro material o cargá stock.`;
  }
  if (!plan.confirmado) {
    return `Confirmá la plancha de «${titulo}» para poder señar.`;
  }
  return null;
}

export function validarPlanesConfirmados(
  ordenes: OrdenTrabajoWizard[],
  articulos: ArticuloConPrecio[],
): string | null {
  for (let i = 0; i < ordenes.length; i += 1) {
    const msg = motivoPlanSinConfirmar(ordenes[i]!, articulos, i);
    if (msg) return msg;
  }
  return null;
}

/** Para seña: usa el plan ya guardado, sin recatalogar artículos. */
export function validarPlanParaSenia(ordenes: OrdenTrabajoWizard[]): string | null {
  for (let i = 0; i < ordenes.length; i += 1) {
    const ot = ordenes[i]!;
    if (ot.piedraDelCliente) continue;
    const plan = ot.planCorte;
    if (!plan?.requiereConfirmacion) continue;
    const titulo = ot.titulo.trim() || `OT ${i + 1}`;
    if (!plan.confirmado || plan.planchas.length === 0) {
      return `Confirmá la plancha de «${titulo}» para poder señar.`;
    }
  }
  return null;
}

export function chapaIdsDePlan(plan: PlanCorte | null | undefined): string[] {
  if (!plan) return [];
  return [...new Set(plan.planchas.map((p) => p.chapaId))];
}

export function normalizePlanCorte(raw: unknown): PlanCorte | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<PlanCorte>;
  if (p.version !== PLAN_CORTE_VERSION) return null;
  if (!Array.isArray(p.planchas)) return null;
  return {
    version: PLAN_CORTE_VERSION,
    fingerprint: typeof p.fingerprint === "string" ? p.fingerprint : "",
    confirmado: p.confirmado === true,
    requiereConfirmacion: p.requiereConfirmacion === true,
    materialId: typeof p.materialId === "string" ? p.materialId : null,
    materialLabel: typeof p.materialLabel === "string" ? p.materialLabel : "",
    discoCm: typeof p.discoCm === "number" ? p.discoCm : DISCO_CM_DEFAULT,
    permiteRotar: p.permiteRotar !== false,
    planchas: p.planchas.map((pl) => ({
      chapaId: pl.chapaId,
      bulto: pl.bulto,
      largoCm: Number(pl.largoCm) || 0,
      anchoCm: Number(pl.anchoCm) || 0,
      loteCodigo: pl.loteCodigo ?? null,
      esRetazo: Boolean(pl.esRetazo),
      m2Usado: Number(pl.m2Usado) || 0,
      m2Sobrante: Number(pl.m2Sobrante) || 0,
      m2Perdido: Number(pl.m2Perdido) || 0,
      pctAprovechado: Number(pl.pctAprovechado) || 0,
      piezas: Array.isArray(pl.piezas) ? pl.piezas : [],
      sobrantes: Array.isArray(pl.sobrantes) ? pl.sobrantes : [],
    })),
    piezasSinCabida: Array.isArray(p.piezasSinCabida) ? p.piezasSinCabida : [],
    m2TotalPiezas: Number(p.m2TotalPiezas) || 0,
    m2TotalPlanchas: Number(p.m2TotalPlanchas) || 0,
    m2TotalSobrante: Number(p.m2TotalSobrante) || 0,
    pctAprovechado: Number(p.pctAprovechado) || 0,
  };
}

/** @internal exported for tests */
export function packGuillotineForTest(
  binW: number,
  binH: number,
  piezas: PiezaPlanCorte[],
  kerf = DISCO_CM_DEFAULT,
  allowRotate = true,
) {
  return packGuillotine(binW, binH, piezas, kerf, allowRotate);
}

export function lineaTieneMedidasEmpacables(
  line: LineaItemOT,
  articulo: ArticuloConPrecio | undefined,
): boolean {
  if (!articulo) return false;
  const art = articuloConPrecioToMock(articulo);
  if (!art.calculaMaterial) return false;
  if (art.unidad === "M2" && line.modoIngreso !== "manual") {
    return parseDecimalInput(line.altoM) > 0 && parseDecimalInput(line.anchoM) > 0;
  }
  if (art.unidad === "ML") return parseDecimalInput(line.cantidad) > 0;
  return false;
}
