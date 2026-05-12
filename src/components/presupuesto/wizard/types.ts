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
  altoCm: string;
  anchoCm: string;
  desperdicioPct: string;
};

export type OrdenTrabajoWizard = {
  key: string;
  titulo: string;
  fecha: string;
  tecnicoId: string;
  fechaMedicion: string;
  fechaEntrega: string;
  materialId: string;
  tipoColocacion: (typeof TIPOS_COLOCACION)[number]["value"];
  bachaId: string;
  items: LineaItemOT[];
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
    cantidad: "",
    precioUnitario: "",
    altoCm: "",
    anchoCm: "",
    desperdicioPct: "",
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
    tipoColocacion: "bajo",
    bachaId: MODELOS_BACHA[0]!.value,
    items: [],
    mMedicion: true,
    mEntrega: true,
    mColocacion: true,
    totalMec: "1",
    panelExpandido: true,
  };
}
