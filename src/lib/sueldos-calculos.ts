import type { LiquidacionConceptoTipo } from "@/types/database";

export const TIPOS_CONCEPTO_DESCUENTO: ReadonlySet<LiquidacionConceptoTipo> = new Set([
  "adelanto",
  "descuento",
  "carga_social",
]);

export const CONCEPTOS_LIQUIDACION: {
  value: LiquidacionConceptoTipo;
  label: string;
  grupo: "haber" | "descuento";
}[] = [
  { value: "sueldo_base", label: "Sueldo base", grupo: "haber" },
  { value: "comision", label: "Comisión", grupo: "haber" },
  { value: "hora_extra", label: "Horas extras", grupo: "haber" },
  { value: "instalacion", label: "Instalación extra", grupo: "haber" },
  { value: "flete", label: "Flete", grupo: "haber" },
  { value: "otro", label: "Otro (haber)", grupo: "haber" },
  { value: "adelanto", label: "Adelanto / viático", grupo: "descuento" },
  { value: "descuento", label: "Descuento", grupo: "descuento" },
  { value: "carga_social", label: "Cargas sociales", grupo: "descuento" },
];

export const MESES_LABEL: { value: number; label: string }[] = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

export function conceptoLabel(tipo: string | null | undefined): string {
  if (!tipo) return "—";
  return CONCEPTOS_LIQUIDACION.find((c) => c.value === tipo)?.label ?? tipo;
}

export function esDescuento(tipo: LiquidacionConceptoTipo): boolean {
  return TIPOS_CONCEPTO_DESCUENTO.has(tipo);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function parseMonto(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  const t = String(raw ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export type TotalesLiquidacion = {
  total_bruto: number;
  total_descuentos: number;
  total_neto: number;
};

export function calcularTotalesLiquidacion(
  conceptos: { tipo: LiquidacionConceptoTipo; monto: number }[],
): TotalesLiquidacion {
  let bruto = 0;
  let descuentos = 0;
  for (const c of conceptos) {
    const m = Math.abs(Number(c.monto) || 0);
    if (esDescuento(c.tipo)) descuentos += m;
    else bruto += m;
  }
  const total_bruto = round2(bruto);
  const total_descuentos = round2(descuentos);
  return {
    total_bruto,
    total_descuentos,
    total_neto: round2(total_bruto - total_descuentos),
  };
}

export function sumaPagos(p: {
  pago_efectivo_15: number;
  pago_banco_30: number;
  pago_efectivo_30: number;
}): number {
  return round2(
    (Number(p.pago_efectivo_15) || 0) +
      (Number(p.pago_banco_30) || 0) +
      (Number(p.pago_efectivo_30) || 0),
  );
}

/** Si los tramos están en 0, deja el neto en efectivo del 30. */
export function pagosAlCerrar(
  pagos: {
    pago_efectivo_15: number;
    pago_banco_30: number;
    pago_efectivo_30: number;
  },
  neto: number,
): {
  pago_efectivo_15: number;
  pago_banco_30: number;
  pago_efectivo_30: number;
} {
  const suma = sumaPagos(pagos);
  if (suma === 0 && neto !== 0) {
    return {
      pago_efectivo_15: 0,
      pago_banco_30: 0,
      pago_efectivo_30: round2(neto),
    };
  }
  return {
    pago_efectivo_15: round2(Number(pagos.pago_efectivo_15) || 0),
    pago_banco_30: round2(Number(pagos.pago_banco_30) || 0),
    pago_efectivo_30: round2(Number(pagos.pago_efectivo_30) || 0),
  };
}

export function formatPesos(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  return `$ ${v.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatPeriodo(mes: number, anio: number): string {
  const label = MESES_LABEL.find((m) => m.value === mes)?.label ?? String(mes);
  return `${label} ${anio}`;
}

export function formatFechaIso(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function periodoActual(): { mes: number; anio: number } {
  const d = new Date();
  return { mes: d.getMonth() + 1, anio: d.getFullYear() };
}
