import { etiquetaTipoColocacion } from "@/components/presupuesto/wizard/types";
import { fetchMedidasOt } from "@/lib/ot-medidas-api";
import { ALTO_ZOCALO_CM } from "@/lib/plan-corte";
import { getOtProduccionById } from "@/lib/produccion-api";
import { descargarBlob } from "@/lib/descargar-pdf";
import { downloadPlanoArchivo, getPlanoSignedUrl } from "@/lib/presupuesto-planos-storage";
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
  ambiente: string;
  presupuestoNumero: string;
  fechaEntrega: string;
  cliente: string;
  telefono: string;
  direccion: string;
  material: string;
  zocalo: string;
  bachaTitulo: string;
  bachaDetalle: string | null;
  comoVa: string;
  notas: string;
  piezas: RotuloPieza[];
};

export type RotuloPiezaInput = {
  articuloLabel: string;
  articuloCodigo?: string | null;
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
  telefono?: string | null | undefined;
  direccion: string;
  material: string;
  bachaRequerida: boolean;
  bachaAsignada?: boolean;
  bachaTipo: string | null | undefined;
  bachaOrigen: string | null | undefined;
  bachaColocacion: string | null | undefined;
  notas?: string | null | undefined;
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

const CODIGOS_ZOCALO = new Set(["ZOC-M2", "ZOC-ML"]);

function textoIncluyeZocalo(texto: string): boolean {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .includes("zocalo");
}

export function esPiezaZocaloRotulo(input: {
  articuloCodigo?: string | null;
  articuloLabel?: string | null;
}): boolean {
  const codigo = (input.articuloCodigo ?? "").trim().toUpperCase();
  if (CODIGOS_ZOCALO.has(codigo)) return true;
  return textoIncluyeZocalo(input.articuloLabel ?? "");
}

export function textoTelefonoRotulo(tel: string | null | undefined): string {
  const t = tel?.trim() ?? "";
  return t || "—";
}

export function textoNotasRotulo(notas: string | null | undefined): string {
  const t = notas?.trim() ?? "";
  return t || "—";
}

function formatoCmRotulo(cm: number): string {
  const n = Math.round(cm * 10) / 10;
  const texto = Number.isInteger(n)
    ? String(n)
    : n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
  return `${texto} cm`;
}

/** Altura del zócalo en cm: lado chico de la pieza, o 10 cm si solo hay largo. */
export function alturaZocaloCm(p: {
  muestraAlto?: boolean;
  muestraAncho?: boolean;
  altoM?: string;
  anchoM?: string;
}): number {
  const alto = parseDecimalInput(p.altoM ?? "");
  const ancho = parseDecimalInput(p.anchoM ?? "");
  if (alto > 0 && alto <= 0.5) return alto * 100;
  if (p.muestraAncho) {
    const dims = [alto, ancho].filter((n) => n > 0);
    if (dims.length > 0) {
      const menor = Math.min(...dims);
      if (menor <= 0.5) return menor * 100;
    }
  }
  return ALTO_ZOCALO_CM;
}

/** Altura en cm si hay zócalo; si no, «—». */
export function textoZocaloRotulo(
  piezas: Array<{
    articuloCodigo?: string | null;
    articuloLabel?: string | null;
    muestraAlto?: boolean;
    muestraAncho?: boolean;
    altoM?: string;
    anchoM?: string;
  }>,
): string {
  const zocalos = piezas.filter(esPiezaZocaloRotulo);
  if (zocalos.length === 0) return "—";
  const alturas = [
    ...new Set(zocalos.map((p) => Math.round(alturaZocaloCm(p) * 10) / 10)),
  ].sort((a, b) => a - b);
  return alturas.map(formatoCmRotulo).join(" · ");
}

function extrasBachaRotulo(origen: string | null | undefined): string[] {
  const partes: string[] = [];
  if (origen === "propia") partes.push("Nuestra");
  if (origen === "cliente") partes.push("Del cliente");
  return partes;
}

export function textoComoVaRotulo(input: {
  requerida: boolean;
  colocacion: string | null | undefined;
}): string {
  if (!input.requerida) return "—";
  const coloc = input.colocacion?.trim() ?? "";
  if (!coloc) return "—";
  return etiquetaTipoColocacion(coloc);
}

export function textoBachaRotulo(input: {
  requerida: boolean;
  asignada?: boolean;
  tipo: string | null | undefined;
  origen: string | null | undefined;
}): { titulo: string; detalle: string | null } {
  if (!input.requerida) {
    return { titulo: "—", detalle: null };
  }
  const tipo = input.tipo?.trim() ?? "";
  const extras = extrasBachaRotulo(input.origen);
  if (!input.asignada) {
    const detallePartes = tipo ? [tipo, ...extras] : extras;
    return {
      titulo: "Bacha pendiente",
      detalle: detallePartes.length > 0 ? detallePartes.join(" · ") : null,
    };
  }
  if (tipo) {
    return { titulo: tipo, detalle: extras.length > 0 ? extras.join(" · ") : null };
  }
  return {
    titulo: "Bacha",
    detalle: extras.length > 0 ? extras.join(" · ") : null,
  };
}

export function armarRotuloOt(input: RotuloOtInput): RotuloOtDatos {
  const nro = input.presupuestoNumero.trim();
  const tituloTrim = input.titulo.trim();
  const titulo = tituloTrim || (nro ? `OT · ${nro}` : "OT");
  const bacha = textoBachaRotulo({
    requerida: input.bachaRequerida,
    asignada: input.bachaAsignada,
    tipo: input.bachaTipo,
    origen: input.bachaOrigen,
  });
  return {
    titulo,
    ambiente: tituloTrim || "—",
    presupuestoNumero: nro || "—",
    fechaEntrega: formatoFechaEntregaRotulo(input.fechaProgramada),
    cliente: input.cliente.trim() || "—",
    telefono: textoTelefonoRotulo(input.telefono),
    direccion: input.direccion.trim() || "—",
    material: input.material.trim() || "—",
    zocalo: textoZocaloRotulo(input.piezas),
    bachaTitulo: bacha.titulo,
    bachaDetalle: bacha.detalle,
    comoVa: textoComoVaRotulo({
      requerida: input.bachaRequerida,
      colocacion: input.bachaColocacion,
    }),
    notas: textoNotasRotulo(input.notas),
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
      telefono: item.telefono,
      direccion: item.direccionObra,
      material: item.materialLabel,
      bachaRequerida: Boolean(item.orden.bacha_requerida),
      bachaAsignada: Boolean(item.orden.bacha_id),
      bachaTipo: item.orden.bacha_tipo,
      bachaOrigen: item.orden.bacha_origen,
      bachaColocacion: item.orden.bacha_colocacion,
      notas: medRes.data?.notasMedicion ?? "",
      piezas: medRes.data?.items ?? [],
    }),
    error: null,
  };
}

