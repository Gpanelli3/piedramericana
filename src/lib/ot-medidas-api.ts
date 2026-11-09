import { supabase } from "@/lib/supabase";
import { sincronizarPlanCorteOt } from "@/lib/plan-corte-stock";
import type { ArticuloConPrecio } from "@/types/articulos";
import {
  articuloCalculoParaLinea,
  buildLineaCalcInput,
  computeLineaPresupuesto,
  computePresupuestoComercial,
  computePresupuestoTotalM2,
  parseDecimalInput,
  trioM2,
  trioM2DeOrden,
  type M2Trio,
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
  articuloCodigo: string;
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
  m2Venta: number;
  m2Obra: number;
  m2Dif: number;
  total: number;
  totalVenta: number;
  moneda: "ars" | "usd";
  nroVersion: number;
  ordenKey: string | null;
};

function parsePayload(raw: unknown): PresupuestoPayloadV1 | null {
  if (!isPresupuestoPayloadV1(raw)) return null;
  return hydratePresupuestoPayloadV1(raw);
}

/** Incluye inactivos: un presupuesto ya cotizado no puede perder el recálculo. */
async function fetchArticulosPorIds(ids: string[]): Promise<{
  data: ArticuloConPrecio[];
  error: Error | null;
}> {
  const unique = [...new Set(ids.filter((id) => id.trim().length > 0))];
  if (unique.length === 0) return { data: [], error: null };
  try {
    const { data, error } = await supabase
      .from("articulos")
      .select(
        "id, codigo, descripcion, unidad, calcula_material, medida_estandar_m2, prefer_modo_manual, sort_order",
      )
      .in("id", unique);
    if (error) return { data: [], error: new Error(error.message) };
    const mapped = (data ?? []).map((articulo) => ({
      ...articulo,
      precio: null,
    })) as ArticuloConPrecio[];
    return { data: mapped, error: null };
  } catch (error) {
    return {
      data: [],
      error: error instanceof Error ? error : new Error("No se pudieron cargar los artículos."),
    };
  }
}

function articuloIdsDePayload(payload: PresupuestoPayloadV1): string[] {
  return payload.ordenes.flatMap((ot) => ot.items.map((line) => line.articuloId));
}

