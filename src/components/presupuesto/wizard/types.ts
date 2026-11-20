import type { ModoIngresoM2 } from "@/lib/presupuesto-calculos";
import type { PlanCorte } from "@/lib/plan-corte";

export const TIPOS_COLOCACION = [
  { value: "bajo", label: "Bajo mesada" },
  { value: "sobre", label: "Sobre mesada" },
  { value: "ras", label: "Al ras" },
] as const;

export function etiquetaTipoColocacion(v: string): string {
  return TIPOS_COLOCACION.find((t) => t.value === v)?.label ?? v;
}

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
  /** Cortesía a propósito: la línea no se cobra (precio 0) y no se bloquea el guardado. */
  sinCargo?: boolean;
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
  /** Piedra escrita a mano cuando no se elige una del catálogo. */
  materialLibre?: string;
  /** La piedra la aporta el cliente: no se cobra ni se reserva chapa del galpón. */
  piedraDelCliente?: boolean;
  /**
   * Chapa señalada del inventario (sigue Disponible hasta la seña).
   * Al señar se intenta reservar; si ya no está, se pide otra del mismo material.
   * Si hay `planCorte`, las planchas del plan tienen prioridad.
   */
  chapaSugeridaId: string | null;
  chapaSugeridaBulto: string;
  chapaSugeridaLabel: string;
  /** Plan de acomodo automático. Confirmado por el vendedor antes de la seña. */
  planCorte?: PlanCorte | null;
  tipoColocacion: (typeof TIPOS_COLOCACION)[number]["value"];
  /** Quedó en presupuestos viejos. El modelo real está en el stock de bachas. */
  bachaId: string;
  /** Si esta OT lleva bacha. */
  llevaBacha: boolean;
  bachaOrigen: "propia" | "cliente";
  /** Terminación / código de taller que ellos cargan. */
  nafe: string;
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
  /** Si true, esta OT no incluye medición/entrega/colocación (el MEC global no la cubre). */
  excluirMec: boolean;
  /** Motivo corto cuando `excluirMec` (ej. mesa redonda). */
  obsMec: string;
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
    materialLibre: "",
    piedraDelCliente: false,
    chapaSugeridaId: null,
    chapaSugeridaBulto: "",
    chapaSugeridaLabel: "",
    planCorte: null,
    tipoColocacion: "bajo",
    bachaId: "",
    llevaBacha: false,
    bachaOrigen: "propia",
    nafe: "",
    items: [newEmptyLineaItem()],
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
    excluirMec: false,
    obsMec: "",
    panelExpandido: true,
  };
}

function planoPath(plano: PlanoAdjuntoOt | null): string {
  return plano?.storagePath ?? "";
}

export function snapshotUbicacionOt(
  ot: OrdenTrabajoWizard,
): Pick<
  OrdenTrabajoWizard,
  | "direccionObra"
  | "obraLat"
  | "obraLng"
  | "obraFormattedAddress"
  | "referenciaObra"
  | "planoAdjunto"
> {
  return {
    direccionObra: ot.direccionObra,
    obraLat: ot.obraLat,
    obraLng: ot.obraLng,
    obraFormattedAddress: ot.obraFormattedAddress,
    referenciaObra: ot.referenciaObra,
    planoAdjunto: ot.planoAdjunto,
  };
}

/** True si todas las OT comparten dirección, coords, referencia y plano. */
export function otsCompartenUbicacion(ordenes: OrdenTrabajoWizard[]): boolean {
  if (ordenes.length <= 1) return true;
  const a = ordenes[0];
  if (!a) return true;
  return ordenes.every(
    (ot) =>
      ot.direccionObra === a.direccionObra &&
      ot.obraLat === a.obraLat &&
      ot.obraLng === a.obraLng &&
      ot.obraFormattedAddress === a.obraFormattedAddress &&
      ot.referenciaObra === a.referenciaObra &&
      planoPath(ot.planoAdjunto) === planoPath(a.planoAdjunto),
  );
}
