import type { OrdenTrabajoWizard } from "@/components/presupuesto/wizard/types";
import type { ArticuloConPrecio } from "@/types/articulos";
import type { MaterialWizardRow } from "@/types/material-catalog";
import type { PresupuestoPayloadV1 } from "@/types/presupuesto-payload";
import {
  articuloCalculoParaLinea,
  buildLineaCalcInput,
  computeLineaPresupuesto,
  equivalentesMonedaMixta,
  formatMetraje,
  importeMecPresupuesto,
  labelUnidad,
  parseDecimalInput,
} from "@/lib/presupuesto-calculos";

export type LineaDetalleAmbiente = {
  key: string;
  descripcion: string;
  medidas: string;
  unidad: string;
  cant: number;
  m2: number;
  total: number;
};

export type GrupoAmbienteDetalle = {
  key: string;
  titulo: string;
  materialNombre: string;
  piezas: number;
  m2: number;
  subtotalItems: number;
  colocacion: number;
  total: number;
  filas: LineaDetalleAmbiente[];
};

export type SuperficieMaterial = {
  nombre: string;
  m2: number;
};

export type ServiciosDetalle = {
  /** Servicios marcados (Medición, Envío, Colocación) que cubre el importe MEC. */
  incluidos: string[];
  total: number;
};

export type PresupuestoDetalleVista = {
  moneda: "ars" | "usd";
  total: number;
  items: number;
  servicios: number;
  ambientes: GrupoAmbienteDetalle[];
  superficies: SuperficieMaterial[];
  serviciosSplit: ServiciosDetalle;
};

