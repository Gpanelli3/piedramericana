import type { ArticuloConPrecio } from "@/types/articulos";
import type { Database, InventorySlabEstado, Json } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  chapaIdsDePlan,
  normalizePlanCorte,
  piezasDesdeOrden,
  planificarCorte,
  type PlanCorte,
  type PlanchaCandidata,
} from "@/lib/plan-corte";
import { esChapaRetazo } from "@/lib/stock-api";
import {
  liberarChapasDeOt,
  listChapasPorOt,
  nextRetazoBulto,
  reservarChapasAOt,
  type ChapaInventarioRow,
} from "@/lib/stock-ot-api";
import {
  hydratePresupuestoPayloadV1,
  isPresupuestoPayloadV1,
} from "@/types/presupuesto-payload";

function nowIso() {
  return new Date().toISOString();
}

async function logMovimiento(opts: {
  chapaId: string | null;
  otId: string | null;
  tipo: Database["public"]["Tables"]["stock_movimientos"]["Insert"]["tipo"];
  detalle?: string;
  created_by?: string | null;
}) {
  const { error } = await supabase.from("stock_movimientos").insert({
    chapa_id: opts.chapaId,
    ot_id: opts.otId,
    tipo: opts.tipo,
    detalle: opts.detalle ?? null,
    created_by: opts.created_by ?? null,
  });
  if (error) throw new Error(error.message);
}

function rowToCandidata(c: ChapaInventarioRow): PlanchaCandidata {
  return {
    id: c.id,
    bulto: c.bulto,
    largoCm: Number(c.largo_cm),
    anchoCm: Number(c.ancho_cm),
    loteCodigo: c.lote_codigo,
    esRetazo: esChapaRetazo({
      chapaOrigenId: c.chapa_origen_id,
      motivoEstado: c.motivo_estado,
    }),
    espesorCm: c.espesor_cm != null ? Number(c.espesor_cm) : null,
  };
}

export async function listChapasCandidatasPlan(opts: {
  materialId?: string | null;
  materialLabel?: string | null;
  otId?: string | null;
}): Promise<{ data: ChapaInventarioRow[]; error: Error | null }> {
  if (!isSupabaseConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from("chapas_inventario")
    .select("*")
    .in("estado", ["Disponible", "Reservada"])
    .order("created_at", { ascending: true });
  if (error) return { data: [], error: new Error(error.message) };
  const materialId = opts.materialId?.trim() ?? "";
  const label = (opts.materialLabel ?? "").trim().toLowerCase();
  const rows = ((data ?? []) as ChapaInventarioRow[]).filter((c) => {
    if (c.estado === "Reservada" && opts.otId && c.ot_reserva_id === opts.otId) {
      // keep, still filter material below
    } else if (c.estado !== "Disponible") {
      return false;
    }
    if (materialId && c.material_id === materialId) return true;
    if (label && (c.material_label ?? "").toLowerCase().includes(label)) return true;
    if (!materialId && !label) return true;
    return false;
  });
  return { data: rows, error: null };
}

export async function borrarSobrantesPrevistosDeOt(opts: {
  otId: string;
  chapaIds?: string[];
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: null };
  let q = supabase
    .from("chapas_inventario")
    .select("id")
    .eq("estado", "Prevista")
    .eq("ot_reserva_id", opts.otId);
  if (opts.chapaIds?.length) q = q.in("chapa_origen_id", opts.chapaIds);
  const { data, error } = await q;
  if (error) return { error: new Error(error.message) };
  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) return { error: null };
  const del = await supabase.from("chapas_inventario").delete().in("id", ids);
  if (del.error) return { error: new Error(del.error.message) };
  return { error: null };
}

