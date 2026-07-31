import { supabase } from "@/lib/supabase";
import { downloadCsv, rowsToCsv } from "@/lib/export-csv";
import { listPresupuestosResumen } from "@/lib/presupuestos-api";
import { fetchRemitosList, fetchRemitoLines } from "@/lib/stock-api";

function fechaArchivo(): string {
  return new Date().toISOString().slice(0, 10);
}

function etiquetaEstadoVenta(e: string | null): string {
  if (!e) return "Sin seña";
  const map: Record<string, string> = {
    senado: "Señado",
    en_medicion: "En medición",
    en_produccion: "En producción",
    finalizado: "Finalizado",
    entregado: "Entregado",
  };
  return map[e] ?? e;
}

/** Exporta ventas aprobadas con resumen de cobros. */
export async function exportVentasCsv(): Promise<{ error: Error | null }> {
  const { data, error } = await listPresupuestosResumen();
  if (error) return { error };
  const aprob = (data ?? []).filter((r) => r.status === "aprobado");

  const headers = [
    "Presupuesto",
    "Cliente",
    "Total",
    "Moneda",
    "Estado venta",
    "Pagado",
    "Saldo",
    "Avance %",
    "Fecha creación",
  ];
  const rows = aprob.map((r) => [
    r.numero,
    r.cliente,
    r.total,
    r.moneda.toUpperCase(),
    etiquetaEstadoVenta(r.venta_estado),
    r.total_pagado_misma_moneda ?? 0,
    r.saldo_misma_moneda ?? r.total,
    r.pct_sena_sobre_presupuesto != null ? r.pct_sena_sobre_presupuesto.toFixed(1) : "",
    r.created_at.slice(0, 10),
  ]);

  downloadCsv(`ventas_${fechaArchivo()}.csv`, rowsToCsv(headers, rows));
  return { error: null };
}

/** Exporta todos los pagos de ventas con referencia al presupuesto. */
export async function exportPagosVentasCsv(): Promise<{ error: Error | null }> {
  const { data: pagos, error: pErr } = await supabase
    .from("ventas_pagos")
    .select(
      `
      id, monto, moneda, fecha, metodo, nota, created_at,
      ventas (
        presupuesto_id,
        presupuestos ( numero, cliente )
      )
    `,
    )
    .order("fecha", { ascending: false });
  if (pErr) return { error: new Error(pErr.message) };

  const headers = [
    "Fecha",
    "Presupuesto",
    "Cliente",
    "Monto",
    "Moneda",
    "Método",
    "Nota",
    "Registrado",
  ];
  const rows = (pagos ?? []).map((p) => {
    const venta = p.ventas as unknown as {
      presupuestos: { numero: string; cliente: string } | { numero: string; cliente: string }[] | null;
    } | null;
    const pres = venta?.presupuestos;
    const presRow = Array.isArray(pres) ? pres[0] : pres;
    const monto = typeof p.monto === "string" ? parseFloat(p.monto) : Number(p.monto ?? 0);
    return [
      p.fecha,
      presRow?.numero ?? "",
      presRow?.cliente ?? "",
      monto,
      p.moneda.toUpperCase(),
      p.metodo,
      p.nota ?? "",
      p.created_at.slice(0, 10),
    ];
  });

  downloadCsv(`cobros_${fechaArchivo()}.csv`, rowsToCsv(headers, rows));
  return { error: null };
}

/** Exporta remitos (compras/ingresos) con totales. */
export async function exportRemitosCsv(): Promise<{ error: Error | null }> {
  const remitos = await fetchRemitosList();

  const headers = [
    "Fecha",
    "N° remito",
    "Proveedor",
    "Placas",
    "m² total",
    "Observaciones",
    "Registrado",
  ];
  const rows = remitos.map((r) => [
    r.issue_date,
    `${r.branch_code}-${r.serial_code}`,
    r.supplier_name ?? "",
    r.total_slabs,
    r.total_m2.toFixed(3),
    r.notes ?? "",
    r.created_at.slice(0, 10),
  ]);

  downloadCsv(`compras_remitos_${fechaArchivo()}.csv`, rowsToCsv(headers, rows));
  return { error: null };
}

/** Exporta líneas de remitos (detalle de compras). */
export async function exportRemitosDetalleCsv(): Promise<{ error: Error | null }> {
  const remitos = await fetchRemitosList();

  const headers = [
    "Fecha remito",
    "N° remito",
    "Proveedor",
    "Material",
    "Placas",
    "Largo cm",
    "Ancho cm",
    "m² línea",
    "Precio unitario",
    "Lote",
  ];
  const rows: unknown[][] = [];

  for (const r of remitos) {
    const lines = await fetchRemitoLines(r.id);
    const numero = `${r.branch_code}-${r.serial_code}`;
    for (const l of lines) {
      const m2 = (Number(l.largo_cm) / 100) * (Number(l.ancho_cm) / 100) * l.qty_slabs;
      rows.push([
        r.issue_date,
        numero,
        r.supplier_name ?? "",
        l.material_label,
        l.qty_slabs,
        l.largo_cm,
        l.ancho_cm,
        m2.toFixed(3),
        l.precio_unitario ?? "",
        l.lote_codigo ?? "",
      ]);
    }
  }

  downloadCsv(`compras_remitos_detalle_${fechaArchivo()}.csv`, rowsToCsv(headers, rows));
  return { error: null };
}
