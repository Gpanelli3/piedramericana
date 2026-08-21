import type { ModoIngresoM2 } from "@/lib/presupuesto-calculos";

export const TIPOS_COLOCACION = [
  { value: "bajo", label: "Bajo mesada" },
  { value: "sobre", label: "Sobre mesada" },
  { value: "ras", label: "Al ras" },
] as const;

export const MODELOS_BACHA = [
  { value: "johnson-ss", label: "Johnson — Acero Premium" },
  { value: "mi-pileta", label: "Mi Pileta — Linea Cocina" },
  { value: "franke", label: "Franke — Orion 70" },
  { value: "rohe", label: "Rohé — Oval 60" },
  { value: "sin", label: "Sin especificar / a definir" },
] as const;

export type LogisticaPresupuesto = {
  fechaCoord: string;
  fechaEntrega: string;
  observacion: string;
};

export type LineaItemOT = {
  key: string;
  articuloId: string;
  modoIngreso: ModoIngresoM2;
  cantidad: string;
  precioUnitario: string;
  /** Alto en metros (M2 dimensiones o ML). */
  altoM: string;
  /** Ancho en metros (solo M2 dimensiones). */
  anchoM: string;
  desperdicioPct: string;
};

/** Plano / comprobante de cotización adjunto a una OT. */
export type PlanoAdjuntoOt = {
  name: string;
  mime: string;
  storagePath: string;
  size: number;
};

export type OrdenTrabajoWizard = {
  key: string;
  titulo: string;
  fecha: string;
  tecnicoId: string;
  fechaMedicion: string;
  fechaEntrega: string;
  materialId: string;
  /**
   * Chapa señalada del inventario (sigue Disponible hasta la seña).
   * Al señar se intenta reservar; si ya no está, se pide otra del mismo material.
   */
  chapaSugeridaId: string | null;
  chapaSugeridaBulto: string;
  chapaSugeridaLabel: string;
  tipoColocacion: (typeof TIPOS_COLOCACION)[number]["value"];
  bachaId: string;
  items: LineaItemOT[];
  /** Dirección de obra (texto ingresado / buscado). */
  direccionObra: string;
  obraLat: number | null;
  obraLng: number | null;
  /** Dirección formateada tras geocode. */
  obraFormattedAddress: string;
  /** Detalle libre (lote, manzana, etc.) — va al PDF. */
  referenciaObra: string;
  planoAdjunto: PlanoAdjuntoOt | null;
  mMedicion: boolean;
  mEntrega: boolean;
  mColocacion: boolean;
  totalMec: string;
  panelExpandido: boolean;
};

export function newEmptyLineaItem(): LineaItemOT {
  return {
    key: crypto.randomUUID(),
    articuloId: "",
    modoIngreso: "dimensiones",
    cantidad: "1",
    precioUnitario: "",
    altoM: "0",
    anchoM: "0",
    desperdicioPct: "0",
  };
}

export function newOrdenTrabajo(materialIdDefault: string): OrdenTrabajoWizard {
  return {
    key: crypto.randomUUID(),
    titulo: "",
    fecha: "",
    tecnicoId: "",
    fechaMedicion: "",
    fechaEntrega: "",
    materialId: materialIdDefault,
    chapaSugeridaId: null,
    chapaSugeridaBulto: "",
    chapaSugeridaLabel: "",
    tipoColocacion: "bajo",
    bachaId: MODELOS_BACHA[0]!.value,
    items: [],
    direccionObra: "",
    obraLat: null,
    obraLng: null,
    obraFormattedAddress: "",
    referenciaObra: "",
    planoAdjunto: null,
    mMedicion: true,
    mEntrega: true,
    mColocacion: true,
    totalMec: "1",
    panelExpandido: true,
  };
}
