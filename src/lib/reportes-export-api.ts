import { supabase } from "@/lib/supabase";
import { downloadCsv, rowsToCsv } from "@/lib/export-csv";
import { listPresupuestosResumen } from "@/lib/presupuestos-api";
import { etiquetaEtapaOt } from "@/lib/etiquetas-ot";
import { fechaEnRango } from "@/lib/fecha-rango";
import { fetchRemitosList, fetchRemitoLines } from "@/lib/stock-api";

function fechaArchivo(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Exporta obras y cobros (ventas aprobadas) en CSV compatible con Excel. */
export async function exportVentasCsv(opts?: {
  desde?: string;
  hasta?: string;
}): Promise<{ error: Error | null }> {
  const { data, error } = await listPresupuestosResumen();
  if (error) return { error };
  const desde = opts?.desde ?? "";
  const hasta = opts?.hasta ?? "";
  const aprob = (data ?? []).filter(
    (r) => r.status === "aprobado" && fechaEnRango(r.created_at, desde, hasta),
  );

  const headers = [
    "Presupuesto",
    "Cliente / Arquitecto",
    "Etapa",
    "Total",
    "Moneda",
    "Cobrado",
    "Saldo",
    "Vendedor",
    "Fecha",
  ];
  const rows = aprob.map((r) => [
    r.numero,
    r.cliente,
    etiquetaEtapaOt(r.ot_etapa, r.ot_estado),
    r.total,
    r.moneda.toUpperCase(),
    r.total_pagado_misma_moneda ?? 0,
    r.saldo_misma_moneda ?? r.total,
    r.vendedor_nombre?.trim() || "",
    r.created_at.slice(0, 10),
  ]);

  downloadCsv(`obras_cobros_${fechaArchivo()}.csv`, rowsToCsv(headers, rows));
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
    "Origen",
    "Placas",
    "m² total",
    "Observaciones",
    "Registrado",
  ];
  const rows = remitos.map((r) => [
    r.issue_date,
    `${r.branch_code}-${r.serial_code}`,
    r.supplier_name ?? "",
    r.origen_placa ?? "nacional",
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
    "Origen",
    "Material",
    "Modo medidas",
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
      const modo = l.modo_medidas ?? "iguales";
      const m2 =
        l.m2_total != null && Number.isFinite(Number(l.m2_total))
          ? Number(l.m2_total)
          : l.largo_cm != null && l.ancho_cm != null
            ? (Number(l.largo_cm) / 100) * (Number(l.ancho_cm) / 100) * l.qty_slabs
            : 0;
      rows.push([
        r.issue_date,
        numero,
        r.supplier_name ?? "",
        l.origen_placa ?? r.origen_placa ?? "nacional",
        l.material_label,
        modo === "distintas" ? "distintas" : "iguales",
        l.qty_slabs,
        modo === "distintas" ? "variables" : (l.largo_cm ?? ""),
        modo === "distintas" ? "variables" : (l.ancho_cm ?? ""),
        m2.toFixed(3),
        l.precio_unitario ?? "",
        l.lote_codigo ?? "",
      ]);
    }
  }

  downloadCsv(`compras_remitos_detalle_${fechaArchivo()}.csv`, rowsToCsv(headers, rows));
  return { error: null };
}
