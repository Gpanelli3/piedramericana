import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { slabRowToChapa, type ChapaRow, type OrigenPlaca } from "@/lib/stock-api";

export type RotuloPlacaDatos = {
  bulto: string;
  material: string;
  medidas: string;
  lote: string;
  origen: string;
  remito: string;
  fecha: string;
};

export function etiquetaOrigenPlaca(o: string | null | undefined): string {
  switch (o) {
    case "importado":
      return "Importado";
    case "cantera":
      return "Cantera";
    case "otro":
      return "Otro";
    case "nacional":
    default:
      return "Nacional";
  }
}

export function formatoMedidasPlaca(largoCm: number, anchoCm: number): string {
  const l = Number(largoCm);
  const a = Number(anchoCm);
  if (!(l > 0) || !(a > 0)) return "—";
  const fmt = (n: number) =>
    n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
  return `${fmt(l)} × ${fmt(a)} cm`;
}

export function armarRotuloPlaca(input: {
  bulto: string;
  material: string;
  largoCm: number;
  anchoCm: number;
  lote: string | null | undefined;
  origen: string | null | undefined;
  remitoNumero: string;
  fecha: string | null | undefined;
}): RotuloPlacaDatos {
  const fecha = (input.fecha ?? "").slice(0, 10);
  const [y, m, d] = fecha.split("-");
  const fechaTxt = y && m && d ? `${d}/${m}/${y}` : "—";
  return {
    bulto: input.bulto.trim() || "—",
    material: input.material.trim() || "—",
    medidas: formatoMedidasPlaca(input.largoCm, input.anchoCm),
    lote: input.lote?.trim() || "—",
    origen: etiquetaOrigenPlaca(input.origen),
    remito: input.remitoNumero.trim() || "—",
    fecha: fechaTxt,
  };
}

export type RotulosRemitoDatos = {
  remitoId: string;
  remitoNumero: string;
  proveedor: string;
  fecha: string;
  origen: string;
  placas: RotuloPlacaDatos[];
};

export async function fetchRotulosRemito(
  remitoId: string,
): Promise<{ data: RotulosRemitoDatos | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }
  const remitoRes = await supabase
    .from("remitos")
    .select("id,branch_code,serial_code,issue_date,origen_placa,suppliers ( name )")
    .eq("id", remitoId)
    .maybeSingle();
  if (remitoRes.error) return { data: null, error: new Error(remitoRes.error.message) };
  const remito = remitoRes.data;
  if (!remito) return { data: null, error: new Error("No se encontró el remito.") };

  const linesRes = await supabase
    .from("remito_lines")
    .select("id")
    .eq("remito_id", remitoId);
  if (linesRes.error) return { data: null, error: new Error(linesRes.error.message) };
  const lineIds = (linesRes.data ?? []).map((l) => l.id);
  if (lineIds.length === 0) {
    const sn = remito.suppliers as { name: string | null } | { name: string | null }[] | null;
    const proveedor = Array.isArray(sn) ? sn[0]?.name ?? "—" : sn?.name ?? "—";
    const nro = `${remito.branch_code}-${remito.serial_code}`;
    return {
      data: {
        remitoId,
        remitoNumero: nro,
        proveedor,
        fecha: remito.issue_date,
        origen: etiquetaOrigenPlaca(remito.origen_placa),
        placas: [],
      },
      error: null,
    };
  }

  const chapasRes = await supabase
    .from("chapas_inventario")
    .select(
      "id,bulto,material_id,material_label,largo_cm,ancho_cm,espesor_cm,estado,lote_codigo,ot_reserva_id,motivo_estado,origen_placa,chapa_origen_id",
    )
    .in("remito_line_id", lineIds)
    .order("bulto", { ascending: true });
  if (chapasRes.error) return { data: null, error: new Error(chapasRes.error.message) };

  const sn = remito.suppliers as { name: string | null } | { name: string | null }[] | null;
  const proveedor = Array.isArray(sn) ? sn[0]?.name ?? "—" : sn?.name ?? "—";
  const nro = `${remito.branch_code}-${remito.serial_code}`;
  const chapas: ChapaRow[] = (chapasRes.data ?? []).map((r) =>
    slabRowToChapa({
      id: r.id,
      bulto: r.bulto,
      material_label: r.material_label,
      material_id: r.material_id,
      largo_cm: Number(r.largo_cm),
      ancho_cm: Number(r.ancho_cm),
      espesor_cm: r.espesor_cm != null ? Number(r.espesor_cm) : null,
      estado: r.estado as ChapaRow["estado"],
      lote_codigo: r.lote_codigo,
      ot_reserva_id: r.ot_reserva_id,
      motivo_estado: r.motivo_estado,
      origen_placa: (r.origen_placa as OrigenPlaca | null) ?? null,
      chapa_origen_id: r.chapa_origen_id ?? null,
    }),
  );

  return {
    data: {
      remitoId,
      remitoNumero: nro,
      proveedor,
      fecha: remito.issue_date,
      origen: etiquetaOrigenPlaca(remito.origen_placa),
      placas: chapas.map((c) =>
        armarRotuloPlaca({
          bulto: c.bulto,
          material: c.material,
          largoCm: c.largoCm,
          anchoCm: c.anchoCm,
          lote: c.loteCodigo,
          origen: c.origenPlaca ?? remito.origen_placa,
          remitoNumero: nro,
          fecha: remito.issue_date,
        }),
      ),
    },
    error: null,
  };
}
