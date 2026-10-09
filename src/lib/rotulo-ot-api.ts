import { etiquetaTipoColocacion } from "@/components/presupuesto/wizard/types";
import { fetchMedidasOt } from "@/lib/ot-medidas-api";
import { getOtProduccionById } from "@/lib/produccion-api";
import { getPlanoSignedUrl } from "@/lib/presupuesto-planos-storage";
import { formatMetraje, parseDecimalInput } from "@/lib/presupuesto-calculos";
import { getPresupuestoById } from "@/lib/presupuestos-api";
import {
  hydratePresupuestoPayloadV1,
  isPresupuestoPayloadV1,
} from "@/types/presupuesto-payload";

export type RotuloPieza = {
  articulo: string;
  medidas: string;
  m2: string;
};

export type RotuloOtDatos = {
  titulo: string;
  presupuestoNumero: string;
  fechaEntrega: string;
  cliente: string;
  direccion: string;
  material: string;
  bachaTitulo: string;
  bachaDetalle: string | null;
  piezas: RotuloPieza[];
};

export type RotuloPiezaInput = {
  articuloLabel: string;
  muestraAlto: boolean;
  muestraAncho: boolean;
  altoM: string;
  anchoM: string;
  cantidad: string;
  m2Approx: number;
};

export type RotuloOtInput = {
  titulo: string;
  presupuestoNumero: string;
  fechaProgramada: string | null | undefined;
  cliente: string;
  direccion: string;
  material: string;
  bachaRequerida: boolean;
  bachaTipo: string | null | undefined;
  bachaOrigen: string | null | undefined;
  bachaColocacion: string | null | undefined;
  piezas: RotuloPiezaInput[];
};

/** Fecha de entrega del rótulo: `dd/mm/aaaa` o «Sin fecha». */
export function formatoFechaEntregaRotulo(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return "Sin fecha";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "Sin fecha";
  return `${d}/${m}/${y}`;
}

export function formatoDimRotulo(v: string): string {
  const n = parseDecimalInput(v);
  if (!(n > 0)) return v.trim() || "—";
  return n.toLocaleString("es-AR", { maximumFractionDigits: 3 });
}

export function textoMedidasPiezaRotulo(input: {
  muestraAlto: boolean;
  muestraAncho: boolean;
  altoM: string;
  anchoM: string;
  cantidad: string;
}): string {
  if (input.muestraAlto || input.muestraAncho) {
    return `${formatoDimRotulo(input.altoM)} × ${formatoDimRotulo(input.anchoM)} m`;
  }
  return `cant. ${input.cantidad.trim() || "—"}`;
}

export function textoBachaRotulo(input: {
  requerida: boolean;
  tipo: string | null | undefined;
  origen: string | null | undefined;
  colocacion: string | null | undefined;
}): { titulo: string; detalle: string | null } {
  if (!input.requerida) {
    return { titulo: "Sin bacha", detalle: null };
  }
  const titulo = input.tipo?.trim() || "Sin especificar";
  const partes: string[] = [];
  if (input.origen === "propia") partes.push("Nuestra");
  if (input.origen === "cliente") partes.push("Del cliente");
  const coloc = input.colocacion?.trim();
  if (coloc) partes.push(etiquetaTipoColocacion(coloc));
  return { titulo, detalle: partes.length > 0 ? partes.join(" · ") : null };
}

export function armarRotuloOt(input: RotuloOtInput): RotuloOtDatos {
  const nro = input.presupuestoNumero.trim();
  const titulo = input.titulo.trim() || (nro ? `OT · ${nro}` : "OT");
  const bacha = textoBachaRotulo({
    requerida: input.bachaRequerida,
    tipo: input.bachaTipo,
    origen: input.bachaOrigen,
    colocacion: input.bachaColocacion,
  });
  return {
    titulo,
    presupuestoNumero: nro || "—",
    fechaEntrega: formatoFechaEntregaRotulo(input.fechaProgramada),
    cliente: input.cliente.trim() || "—",
    direccion: input.direccion.trim() || "—",
    material: input.material.trim() || "—",
    bachaTitulo: bacha.titulo,
    bachaDetalle: bacha.detalle,
    piezas: input.piezas.map((p) => ({
      articulo: p.articuloLabel.trim() || "Pieza",
      medidas: textoMedidasPiezaRotulo(p),
      m2: formatMetraje(p.m2Approx),
    })),
  };
}

export async function fetchRotuloOt(
  otId: string,
): Promise<{ data: RotuloOtDatos | null; error: Error | null }> {
  const otRes = await getOtProduccionById(otId);
  if (otRes.error || !otRes.data) {
    return { data: null, error: otRes.error ?? new Error("No se encontró la OT.") };
  }
  const item = otRes.data;
  const medRes = await fetchMedidasOt(otId);
  if (medRes.error) return { data: null, error: medRes.error };

  return {
    data: armarRotuloOt({
      titulo: item.orden.titulo ?? "",
      presupuestoNumero: item.presupuestoNumero,
      fechaProgramada: item.orden.fecha_programada,
      cliente: item.cliente,
      direccion: item.direccionObra,
      material: item.materialLabel,
      bachaRequerida: Boolean(item.orden.bacha_requerida),
      bachaTipo: item.orden.bacha_tipo,
      bachaOrigen: item.orden.bacha_origen,
      bachaColocacion: item.orden.bacha_colocacion,
      piezas: medRes.data?.items ?? [],
    }),
    error: null,
  };
}

export async function abrirPlanoOt(
  presupuestoId: string | null | undefined,
  ordenKey: string | null | undefined,
): Promise<{ sinPlano: boolean; error: Error | null }> {
  const presId = presupuestoId?.trim() ?? "";
  const key = ordenKey?.trim() ?? "";
  if (!presId || !key) {
    return { sinPlano: true, error: null };
  }

  const pres = await getPresupuestoById(presId);
  if (pres.error) {
    return { sinPlano: false, error: new Error(pres.error.message) };
  }
  const raw = pres.data?.payload;
  if (!raw || !isPresupuestoPayloadV1(raw)) {
    return { sinPlano: true, error: null };
  }
  const payload = hydratePresupuestoPayloadV1(raw);
  const ot = payload.ordenes.find((o) => o.key === key);
  const path = ot?.planoAdjunto?.storagePath?.trim() ?? "";
  if (!path) {
    return { sinPlano: true, error: null };
  }

  const signed = await getPlanoSignedUrl(path);
  if (signed.error || !signed.url) {
    return {
      sinPlano: false,
      error: signed.error ?? new Error("No se pudo abrir el plano."),
    };
  }
  const opened = window.open(signed.url, "_blank", "noopener,noreferrer");
  if (!opened) {
    return {
      sinPlano: false,
      error: new Error("El navegador bloqueó la ventana del plano."),
    };
  }
  return { sinPlano: false, error: null };
}
