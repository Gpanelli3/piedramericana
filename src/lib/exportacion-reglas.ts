import type { ExportacionEstado } from "@/types/database";

export const EXPORTACION_ESTADOS: { value: ExportacionEstado; label: string }[] = [
  { value: "pedido", label: "Pedido" },
  { value: "facturada", label: "Facturada" },
  { value: "embarcada", label: "Embarcada" },
  { value: "cobrada", label: "Cobrada" },
];

export function estadoExportacionLabel(v: string): string {
  return EXPORTACION_ESTADOS.find((e) => e.value === v)?.label ?? v;
}

export function yaTieneIngreso(exp: { movimiento_id: string | null | undefined }): boolean {
  return Boolean(exp.movimiento_id?.trim());
}

export function pideDatosCobro(destino: ExportacionEstado, movimientoId: string | null | undefined): boolean {
  return destino === "cobrada" && !yaTieneIngreso({ movimiento_id: movimientoId ?? null });
}

export type PuedeRegistrarCobroInput = {
  monto: number;
  fecha: string;
  cuentaId: string;
};

export type PuedeRegistrarCobroResultado = {
  ok: boolean;
  faltantes: string[];
};

export function puedeRegistrarCobro(input: PuedeRegistrarCobroInput): PuedeRegistrarCobroResultado {
  const faltantes: string[] = [];
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    faltantes.push("Indicá el monto cobrado.");
  }
  if (!input.fecha.trim()) {
    faltantes.push("Indicá la fecha de cobro.");
  }
  if (!input.cuentaId.trim()) {
    faltantes.push("Elegí la cuenta donde entra la plata.");
  }
  return { ok: faltantes.length === 0, faltantes };
}

export function descripcionIngresoExportacion(input: {
  cliente: string;
  descripcion: string;
  nroFactura: string | null | undefined;
}): string {
  const cliente = input.cliente.trim() || "cliente";
  const factura = input.nroFactura?.trim();
  const desc = input.descripcion.trim();
  if (factura) return `Exportación ${desc || "—"} · ${cliente} · factura ${factura}`;
  return `Exportación ${desc || "—"} · ${cliente}`;
}

export function camposFaltantesExportacion(exp: {
  nro_factura: string | null;
  fecha_factura: string | null;
  monto_factura: number | null;
  banco_nombre: string | null;
  banco_cuenta: string | null;
  cuenta_id: string | null;
}): string[] {
  const falta: string[] = [];
  if (!exp.nro_factura) falta.push("N° factura");
  if (!exp.fecha_factura) falta.push("Fecha de factura");
  if (exp.monto_factura == null) falta.push("Monto de factura");
  if (!exp.banco_nombre) falta.push("Banco");
  if (!exp.banco_cuenta) falta.push("Cuenta / CBU");
  if (!exp.cuenta_id) falta.push("Cuenta de cobro");
  return falta;
}