export type PlanoOtArchivo = {
  url: string;
  mime: string;
  name: string;
};

type PlanoUbicado = {
  storagePath: string;
  mime: string;
  name: string;
};

function nombreArchivoPlano(name: string, mime: string): string {
  const base = name.trim() || "Plano";
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
  const ext =
    mime === "application/pdf"
      ? "pdf"
      : mime === "image/jpeg"
        ? "jpg"
        : mime === "image/png"
          ? "png"
          : mime === "image/webp"
            ? "webp"
            : mime === "image/gif"
              ? "gif"
              : "";
  return ext ? `${base}.${ext}` : base;
}

async function ubicarPlanoOt(
  presupuestoId: string | null | undefined,
  ordenKey: string | null | undefined,
): Promise<{ data: PlanoUbicado | null; sinPlano: boolean; error: Error | null }> {
  const presId = presupuestoId?.trim() ?? "";
  const key = ordenKey?.trim() ?? "";
  if (!presId || !key) {
    return { data: null, sinPlano: true, error: null };
  }

  const pres = await getPresupuestoById(presId);
  if (pres.error) {
    return { data: null, sinPlano: false, error: new Error(pres.error.message) };
  }
  const raw = pres.data?.payload;
  if (!raw || !isPresupuestoPayloadV1(raw)) {
    return { data: null, sinPlano: true, error: null };
  }
  const payload = hydratePresupuestoPayloadV1(raw);
  const ot = payload.ordenes.find((o) => o.key === key);
  const path = ot?.planoAdjunto?.storagePath?.trim() ?? "";
  if (!path) {
    return { data: null, sinPlano: true, error: null };
  }
  return {
    data: {
      storagePath: path,
      mime: ot?.planoAdjunto?.mime ?? "",
      name: ot?.planoAdjunto?.name?.trim() || "Plano",
    },
    sinPlano: false,
    error: null,
  };
}

export async function resolverPlanoOt(
  presupuestoId: string | null | undefined,
  ordenKey: string | null | undefined,
): Promise<{ data: PlanoOtArchivo | null; sinPlano: boolean; error: Error | null }> {
  const ubicado = await ubicarPlanoOt(presupuestoId, ordenKey);
  if (!ubicado.data) {
    return { data: null, sinPlano: ubicado.sinPlano, error: ubicado.error };
  }

  const signed = await getPlanoSignedUrl(ubicado.data.storagePath);
  if (signed.error || !signed.url) {
    return {
      data: null,
      sinPlano: false,
      error: signed.error ?? new Error("No se pudo abrir el plano."),
    };
  }
  return {
    data: {
      url: signed.url,
      mime: ubicado.data.mime,
      name: ubicado.data.name,
    },
    sinPlano: false,
    error: null,
  };
}

export async function descargarPlanoOt(
  presupuestoId: string | null | undefined,
  ordenKey: string | null | undefined,
): Promise<{ sinPlano: boolean; error: Error | null }> {
  const ubicado = await ubicarPlanoOt(presupuestoId, ordenKey);
  if (!ubicado.data) {
    return { sinPlano: ubicado.sinPlano, error: ubicado.error };
  }
  const file = await downloadPlanoArchivo(ubicado.data.storagePath);
  if (file.error || !file.blob) {
    return { sinPlano: false, error: file.error ?? new Error("No se pudo descargar el plano.") };
  }
  descargarBlob(file.blob, nombreArchivoPlano(ubicado.data.name, ubicado.data.mime));
  return { sinPlano: false, error: null };
}

export async function descargarPlanoPorOtId(
  otId: string,
): Promise<{ sinPlano: boolean; error: Error | null }> {
  const ot = await getOtProduccionById(otId);
  if (ot.error || !ot.data) {
    return { sinPlano: false, error: ot.error ?? new Error("No se encontró la OT.") };
  }
  return descargarPlanoOt(ot.data.presupuestoId, ot.data.orden.orden_key);
}