function formatDim(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function medidasHojaTrabajo(
  line: OrdenTrabajoWizard["items"][number],
  unidad: string,
): string {
  const alto = parseDecimalInput(line.altoM);
  const ancho = parseDecimalInput(line.anchoM);
  if (alto > 0 && ancho > 0) {
    return `L ${formatDim(alto)} m × A ${formatDim(ancho)} m`;
  }
  if (alto > 0 && unidad === "ML") return `L ${formatDim(alto)} m`;
  if (alto > 0) return `L ${formatDim(alto)} m`;
  return "";
}

function materialNombreOt(
  ot: OrdenTrabajoWizard,
  materials: MaterialWizardRow[],
): string {
  const material = materials.find((m) => m.id === ot.materialId);
  return material?.name || ot.materialLibre?.trim() || "";
}

function mecEnMonedaItems(opts: {
  mecArs: number;
  moneda: "ars" | "usd";
  dolarHoy: number;
}): number {
  const eq = equivalentesMonedaMixta({
    items: 0,
    monedaItems: opts.moneda,
    mecArs: opts.mecArs,
    dolarHoy: opts.dolarHoy,
  });
  return eq.totalEnMonedaItems;
}

export function buildPresupuestoDetalleVista(opts: {
  payload: PresupuestoPayloadV1;
  articulos: ArticuloConPrecio[];
  materials: MaterialWizardRow[];
}): PresupuestoDetalleVista {
  const { payload, articulos, materials } = opts;
  const moneda = payload.monedaPresupuesto;
  const ambientes: GrupoAmbienteDetalle[] = [];
  let subtotalItems = 0;

  for (const ot of payload.ordenes) {
    const filas: LineaDetalleAmbiente[] = [];
    let subOt = 0;
    let m2Ot = 0;

    for (const line of ot.items) {
      const artBd = articulos.find((a) => a.id === line.articuloId);
      const art = articuloCalculoParaLinea(artBd, line);
      const calc = buildLineaCalcInput(art, line);
      const { m2Linea, subtotal } = computeLineaPresupuesto(art, calc);
      const qty = parseDecimalInput(line.cantidad);
      const usaM2 = art.unidad === "M2" && art.calculaMaterial && m2Linea > 0;
      const cant = usaM2 ? m2Linea : qty > 0 ? qty : art.calculaMaterial ? m2Linea : 0;
      const unidad = usaM2 ? "m²" : labelUnidad(art.unidad);
      filas.push({
        key: line.key,
        descripcion: artBd?.descripcion || artBd?.codigo || "Ítem",
        medidas: medidasHojaTrabajo(line, art.unidad),
        unidad,
        cant,
        m2: m2Linea,
        total: subtotal,
      });
      subOt += subtotal;
      m2Ot += m2Linea;
    }

    if (filas.length === 0 && !ot.titulo.trim()) continue;

    ambientes.push({
      key: ot.key,
      titulo: ot.titulo.trim() || "Sin título",
      materialNombre: materialNombreOt(ot, materials),
      piezas: filas.length,
      m2: m2Ot,
      subtotalItems: subOt,
      colocacion: 0,
      total: subOt,
      filas,
    });
    subtotalItems += subOt;
  }

  const dPct = Math.max(0, Math.min(parseDecimalInput(payload.descuentoGlobalPct), 100));
  const netoItems = subtotalItems * (1 - dPct / 100);
  const mecArs = importeMecPresupuesto({
    mMedicion: payload.mMedicionGlobal,
    mEntrega: payload.mEntregaGlobal,
    mColocacion: payload.mColocacionGlobal,
    totalMec: payload.totalMecGlobal,
    ordenes: payload.ordenes,
  });
  const servicios = mecEnMonedaItems({
    mecArs,
    moneda,
    dolarHoy: payload.dolarHoy,
  });

  const m2Cubiertos = ambientes
    .filter((a) => {
      const ot = payload.ordenes.find((o) => o.key === a.key);
      return ot ? !ot.excluirMec : true;
    })
    .reduce((s, a) => s + a.m2, 0);

  if (servicios > 0) {
    for (const amb of ambientes) {
      const ot = payload.ordenes.find((o) => o.key === amb.key);
      if (ot?.excluirMec) continue;
      const share = m2Cubiertos > 0 ? amb.m2 / m2Cubiertos : 1 / Math.max(ambientes.length, 1);
      amb.colocacion = servicios * share;
      amb.total = amb.subtotalItems + amb.colocacion;
    }
  }

  // El MEC es un único importe para todos los servicios marcados.
  const incluidos: string[] = [];
  if (servicios > 0) {
    if (payload.mMedicionGlobal) incluidos.push("Medición");
    if (payload.mEntregaGlobal) incluidos.push("Envío");
    if (payload.mColocacionGlobal) incluidos.push("Colocación");
  }
  const split: ServiciosDetalle = { incluidos, total: servicios };

  const porMaterial = new Map<string, number>();
  for (const amb of ambientes) {
    const nombre = amb.materialNombre.trim() || "Sin material";
    porMaterial.set(nombre, (porMaterial.get(nombre) ?? 0) + amb.m2);
  }
  const superficies: SuperficieMaterial[] = [...porMaterial.entries()]
    .filter(([, m2]) => m2 > 0)
    .map(([nombre, m2]) => ({ nombre, m2 }));

  const eq = equivalentesMonedaMixta({
    items: netoItems,
    monedaItems: moneda,
    mecArs,
    dolarHoy: payload.dolarHoy,
  });

  return {
    moneda,
    total: eq.totalEnMonedaItems,
    items: netoItems,
    servicios,
    ambientes,
    superficies,
    serviciosSplit: split,
  };
}

export function formatMoneyCard(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatMoneyAr(n: number, moneda: "ars" | "usd"): string {
  const body = n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return moneda === "usd" ? `USD ${body}` : `$ ${body}`;
}

export function formatFechaLarga(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const month = d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
  return `${day} de ${month} de ${d.getFullYear()}`;
}

export function formatFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const month = d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
  const time = d.toLocaleTimeString("es-AR", { hour: "numeric", minute: "2-digit" });
  return `${day} ${month}, ${time}`;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

export function formatMetrajeDetalle(n: number): string {
  return `${formatMetraje(n)} m²`;
}
