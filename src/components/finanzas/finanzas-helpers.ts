import type {
  ContraparteInfo,
  CuentaFinancieraRow,
  MovimientoCajaRow,
  SaldoCuentaRow,
} from "@/lib/finanzas-api";

export function formatMonto(n: number, moneda: "ars" | "usd"): string {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: moneda === "usd" ? 2 : 0,
    maximumFractionDigits: moneda === "usd" ? 2 : 0,
  };
  const prefix = moneda === "usd" ? "USD " : "$ ";
  return `${prefix}${n.toLocaleString("es-AR", opts)}`;
}

export function formatFechaCorta(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}

export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatFechaCorta(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function esSalida(tipo: MovimientoCajaRow["tipo"]): boolean {
  return tipo === "egreso" || tipo === "transferencia_salida";
}

export function etiquetaTipoMov(t: MovimientoCajaRow["tipo"]): string {
  switch (t) {
    case "ingreso":
      return "Cobro";
    case "egreso":
      return "Egreso";
    case "transferencia_entrada":
    case "transferencia_salida":
      return "Transferencia";
    default:
      return t;
  }
}

export function etiquetaFormaPago(tipo: CuentaFinancieraRow["tipo"]): string {
  switch (tipo) {
    case "banco":
      return "Transferencia";
    case "tarjeta":
      return "Tarjeta";
    case "cheque":
      return "Cheque";
    case "caja":
      return "Efectivo";
    default:
      return "Otro";
  }
}

export function etiquetaCajon(c: { nombre?: string | null; tipo: CuentaFinancieraRow["tipo"]; moneda: "ars" | "usd" }): string {
  if (c.nombre?.trim()) return c.nombre.trim();
  return `${etiquetaFormaPago(c.tipo)} ${c.moneda.toUpperCase()}`;
}

export function etiquetaAcreditacion(a: MovimientoCajaRow["acreditacion"]): string | null {
  if (a === "pendiente") return "Tarjeta pendiente";
  if (a === "acreditado") return "Tarjeta acreditada";
  return null;
}

export function etiquetaOrigen(referenciaTipo: string | null | undefined): string {
  switch (referenciaTipo) {
    case "venta_pago":
      return "Venta";
    case "gasto_fijo":
      return "Gasto fijo";
    case "exportacion":
      return "Exportación";
    case "transferencia":
      return "Transferencia";
    case "manual":
      return "Manual";
    default:
      return referenciaTipo?.trim() || "Manual";
  }
}

export function contraparteDesdeMovimiento(
  m: MovimientoCajaRow,
  suppliersById: Map<string, string>,
  contrapartes?: Map<string, ContraparteInfo>,
): string {
  const info = contrapartes?.get(m.id);
  if (info?.nombre) return info.nombre;
  if (m.supplier_id) {
    return suppliersById.get(m.supplier_id) ?? "Proveedor";
  }
  if (m.referencia_tipo === "venta_pago") return "Cliente";
  const desc = m.descripcion?.trim() ?? "";
  if (desc) return desc;
  return etiquetaTipoMov(m.tipo);
}

export function subtituloContraparte(
  m: MovimientoCajaRow,
  contrapartes?: Map<string, ContraparteInfo>,
): string | null {
  return contrapartes?.get(m.id)?.subtitulo ?? null;
}

export function totalesPorMoneda(saldos: SaldoCuentaRow[]): { ars: number; usd: number } {
  const ars = saldos.filter((s) => s.moneda === "ars").reduce((a, s) => a + Number(s.saldo_actual), 0);
  const usd = saldos.filter((s) => s.moneda === "usd").reduce((a, s) => a + Number(s.saldo_actual), 0);
  return { ars, usd };
}

export function exportarCsv(filename: string, headers: string[], rows: string[][]): void {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