function itemsDesdePayload(
  payload: PresupuestoPayloadV1,
  articulos: ArticuloConPrecio[],
  ordenKey: string | null,
): MedidaItemEditable[] {
  const byId = new Map(articulos.map((a) => [a.id, a]));
  const ordenesFuente =
    ordenKey ? (payload.ordenes ?? []).filter((o) => o.key === ordenKey) : (payload.ordenes ?? []);
  const items: MedidaItemEditable[] = [];
  for (const orden of ordenesFuente) {
    for (const line of orden.items ?? []) {
      const art = byId.get(line.articuloId);
      const artCalc = articuloCalculoParaLinea(art, line);
      const calc = buildLineaCalcInput(artCalc, line);
      const m2 = computeLineaPresupuesto(artCalc, calc).m2Linea;
      const unidad = art?.unidad ?? "M2";
      const modo = line.modoIngreso === "manual" ? "manual" : "dimensiones";
      const muestraAlto = unidad === "ML" || (unidad === "M2" && modo === "dimensiones");
      const muestraAncho = unidad === "M2" && modo === "dimensiones";
      items.push({
        itemKey: line.key,
        ordenKey: orden.key,
        ordenTitulo: (orden.titulo ?? "").trim() || "OT",
        articuloId: line.articuloId,
        articuloCodigo: art?.codigo?.trim() || "",
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
  return items;
}

async function fetchPayloadVentaPorPresupuestoIds(
  presupuestoIds: string[],
): Promise<{ data: Map<string, { payload: PresupuestoPayloadV1; total: number }>; error: Error | null }> {
  const unique = [...new Set(presupuestoIds.filter(Boolean))];
  const map = new Map<string, { payload: PresupuestoPayloadV1; total: number }>();
  if (unique.length === 0) return { data: map, error: null };
  const { data, error } = await supabase
    .from("presupuesto_versiones")
    .select("presupuesto_id,payload,total")
    .eq("nro", 1)
    .in("presupuesto_id", unique);
  if (error) return { data: map, error: new Error(error.message) };
  for (const row of data ?? []) {
    const parsed = parsePayload(row.payload);
    if (parsed) map.set(row.presupuesto_id, { payload: parsed, total: Number(row.total) || 0 });
  }
  return { data: map, error: null };
}

export type M2TrioPresupuesto = {
  total: M2Trio;
  porOrdenKey: Map<string, M2Trio>;
};

/** V1 (cotizado) vs payload vigente, una vez por presupuesto. */
export async function fetchM2TriosPorPresupuestos(
  fuentes: Array<{ id: string; payload: unknown }>,
): Promise<{ data: Map<string, M2TrioPresupuesto>; error: Error | null }> {
  const out = new Map<string, M2TrioPresupuesto>();
  if (fuentes.length === 0) return { data: out, error: null };

  const vigentes = new Map<string, PresupuestoPayloadV1>();
  for (const f of fuentes) {
    const parsed = parsePayload(f.payload);
    if (parsed) vigentes.set(f.id, parsed);
  }

  const v1Res = await fetchPayloadVentaPorPresupuestoIds([...vigentes.keys()]);
  if (v1Res.error) return { data: out, error: v1Res.error };

  const articuloIds = new Set<string>();
  for (const p of vigentes.values()) {
    for (const id of articuloIdsDePayload(p)) articuloIds.add(id);
  }
  for (const v of v1Res.data.values()) {
    for (const id of articuloIdsDePayload(v.payload)) articuloIds.add(id);
  }
  const arts = await fetchArticulosPorIds([...articuloIds]);
  if (arts.error) return { data: out, error: arts.error };
  const articulos = arts.data;

  for (const [presId, obra] of vigentes) {
    const venta = v1Res.data.get(presId)?.payload ?? obra;
    const porOrdenKey = new Map<string, M2Trio>();
    const keys = new Set([
      ...venta.ordenes.map((o) => o.key),
      ...obra.ordenes.map((o) => o.key),
    ]);
    for (const key of keys) {
      porOrdenKey.set(
        key,
        trioM2DeOrden({
          ordenKey: key,
          ordenesVenta: venta.ordenes,
          ordenesObra: obra.ordenes,
          articulos,
        }),
      );
    }
    out.set(presId, {
      total: trioM2(
        computePresupuestoTotalM2(venta.ordenes, articulos),
        computePresupuestoTotalM2(obra.ordenes, articulos),
      ),
      porOrdenKey,
    });
  }
  return { data: out, error: null };
}

export async function fetchMedidasOt(
  otId: string,
): Promise<{ data: MedidasOtData | null; error: Error | null }> {
  try {
    const otRes = await supabase
      .from("ordenes_trabajo")
      .select("id,venta_id,medidas_confirmadas,orden_key")
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
      .select("id,payload,total,moneda,nro_version")
      .eq("id", ventaRes.data.presupuesto_id)
      .maybeSingle();
    if (presRes.error) return { data: null, error: new Error(presRes.error.message) };
    if (!presRes.data) return { data: null, error: new Error("Presupuesto no encontrado.") };

    const payload = parsePayload(presRes.data.payload);
    if (!payload) {
      return { data: null, error: new Error("Payload de presupuesto inválido.") };
    }

    const arts = await fetchArticulosPorIds(articuloIdsDePayload(payload));
    if (arts.error) return { data: null, error: arts.error };
    const articulos = arts.data;

    const ordenKey = (otRes.data.orden_key ?? "").trim() || null;
    const items = itemsDesdePayload(payload, articulos, ordenKey);
    const ordenesFuente =
      ordenKey ? (payload.ordenes ?? []).filter((o) => o.key === ordenKey) : (payload.ordenes ?? []);
    const m2Calc = computePresupuestoTotalM2(ordenesFuente, articulos);
    const v1Res = await fetchPayloadVentaPorPresupuestoIds([ventaRes.data.presupuesto_id]);
    if (v1Res.error) return { data: null, error: v1Res.error };
    const payloadVenta = v1Res.data.get(ventaRes.data.presupuesto_id)?.payload ?? payload;
    const totalVenta = v1Res.data.get(ventaRes.data.presupuesto_id)?.total ?? (Number(presRes.data.total) || 0);
    const trio = trioM2DeOrden({
      ordenKey,
      ordenesVenta: payloadVenta.ordenes,
      ordenesObra: payload.ordenes,
      articulos,
    });

    return {
      data: {
        items,
        medidasConfirmadas: Boolean(otRes.data.medidas_confirmadas),
        notasMedicion: (ventaRes.data.notas_medicion ?? "").trim(),
        presupuestoId: ventaRes.data.presupuesto_id,
        ventaId: ventaRes.data.id,
        materialM2: m2Calc,
        m2Venta: trio.venta,
        m2Obra: trio.obra,
        m2Dif: trio.dif,
        total: Number(presRes.data.total) || 0,
        totalVenta,
        moneda: presRes.data.moneda === "usd" ? "usd" : "ars",
        nroVersion: presRes.data.nro_version ?? 1,
        ordenKey,
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

export async function fetchMedidasPresupuesto(
  presupuestoId: string,
): Promise<{ data: MedidasOtData | null; error: Error | null }> {
  try {
    const presRes = await supabase
      .from("presupuestos")
      .select("id,payload,total,moneda,nro_version")
      .eq("id", presupuestoId)
      .maybeSingle();
    if (presRes.error) return { data: null, error: new Error(presRes.error.message) };
    if (!presRes.data) return { data: null, error: new Error("Presupuesto no encontrado.") };

    const payload = parsePayload(presRes.data.payload);
    if (!payload) {
      return { data: null, error: new Error("Payload de presupuesto inválido.") };
    }

    const arts = await fetchArticulosPorIds(articuloIdsDePayload(payload));
    if (arts.error) return { data: null, error: arts.error };
    const articulos = arts.data;
    const items = itemsDesdePayload(payload, articulos, null);

    const ventaRes = await supabase
      .from("ventas")
      .select("id,notas_medicion")
      .eq("presupuesto_id", presupuestoId)
      .maybeSingle();
    if (ventaRes.error) return { data: null, error: new Error(ventaRes.error.message) };

    const medicionRes = await supabase
      .from("presupuesto_mediciones")
      .select("estado,notas")
      .eq("presupuesto_id", presupuestoId)
      .maybeSingle();
    if (medicionRes.error) return { data: null, error: new Error(medicionRes.error.message) };

    const m2Calc = computePresupuestoTotalM2(payload.ordenes, articulos);
    const v1Res = await fetchPayloadVentaPorPresupuestoIds([presupuestoId]);
    if (v1Res.error) return { data: null, error: v1Res.error };
    const payloadVenta = v1Res.data.get(presupuestoId)?.payload ?? payload;
    const totalVenta = v1Res.data.get(presupuestoId)?.total ?? (Number(presRes.data.total) || 0);
    const trio = trioM2(
      computePresupuestoTotalM2(payloadVenta.ordenes, articulos),
      m2Calc,
    );

    const notasVenta = (ventaRes.data?.notas_medicion ?? "").trim();
    const notasMedicion = (medicionRes.data?.notas ?? "").trim();

    return {
      data: {
        items,
        medidasConfirmadas: medicionRes.data?.estado === "medido",
        notasMedicion: notasMedicion || notasVenta,
        presupuestoId,
        ventaId: ventaRes.data?.id ?? "",
        materialM2: m2Calc,
        m2Venta: trio.venta,
        m2Obra: trio.obra,
        m2Dif: trio.dif,
        total: Number(presRes.data.total) || 0,
        totalVenta,
        moneda: presRes.data.moneda === "usd" ? "usd" : "ars",
        nroVersion: presRes.data.nro_version ?? 1,
        ordenKey: null,
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

export type GuardarMedidasOtResult = {
  error: Error | null;
  m2Anterior: number;
  m2Nuevo: number;
  totalAnterior: number;
  totalNuevo: number;
  nroVersion: number;
  moneda: "ars" | "usd";
  ventaId: string | null;
};

const EMPTY_GUARDAR: GuardarMedidasOtResult = {
  error: null,
  m2Anterior: 0,
  m2Nuevo: 0,
  totalAnterior: 0,
  totalNuevo: 0,
  nroVersion: 1,
  moneda: "ars",
  ventaId: null,
};

/**
 * Aplica medidas, versiona el presupuesto y recalcula el total.
 * `ordenKey` limita el parche a una OT; si es null, aplica a todo el presupuesto.
 */
export async function aplicarMedidasAPresupuesto(opts: {
  presupuestoId: string;
  items: MedidaItemPatch[];
  ordenKey?: string | null;
  notas?: string;
}): Promise<GuardarMedidasOtResult> {
  try {
    const presupuestoId = opts.presupuestoId;
    const presRes = await supabase
      .from("presupuestos")
      .select("id,payload,total,moneda,nro_version")
      .eq("id", presupuestoId)
      .maybeSingle();
    if (presRes.error) return { ...EMPTY_GUARDAR, error: new Error(presRes.error.message) };
    if (!presRes.data) return { ...EMPTY_GUARDAR, error: new Error("Presupuesto no encontrado.") };

    const payload = parsePayload(presRes.data.payload);
    if (!payload) return { ...EMPTY_GUARDAR, error: new Error("Payload de presupuesto inválido.") };

    const arts = await fetchArticulosPorIds(articuloIdsDePayload(payload));
    if (arts.error) return { ...EMPTY_GUARDAR, error: arts.error };
    const articulos = arts.data.map((a) => ({ ...a, precio: a.precio ?? 0 }));

    const moneda: "ars" | "usd" = presRes.data.moneda === "usd" ? "usd" : "ars";
    const nroActual = presRes.data.nro_version ?? 1;
    const totalAnterior = Number(presRes.data.total) || 0;
    const m2PresupuestoAnterior = computePresupuestoTotalM2(payload.ordenes, articulos);
    const ordenKey = (opts.ordenKey ?? "").trim() || null;

    const v1Res = await fetchPayloadVentaPorPresupuestoIds([presupuestoId]);
    if (v1Res.error) return { ...EMPTY_GUARDAR, error: v1Res.error };
    const payloadVenta = v1Res.data.get(presupuestoId)?.payload ?? payload;

    const snapExistente = await supabase
      .from("presupuesto_versiones")
      .select("id")
      .eq("presupuesto_id", presupuestoId)
      .eq("nro", nroActual)
      .maybeSingle();
    if (snapExistente.error) {
      return { ...EMPTY_GUARDAR, error: new Error(snapExistente.error.message) };
    }
    if (!snapExistente.data) {
      const snap = await supabase.from("presupuesto_versiones").insert({
        presupuesto_id: presupuestoId,
        nro: nroActual,
        total: totalAnterior,
        m2: m2PresupuestoAnterior,
        payload: payload as unknown as Json,
      });
      if (snap.error && snap.error.code !== "23505") {
        return { ...EMPTY_GUARDAR, error: new Error(snap.error.message) };
      }
    }

    const itemsPatch = ordenKey
      ? opts.items.filter((i) => i.ordenKey === ordenKey)
      : opts.items;
    const patchByKey = new Map(
      itemsPatch.map((i) => [`${i.ordenKey}::${i.itemKey}`, i] as const),
    );

    const ordenes = payload.ordenes.map((orden) => {
      if (ordenKey && orden.key !== ordenKey) return orden;
      return {
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
      };
    });

    const comercial = computePresupuestoComercial({
      ordenes,
      articulos,
      descuentoGlobalPct: payload.descuentoGlobalPct,
      mMedicionGlobal: payload.mMedicionGlobal,
      mEntregaGlobal: payload.mEntregaGlobal,
      mColocacionGlobal: payload.mColocacionGlobal,
      totalMecGlobal: payload.totalMecGlobal,
    });

    const trio = trioM2DeOrden({
      ordenKey,
      ordenesVenta: payloadVenta.ordenes,
      ordenesObra: ordenes,
      articulos,
    });

    const nroNuevo = nroActual + 1;
    const nextPayload: PresupuestoPayloadV1 = {
      ...payload,
      ordenes,
      materialM2Presupuesto: comercial.m2,
      totalPresupuesto: comercial.total,
    };

    const now = new Date().toISOString();
    const upPres = await supabase
      .from("presupuestos")
      .update({
        payload: nextPayload as unknown as Json,
        total: comercial.total,
        nro_version: nroNuevo,
        updated_at: now,
      })
      .eq("id", presupuestoId);
    if (upPres.error) return { ...EMPTY_GUARDAR, error: new Error(upPres.error.message) };

    const ventaRes = await supabase
      .from("ventas")
      .select("id")
      .eq("presupuesto_id", presupuestoId)
      .maybeSingle();
    if (ventaRes.error) return { ...EMPTY_GUARDAR, error: new Error(ventaRes.error.message) };

    const notas = opts.notas?.trim() ?? "";
    if (ventaRes.data?.id) {
      const upVenta = await supabase
        .from("ventas")
        .update({
          notas_medicion: notas || null,
          fecha_confirmacion_medidas: now,
          updated_at: now,
        })
        .eq("id", ventaRes.data.id);
      if (upVenta.error) return { ...EMPTY_GUARDAR, error: new Error(upVenta.error.message) };
    }

    return {
      error: null,
      m2Anterior: trio.venta,
      m2Nuevo: trio.obra,
      totalAnterior,
      totalNuevo: comercial.total,
      nroVersion: nroNuevo,
      moneda,
      ventaId: ventaRes.data?.id ?? null,
    };
  } catch (error) {
    return {
      ...EMPTY_GUARDAR,
      error: error instanceof Error ? error : new Error("No se pudieron guardar las medidas."),
    };
  }
}

export async function guardarMedidasPresupuesto(opts: {
  presupuestoId: string;
  items: MedidaItemPatch[];
  notas?: string;
}): Promise<GuardarMedidasOtResult> {
  const res = await aplicarMedidasAPresupuesto({
    presupuestoId: opts.presupuestoId,
    items: opts.items,
    ordenKey: null,
    notas: opts.notas,
  });
  if (res.error) return res;
  const ventaRes = await supabase
    .from("ventas")
    .select("id")
    .eq("presupuesto_id", opts.presupuestoId)
    .maybeSingle();
  if (ventaRes.data?.id) {
    const ots = await supabase
      .from("ordenes_trabajo")
      .select("id")
      .eq("venta_id", ventaRes.data.id)
      .neq("estado", "cancelled");
    for (const ot of ots.data ?? []) {
      const sync = await sincronizarPlanCorteOt({ otId: ot.id });
      if (sync.error) return { ...res, error: sync.error };
    }
  }
  return res;
}

/**
 * Persiste medidas editadas de una OT, versiona el presupuesto y marca la OT como confirmada.
 */
export async function guardarMedidasOt(opts: {
  otId: string;
  items: MedidaItemPatch[];
  notas?: string;
}): Promise<GuardarMedidasOtResult> {
  const otRes = await supabase
    .from("ordenes_trabajo")
    .select("id,venta_id,orden_key")
    .eq("id", opts.otId)
    .maybeSingle();
  if (otRes.error) return { ...EMPTY_GUARDAR, error: new Error(otRes.error.message) };
  if (!otRes.data?.venta_id) {
    return { ...EMPTY_GUARDAR, error: new Error("La OT no tiene venta asociada.") };
  }

  const ventaRes = await supabase
    .from("ventas")
    .select("id,presupuesto_id")
    .eq("id", otRes.data.venta_id)
    .maybeSingle();
  if (ventaRes.error) return { ...EMPTY_GUARDAR, error: new Error(ventaRes.error.message) };
  if (!ventaRes.data?.presupuesto_id) {
    return { ...EMPTY_GUARDAR, error: new Error("Venta sin presupuesto.") };
  }

  const res = await aplicarMedidasAPresupuesto({
    presupuestoId: ventaRes.data.presupuesto_id,
    items: opts.items,
    ordenKey: (otRes.data.orden_key ?? "").trim() || null,
    notas: opts.notas,
  });
  if (res.error) return res;

  const now = new Date().toISOString();
  const upOt = await supabase
    .from("ordenes_trabajo")
    .update({
      medidas_confirmadas: true,
      fecha_medidas_confirmadas: now,
      actualizado_en: now,
    })
    .eq("id", opts.otId);
  if (upOt.error) return { ...res, error: new Error(upOt.error.message) };
  const sync = await sincronizarPlanCorteOt({ otId: opts.otId });
  if (sync.error) return { ...res, error: sync.error };
  return res;
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