export async function crearSobrantesPrevistosDePlan(opts: {
  otId: string;
  plan: PlanCorte;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no configurado.") };
  const wipe = await borrarSobrantesPrevistosDeOt({ otId: opts.otId });
  if (wipe.error) return wipe;

  const origenIds = opts.plan.planchas.map((p) => p.chapaId);
  if (origenIds.length === 0) return { error: null };
  const { data: origenes, error: selErr } = await supabase
    .from("chapas_inventario")
    .select("*")
    .in("id", origenIds);
  if (selErr) return { error: new Error(selErr.message) };
  const byId = new Map(((origenes ?? []) as ChapaInventarioRow[]).map((c) => [c.id, c]));

  for (const plancha of opts.plan.planchas) {
    const origen = byId.get(plancha.chapaId);
    if (!origen) continue;
    let rIdx = 1;
    for (const sob of plancha.sobrantes) {
      if (!(sob.largoCm > 0) || !(sob.anchoCm > 0)) continue;
      const bulto = await nextRetazoBulto(origen.bulto, rIdx);
      rIdx += 1;
      const { data: inserted, error: insErr } = await supabase
        .from("chapas_inventario")
        .insert({
          bulto,
          material_id: origen.material_id,
          material_label: origen.material_label,
          largo_cm: sob.largoCm,
          ancho_cm: sob.anchoCm,
          espesor_cm: origen.espesor_cm,
          estado: "Prevista" as InventorySlabEstado,
          lote_codigo: origen.lote_codigo,
          remito_line_id: origen.remito_line_id,
          chapa_origen_id: origen.id,
          origen_placa: origen.origen_placa,
          precio_m2: origen.precio_m2,
          ot_reserva_id: opts.otId,
          motivo_estado: `Sobrante previsto de ${origen.bulto}`,
        })
        .select("id")
        .single();
      if (insErr) return { error: new Error(insErr.message) };
      await logMovimiento({
        chapaId: inserted.id,
        otId: opts.otId,
        tipo: "retazo_alta",
        detalle: `Sobrante previsto ${bulto} ${sob.largoCm}×${sob.anchoCm} cm (origen ${origen.bulto})`,
        created_by: opts.created_by,
      });
    }
  }
  return { error: null };
}

export async function aplicarPlanEnSenia(opts: {
  otId: string;
  plan: PlanCorte | null;
  chapaFallbackId?: string | null;
  created_by?: string | null;
}): Promise<{ error: Error | null; pendientes: boolean }> {
  const ids = chapaIdsDePlan(opts.plan);
  const chapaIds = ids.length > 0 ? ids : opts.chapaFallbackId ? [opts.chapaFallbackId] : [];
  if (chapaIds.length === 0) return { error: null, pendientes: false };

  const { data: actuales } = await supabase
    .from("chapas_inventario")
    .select("id,estado,ot_reserva_id")
    .in("id", chapaIds);
  const yaOk = (actuales ?? []).filter(
    (c) => c.estado === "Reservada" && c.ot_reserva_id === opts.otId,
  );
  const porReservar = chapaIds.filter((id) => !yaOk.some((c) => c.id === id));
  if (porReservar.length > 0) {
    const res = await reservarChapasAOt({
      otId: opts.otId,
      chapaIds: porReservar,
      permitirMezclaLotes: true,
      created_by: opts.created_by ?? null,
    });
    if (res.error) return { error: res.error, pendientes: true };
  }

  if (opts.plan) {
    const previstos = await crearSobrantesPrevistosDePlan({
      otId: opts.otId,
      plan: opts.plan,
      created_by: opts.created_by,
    });
    if (previstos.error) return { error: previstos.error, pendientes: false };
    await supabase
      .from("ordenes_trabajo")
      .update({ plan_corte: opts.plan as unknown as Json, actualizado_en: nowIso() })
      .eq("id", opts.otId);
  }
  return { error: null, pendientes: false };
}

export async function confirmarCorteDeOt(opts: {
  otId: string;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: null };
  const otRes = await supabase
    .from("ordenes_trabajo")
    .select("id,plan_corte")
    .eq("id", opts.otId)
    .maybeSingle();
  if (otRes.error) return { error: new Error(otRes.error.message) };
  const plan =
    normalizePlanCorte(otRes.data?.plan_corte) ??
    (await planDesdePayloadOt(opts.otId));
  if (!plan || plan.planchas.length === 0) return { error: null };

  const ts = nowIso();
  const chapaIds = chapaIdsDePlan(plan);
  const { data: chapas, error: selErr } = await supabase
    .from("chapas_inventario")
    .select("*")
    .in("id", chapaIds);
  if (selErr) return { error: new Error(selErr.message) };

  for (const raw of chapas ?? []) {
    const c = raw as ChapaInventarioRow;
    if (c.estado !== "Reservada" && c.estado !== "Disponible") continue;
    const { error: upErr } = await supabase
      .from("chapas_inventario")
      .update({
        estado: "Usada" as InventorySlabEstado,
        motivo_estado: "Consumida en corte",
        ot_reserva_id: opts.otId,
        updated_at: ts,
      })
      .eq("id", c.id);
    if (upErr) return { error: new Error(upErr.message) };
    await logMovimiento({
      chapaId: c.id,
      otId: opts.otId,
      tipo: "consumo",
      detalle: `Consumida ${c.bulto}`,
      created_by: opts.created_by,
    });
  }

  const { data: previstos, error: pErr } = await supabase
    .from("chapas_inventario")
    .select("*")
    .eq("estado", "Prevista")
    .eq("ot_reserva_id", opts.otId);
  if (pErr) return { error: new Error(pErr.message) };

  if ((previstos ?? []).length > 0) {
    for (const raw of previstos ?? []) {
      const c = raw as ChapaInventarioRow;
      const { error: upErr } = await supabase
        .from("chapas_inventario")
        .update({
          estado: "Disponible" as InventorySlabEstado,
          ot_reserva_id: null,
          motivo_estado: `Retazo de corte · ${c.bulto}`,
          updated_at: ts,
        })
        .eq("id", c.id);
      if (upErr) return { error: new Error(upErr.message) };
      await logMovimiento({
        chapaId: c.id,
        otId: opts.otId,
        tipo: "retazo_alta",
        detalle: `Retazo disponible ${c.bulto} ${c.largo_cm}×${c.ancho_cm} cm`,
        created_by: opts.created_by,
      });
      await supabase.from("stock_scraps").insert({
        accion: "Reingresar",
        ingreso_tipo: "Recorte de corte",
        material_id: c.material_id,
        material_label: c.material_label,
        cantidad: 1,
        n_chapa: c.bulto,
        observacion: `${c.largo_cm}×${c.ancho_cm} cm · OT`,
        created_by: opts.created_by ?? null,
      });
    }
    return { error: null };
  }

  for (const plancha of plan.planchas) {
    const origen = ((chapas ?? []) as ChapaInventarioRow[]).find((c) => c.id === plancha.chapaId);
    if (!origen) continue;
    let rIdx = 1;
    for (const sob of plancha.sobrantes) {
      if (!(sob.largoCm > 0) || !(sob.anchoCm > 0)) continue;
      const bulto = await nextRetazoBulto(origen.bulto, rIdx);
      rIdx += 1;
      const { data: inserted, error: insErr } = await supabase
        .from("chapas_inventario")
        .insert({
          bulto,
          material_id: origen.material_id,
          material_label: origen.material_label,
          largo_cm: sob.largoCm,
          ancho_cm: sob.anchoCm,
          espesor_cm: origen.espesor_cm,
          estado: "Disponible" as InventorySlabEstado,
          lote_codigo: origen.lote_codigo,
          remito_line_id: origen.remito_line_id,
          chapa_origen_id: origen.id,
          origen_placa: origen.origen_placa,
          precio_m2: origen.precio_m2,
          motivo_estado: `Retazo de ${origen.bulto}`,
        })
        .select("id")
        .single();
      if (insErr) return { error: new Error(insErr.message) };
      await logMovimiento({
        chapaId: inserted.id,
        otId: opts.otId,
        tipo: "retazo_alta",
        detalle: `Retazo ${bulto} ${sob.largoCm}×${sob.anchoCm} cm (origen ${origen.bulto})`,
        created_by: opts.created_by,
      });
      await supabase.from("stock_scraps").insert({
        accion: "Reingresar",
        ingreso_tipo: "Recorte de corte",
        material_id: origen.material_id,
        material_label: origen.material_label,
        cantidad: 1,
        n_chapa: bulto,
        observacion: `${sob.largoCm}×${sob.anchoCm} cm · OT`,
        created_by: opts.created_by ?? null,
      });
    }
  }
  return { error: null };
}

async function planDesdePayloadOt(otId: string): Promise<PlanCorte | null> {
  const otRes = await supabase
    .from("ordenes_trabajo")
    .select("orden_key,venta_id")
    .eq("id", otId)
    .maybeSingle();
  if (otRes.error || !otRes.data?.venta_id) return null;
  const venta = await supabase
    .from("ventas")
    .select("presupuesto_id")
    .eq("id", otRes.data.venta_id)
    .maybeSingle();
  if (venta.error || !venta.data?.presupuesto_id) return null;
  const pres = await supabase
    .from("presupuestos")
    .select("payload")
    .eq("id", venta.data.presupuesto_id)
    .maybeSingle();
  if (pres.error || !pres.data?.payload) return null;
  if (!isPresupuestoPayloadV1(pres.data.payload)) return null;
  const payload = hydratePresupuestoPayloadV1(pres.data.payload);
  const key = (otRes.data.orden_key ?? "").trim();
  const ot = (key ? payload.ordenes.find((o) => o.key === key) : null) ?? payload.ordenes[0];
  return normalizePlanCorte(ot?.planCorte) ;
}

async function fetchArticulosPorIds(ids: string[]): Promise<ArticuloConPrecio[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("articulos")
    .select(
      "id, codigo, descripcion, unidad, calcula_material, medida_estandar_m2, prefer_modo_manual, sort_order",
    )
    .in("id", unique);
  if (error) return [];
  return (data ?? []).map((articulo) => ({
    ...articulo,
    precio: null,
    moneda: "ars" as const,
  })) as ArticuloConPrecio[];
}

export async function sincronizarPlanCorteOt(opts: {
  otId: string;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: null };
  const otRes = await supabase
    .from("ordenes_trabajo")
    .select("id,orden_key,venta_id,plan_corte")
    .eq("id", opts.otId)
    .maybeSingle();
  if (otRes.error) return { error: new Error(otRes.error.message) };
  if (!otRes.data?.venta_id) return { error: null };

  const venta = await supabase
    .from("ventas")
    .select("presupuesto_id")
    .eq("id", otRes.data.venta_id)
    .maybeSingle();
  if (venta.error || !venta.data?.presupuesto_id) return { error: null };
  const pres = await supabase
    .from("presupuestos")
    .select("payload")
    .eq("id", venta.data.presupuesto_id)
    .maybeSingle();
  if (pres.error || !pres.data?.payload || !isPresupuestoPayloadV1(pres.data.payload)) {
    return { error: pres.error ? new Error(pres.error.message) : null };
  }
  const payload = hydratePresupuestoPayloadV1(pres.data.payload);
  const key = (otRes.data.orden_key ?? "").trim();
  const otWizard =
    (key ? payload.ordenes.find((o) => o.key === key) : null) ?? payload.ordenes[0];
  if (!otWizard || otWizard.piedraDelCliente) return { error: null };

  const articuloIds = otWizard.items.map((i) => i.articuloId);
  const articulos = await fetchArticulosPorIds(articuloIds);
  const piezas = piezasDesdeOrden(otWizard, articulos);
  if (piezas.length === 0) {
    await borrarSobrantesPrevistosDeOt({ otId: opts.otId });
    return { error: null };
  }

  const materialLabel =
    otWizard.chapaSugeridaLabel?.trim() ||
    otWizard.planCorte?.materialLabel ||
    "";
  const candidatas = await listChapasCandidatasPlan({
    materialId: otWizard.materialId,
    materialLabel,
    otId: opts.otId,
  });
  if (candidatas.error) return candidatas;

  const plan = planificarCorte({
    piezas,
    planchas: candidatas.data.map(rowToCandidata),
    materialId: otWizard.materialId || null,
    materialLabel,
    confirmado: true,
  });
  plan.confirmado = plan.planchas.length > 0;

  const prevIds = new Set(
    (await listChapasPorOt(opts.otId, ["Reservada"])).data.map((c) => c.id),
  );
  const nextIds = new Set(chapaIdsDePlan(plan));
  const soltar = [...prevIds].filter((id) => !nextIds.has(id));
  const tomar = [...nextIds].filter((id) => !prevIds.has(id));

  if (soltar.length > 0) {
    await borrarSobrantesPrevistosDeOt({ otId: opts.otId, chapaIds: soltar });
    const lib = await liberarChapasDeOt({
      chapaIds: soltar,
      otId: opts.otId,
      created_by: opts.created_by ?? null,
    });
    if (lib.error) return lib;
  }
  if (tomar.length > 0) {
    const res = await reservarChapasAOt({
      otId: opts.otId,
      chapaIds: tomar,
      permitirMezclaLotes: true,
      created_by: opts.created_by ?? null,
    });
    if (res.error) return res;
  }

  const previstos = await crearSobrantesPrevistosDePlan({
    otId: opts.otId,
    plan,
    created_by: opts.created_by,
  });
  if (previstos.error) return previstos;

  const ordenes = payload.ordenes.map((o) =>
    o.key === otWizard.key ? { ...o, planCorte: plan, chapaSugeridaId: plan.planchas[0]?.chapaId ?? o.chapaSugeridaId } : o,
  );
  await supabase
    .from("presupuestos")
    .update({ payload: { ...payload, ordenes } as unknown as Json })
    .eq("id", venta.data.presupuesto_id);
  await supabase
    .from("ordenes_trabajo")
    .update({ plan_corte: plan as unknown as Json, actualizado_en: nowIso() })
    .eq("id", opts.otId);

  return { error: null };
}

export async function invalidarSobrantesPorRotura(opts: {
  otId: string;
  chapaId: string;
}): Promise<{ error: Error | null }> {
  return borrarSobrantesPrevistosDeOt({ otId: opts.otId, chapaIds: [opts.chapaId] });
}

export async function fetchPlanCortePorOtIds(
  ids: string[],
): Promise<Map<string, PlanCorte>> {
  const map = new Map<string, PlanCorte>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!isSupabaseConfigured || unique.length === 0) return map;
  const { data, error } = await supabase
    .from("ordenes_trabajo")
    .select("id,plan_corte")
    .in("id", unique);
  if (error) return map;
  for (const row of data ?? []) {
    const plan = normalizePlanCorte(row.plan_corte);
    if (plan) map.set(row.id, plan);
  }
  return map;
}
