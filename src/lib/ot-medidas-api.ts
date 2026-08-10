import { supabase } from "@/lib/supabase";
import { fetchArticulos } from "@/lib/articulos-api";
import {
  articuloConPrecioToMock,
  buildLineaCalcInput,
  computeLineaPresupuesto,
  computePresupuestoTotalM2,
  parseDecimalInput,
} from "@/lib/presupuesto-calculos";
import type { Json } from "@/types/database";
import {
  hydratePresupuestoPayloadV1,
  isPresupuestoPayloadV1,
  type PresupuestoPayloadV1,
} from "@/types/presupuesto-payload";

export type MedidaItemEditable = {
  itemKey: string;
  ordenKey: string;
  ordenTitulo: string;
  articuloId: string;
  articuloLabel: string;
  unidad: string;
  modoIngreso: "dimensiones" | "manual";
  altoM: string;
  anchoM: string;
  cantidad: string;
  desperdicioPct: string;
  m2Approx: number;
  muestraAlto: boolean;
  muestraAncho: boolean;
};

export type MedidasOtData = {
  items: MedidaItemEditable[];
  medidasConfirmadas: boolean;
  notasMedicion: string;
  presupuestoId: string;
  ventaId: string;
  materialM2: number;
};

function parsePayload(raw: unknown): PresupuestoPayloadV1 | null {
  if (!isPresupuestoPayloadV1(raw)) return null;
  return hydratePresupuestoPayloadV1(raw);
}

export async function fetchMedidasOt(
  otId: string,
): Promise<{ data: MedidasOtData | null; error: Error | null }> {
  try {
    const otRes = await supabase
      .from("ordenes_trabajo")
      .select("id,venta_id,medidas_confirmadas")
      .eq("id", otId)
      .maybeSingle();
    if (otRes.error) return { data: null, error: new Error(otRes.error.message) };
    if (!otRes.data?.venta_id) {
      return { data: null, error: new Error("La OT no tiene venta asociada.") };
    }

    const ventaRes = await supabase
      .from("ventas")
      .select("id,presupuesto_id,notas_medicion")
      .eq("id", otRes.data.venta_id)
      .maybeSingle();
    if (ventaRes.error) return { data: null, error: new Error(ventaRes.error.message) };
    if (!ventaRes.data?.presupuesto_id) {
      return { data: null, error: new Error("Venta sin presupuesto.") };
    }

    const presRes = await supabase
      .from("presupuestos")
      .select("id,payload")
      .eq("id", ventaRes.data.presupuesto_id)
      .maybeSingle();
    if (presRes.error) return { data: null, error: new Error(presRes.error.message) };
    if (!presRes.data) return { data: null, error: new Error("Presupuesto no encontrado.") };

    const payload = parsePayload(presRes.data.payload);
    if (!payload) {
      return { data: null, error: new Error("Payload de presupuesto inválido.") };
    }

    const arts = await fetchArticulos();
    if (arts.error) return { data: null, error: arts.error };
    const articulos = arts.data ?? [];
    const byId = new Map(articulos.map((a) => [a.id, a]));

    const items: MedidaItemEditable[] = [];
    for (const orden of payload.ordenes ?? []) {
      for (const line of orden.items ?? []) {
        const art = byId.get(line.articuloId);
        const artCalc = art
          ? articuloConPrecioToMock(art)
          : {
              id: line.articuloId,
              codigo: "",
              descripcion: "Ítem",
              unidad: "M2" as const,
              calculaMaterial: true,
              precioUnitario: 0,
            };
        const calc = buildLineaCalcInput(artCalc, line);
        const m2 = computeLineaPresupuesto(artCalc, calc).m2Linea;
        const unidad = art?.unidad ?? "M2";
        const modo = line.modoIngreso === "manual" ? "manual" : "dimensiones";
        const muestraAlto =
          unidad === "ML" || (unidad === "M2" && modo === "dimensiones");
        const muestraAncho = unidad === "M2" && modo === "dimensiones";

        items.push({
          itemKey: line.key,
          ordenKey: orden.key,
          ordenTitulo: (orden.titulo ?? "").trim() || "OT",
          articuloId: line.articuloId,
          articuloLabel: art?.descripcion?.trim() || art?.codigo || "Artículo",
          unidad,
          modoIngreso: modo,
          altoM: line.altoM ?? "",
          anchoM: line.anchoM ?? "",
          cantidad: line.cantidad ?? "",
          desperdicioPct: line.desperdicioPct ?? "",
          m2Approx: m2,
          muestraAlto,
          muestraAncho,
        });
      }
    }

    const m2Calc =
      typeof payload.materialM2Presupuesto === "number"
        ? payload.materialM2Presupuesto
        : computePresupuestoTotalM2(payload.ordenes, articulos);

    return {
      data: {
        items,
        medidasConfirmadas: Boolean(otRes.data.medidas_confirmadas),
        notasMedicion: (ventaRes.data.notas_medicion ?? "").trim(),
        presupuestoId: ventaRes.data.presupuesto_id,
        ventaId: ventaRes.data.id,
        materialM2: m2Calc,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("No se pudieron cargar las medidas."),
    };
  }
}

export type MedidaItemPatch = {
  itemKey: string;
  ordenKey: string;
  altoM: string;
  anchoM: string;
  cantidad: string;
};

/**
 * Persiste medidas editadas en el payload del presupuesto, marca la OT como
 * medidas_confirmadas y guarda notas técnicas en la venta. No mueve etapas.
 */
export async function guardarMedidasOt(opts: {
  otId: string;
  items: MedidaItemPatch[];
  notas?: string;
}): Promise<{ error: Error | null; m2Anterior: number; m2Nuevo: number }> {
  const empty = { m2Anterior: 0, m2Nuevo: 0 };
  try {
    const otRes = await supabase
      .from("ordenes_trabajo")
      .select("id,venta_id")
      .eq("id", opts.otId)
      .maybeSingle();
    if (otRes.error) return { error: new Error(otRes.error.message), ...empty };
    if (!otRes.data?.venta_id) {
      return { error: new Error("La OT no tiene venta asociada."), ...empty };
    }

    const ventaRes = await supabase
      .from("ventas")
      .select("id,presupuesto_id")
      .eq("id", otRes.data.venta_id)
      .maybeSingle();
    if (ventaRes.error) return { error: new Error(ventaRes.error.message), ...empty };
    if (!ventaRes.data?.presupuesto_id) {
      return { error: new Error("Venta sin presupuesto."), ...empty };
    }

    const presRes = await supabase
      .from("presupuestos")
      .select("id,payload")
      .eq("id", ventaRes.data.presupuesto_id)
      .maybeSingle();
    if (presRes.error) return { error: new Error(presRes.error.message), ...empty };
    if (!presRes.data) return { error: new Error("Presupuesto no encontrado."), ...empty };

    const payload = parsePayload(presRes.data.payload);
    if (!payload) return { error: new Error("Payload de presupuesto inválido."), ...empty };

    const arts = await fetchArticulos();
    if (arts.error) return { error: arts.error, ...empty };
    const articulos = (arts.data ?? []).map((a) => ({ ...a, precio: a.precio ?? 0 }));

    const m2Anterior =
      typeof payload.materialM2Presupuesto === "number"
        ? payload.materialM2Presupuesto
        : computePresupuestoTotalM2(payload.ordenes, articulos);

    const patchByKey = new Map(
      opts.items.map((i) => [`${i.ordenKey}::${i.itemKey}`, i] as const),
    );

    const ordenes = payload.ordenes.map((orden) => ({
      ...orden,
      items: orden.items.map((line) => {
        const p = patchByKey.get(`${orden.key}::${line.key}`);
        if (!p) return line;
        return {
          ...line,
          altoM: p.altoM,
          anchoM: p.anchoM,
          cantidad: p.cantidad,
        };
      }),
    }));

    const m2Nuevo = computePresupuestoTotalM2(ordenes, articulos);
    const nextPayload: PresupuestoPayloadV1 = {
      ...payload,
      ordenes,
      materialM2Presupuesto: m2Nuevo,
    };

    const now = new Date().toISOString();
    const upPres = await supabase
      .from("presupuestos")
      .update({ payload: nextPayload as unknown as Json, updated_at: now })
      .eq("id", ventaRes.data.presupuesto_id);
    if (upPres.error) return { error: new Error(upPres.error.message), ...empty };

    const upOt = await supabase
      .from("ordenes_trabajo")
      .update({
        medidas_confirmadas: true,
        fecha_medidas_confirmadas: now,
        actualizado_en: now,
      })
      .eq("id", opts.otId);
    if (upOt.error) return { error: new Error(upOt.error.message), ...empty };

    const notas = opts.notas?.trim() ?? "";
    const upVenta = await supabase
      .from("ventas")
      .update({
        notas_medicion: notas || null,
        fecha_confirmacion_medidas: now,
        updated_at: now,
      })
      .eq("id", ventaRes.data.id);
    if (upVenta.error) return { error: new Error(upVenta.error.message), ...empty };

    return { error: null, m2Anterior, m2Nuevo };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("No se pudieron guardar las medidas."),
      ...empty,
    };
  }
}

/** Diferencia relativa de m² para avisar revisión comercial. */
export function m2CambioSignificativo(anterior: number, nuevo: number): boolean {
  if (!(anterior > 0) && !(nuevo > 0)) return false;
  const base = Math.max(anterior, nuevo, 0.01);
  return Math.abs(nuevo - anterior) / base >= 0.02 || Math.abs(nuevo - anterior) >= 0.05;
}

export function approxM2Linea(item: Pick<MedidaItemEditable, "altoM" | "anchoM" | "cantidad" | "unidad" | "modoIngreso" | "desperdicioPct">): number {
  const alto = parseDecimalInput(item.altoM);
  const ancho = parseDecimalInput(item.anchoM);
  const qty = parseDecimalInput(item.cantidad);
  const desp = 1 + Math.max(0, parseDecimalInput(item.desperdicioPct)) / 100;
  if (item.unidad === "M2" && item.modoIngreso === "manual") return Math.max(0, qty);
  if (item.unidad === "M2") {
    const piezas = item.cantidad.trim() === "" ? 1 : qty;
    if (piezas > 0 && alto > 0 && ancho > 0) return piezas * alto * ancho * desp;
    return 0;
  }
  if (item.unidad === "ML" && qty > 0 && alto > 0) return qty * alto * desp;
  return Math.max(0, qty);
}
