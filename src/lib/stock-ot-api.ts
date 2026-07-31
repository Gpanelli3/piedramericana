import type { Database, InventorySlabEstado } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type ChapaInventarioRow = Database["public"]["Tables"]["chapas_inventario"]["Row"];

export type RetazoInput = {
  largo_cm: number;
  ancho_cm: number;
};

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

/** Detecta si un set de chapas mezcla lotes distintos (regla entrevistas). */
export function lotesDistintosEnChapas(
  chapas: Pick<ChapaInventarioRow, "lote_codigo">[],
): string[] {
  const lotes = [
    ...new Set(
      chapas
        .map((c) => (c.lote_codigo ?? "").trim())
        .filter((l) => l.length > 0),
    ),
  ];
  return lotes;
}

export async function listChapasDisponibles(opts?: {
  materialNeedle?: string;
}): Promise<{ data: ChapaInventarioRow[]; error: Error | null }> {
  if (!isSupabaseConfigured) return { data: [], error: null };
  let q = supabase
    .from("chapas_inventario")
    .select("*")
    .eq("estado", "Disponible")
    .order("created_at", { ascending: true });
  if (opts?.materialNeedle?.trim()) {
    q = q.ilike("material_label", `%${opts.materialNeedle.trim()}%`);
  }
  const { data, error } = await q;
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as ChapaInventarioRow[], error: null };
}

export async function listChapasPorOt(
  otId: string,
  estados?: InventorySlabEstado[],
): Promise<{ data: ChapaInventarioRow[]; error: Error | null }> {
  if (!isSupabaseConfigured) return { data: [], error: null };
  let q = supabase.from("chapas_inventario").select("*").eq("ot_reserva_id", otId).order("bulto");
  if (estados?.length) q = q.in("estado", estados);
  const { data, error } = await q;
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as ChapaInventarioRow[], error: null };
}

export async function reservarChapasAOt(opts: {
  otId: string;
  chapaIds: string[];
  permitirMezclaLotes?: boolean;
  created_by?: string | null;
}): Promise<{ error: Error | null; warningMezclaLotes?: string }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no configurado.") };
  if (opts.chapaIds.length === 0) return { error: new Error("Elegí al menos una chapa.") };

  const { data: chapas, error: selErr } = await supabase
    .from("chapas_inventario")
    .select("*")
    .in("id", opts.chapaIds);
  if (selErr) return { error: new Error(selErr.message) };
  const rows = (chapas ?? []) as ChapaInventarioRow[];
  if (rows.length !== opts.chapaIds.length) {
    return { error: new Error("Alguna chapa ya no está disponible.") };
  }
  if (rows.some((c) => c.estado !== "Disponible")) {
    return { error: new Error("Solo se pueden reservar chapas en estado Disponible.") };
  }

  const { data: yaReservadas } = await supabase
    .from("chapas_inventario")
    .select("lote_codigo")
    .eq("ot_reserva_id", opts.otId)
    .eq("estado", "Reservada");

  const lotes = lotesDistintosEnChapas([
    ...((yaReservadas ?? []) as Pick<ChapaInventarioRow, "lote_codigo">[]),
    ...rows,
  ]);
  let warningMezclaLotes: string | undefined;
  if (lotes.length > 1) {
    warningMezclaLotes = `Esta OT mezclaría lotes distintos: ${lotes.join(", ")}. No se recomienda por veteado/color.`;
    if (!opts.permitirMezclaLotes) {
      return { error: new Error(warningMezclaLotes), warningMezclaLotes };
    }
  }

  const ts = nowIso();
  const { error: upErr } = await supabase
    .from("chapas_inventario")
    .update({
      estado: "Reservada" as InventorySlabEstado,
      ot_reserva_id: opts.otId,
      updated_at: ts,
    })
    .in("id", opts.chapaIds)
    .eq("estado", "Disponible");
  if (upErr) return { error: new Error(upErr.message) };

  for (const c of rows) {
    await logMovimiento({
      chapaId: c.id,
      otId: opts.otId,
      tipo: "reserva",
      detalle: `Reservada ${c.bulto}${c.lote_codigo ? ` · lote ${c.lote_codigo}` : ""}`,
      created_by: opts.created_by,
    });
  }

  await supabase
    .from("ordenes_trabajo")
    .update({ requiere_reserva_stock: false, actualizado_en: ts })
    .eq("id", opts.otId);

  return { error: null, warningMezclaLotes };
}

export async function liberarChapasDeOt(opts: {
  chapaIds: string[];
  otId: string;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no configurado.") };
  if (opts.chapaIds.length === 0) return { error: new Error("Elegí al menos una chapa.") };

  const ts = nowIso();
  const { data: rows, error: selErr } = await supabase
    .from("chapas_inventario")
    .select("id,bulto")
    .in("id", opts.chapaIds)
    .eq("ot_reserva_id", opts.otId)
    .eq("estado", "Reservada");
  if (selErr) return { error: new Error(selErr.message) };

  const { error: upErr } = await supabase
    .from("chapas_inventario")
    .update({
      estado: "Disponible" as InventorySlabEstado,
      ot_reserva_id: null,
      updated_at: ts,
    })
    .in(
      "id",
      (rows ?? []).map((r) => r.id),
    );
  if (upErr) return { error: new Error(upErr.message) };

  for (const c of rows ?? []) {
    await logMovimiento({
      chapaId: c.id,
      otId: opts.otId,
      tipo: "liberacion",
      detalle: `Liberada ${c.bulto}`,
      created_by: opts.created_by,
    });
  }
  return { error: null };
}

async function nextRetazoBulto(baseBulto: string, idx: number): Promise<string> {
  const candidate = `${baseBulto}-R${idx}`;
  const { data } = await supabase
    .from("chapas_inventario")
    .select("id")
    .eq("bulto", candidate)
    .maybeSingle();
  if (!data) return candidate;
  return nextRetazoBulto(baseBulto, idx + 1);
}

/**
 * Consume chapas reservadas (corte) y da de alta retazos medibles como Disponible.
 */
export async function consumirChapasConRetazos(opts: {
  otId: string;
  items: Array<{ chapaId: string; retazos: RetazoInput[] }>;
  created_by?: string | null;
}): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no configurado.") };
  if (opts.items.length === 0) return { error: new Error("No hay chapas para consumir.") };

  const ts = nowIso();

  for (const item of opts.items) {
    const { data: chapa, error: selErr } = await supabase
      .from("chapas_inventario")
      .select("*")
      .eq("id", item.chapaId)
      .maybeSingle();
    if (selErr) return { error: new Error(selErr.message) };
    const c = chapa as ChapaInventarioRow | null;
    if (!c) return { error: new Error("Chapa no encontrada.") };
    if (c.estado !== "Reservada" || c.ot_reserva_id !== opts.otId) {
      return { error: new Error(`La chapa ${c.bulto} no está reservada a esta OT.`) };
    }

    const { error: upErr } = await supabase
      .from("chapas_inventario")
      .update({
        estado: "Usada" as InventorySlabEstado,
        motivo_estado: "Consumida en corte",
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

    let rIdx = 1;
    for (const ret of item.retazos) {
      if (!Number.isFinite(ret.largo_cm) || !Number.isFinite(ret.ancho_cm)) continue;
      if (ret.largo_cm <= 0 || ret.ancho_cm <= 0) continue;
      const bulto = await nextRetazoBulto(c.bulto, rIdx);
      rIdx += 1;
      const { data: inserted, error: insErr } = await supabase
        .from("chapas_inventario")
        .insert({
          bulto,
          material_id: c.material_id,
          material_label: c.material_label,
          largo_cm: ret.largo_cm,
          ancho_cm: ret.ancho_cm,
          estado: "Disponible" as InventorySlabEstado,
          lote_codigo: c.lote_codigo,
          remito_line_id: c.remito_line_id,
          chapa_origen_id: c.id,
          origen_placa: c.origen_placa,
          motivo_estado: `Retazo de ${c.bulto}`,
        })
        .select("id")
        .single();
      if (insErr) return { error: new Error(insErr.message) };

      await logMovimiento({
        chapaId: inserted.id,
        otId: opts.otId,
        tipo: "retazo_alta",
        detalle: `Retazo ${bulto} ${ret.largo_cm}×${ret.ancho_cm} cm (origen ${c.bulto})`,
        created_by: opts.created_by,
      });

      // También dejar rastro en stock_scraps (compat con tab Recortes)
      await supabase.from("stock_scraps").insert({
        accion: "Reingresar",
        ingreso_tipo: "Recorte de corte",
        material_id: c.material_id,
        material_label: c.material_label,
        cantidad: 1,
        n_chapa: bulto,
        observacion: `${ret.largo_cm}×${ret.ancho_cm} cm · OT`,
        created_by: opts.created_by ?? null,
      });
    }
  }

  return { error: null };
}

/** Baja por rotura: estado Baja + pausa OT (la pausa la hace el caller). */
export async function bajaChapaPorRotura(opts: {
  chapaId: string;
  otId: string;
  motivo: string;
  observacion?: string;
  created_by?: string | null;
}): Promise<{ error: Error | null; bulto?: string }> {
  if (!isSupabaseConfigured) return { error: new Error("Supabase no configurado.") };

  const { data: chapa, error: selErr } = await supabase
    .from("chapas_inventario")
    .select("*")
    .eq("id", opts.chapaId)
    .maybeSingle();
  if (selErr) return { error: new Error(selErr.message) };
  const c = chapa as ChapaInventarioRow | null;
  if (!c) return { error: new Error("Chapa no encontrada.") };
  if (c.estado !== "Disponible" && c.estado !== "Reservada") {
    return { error: new Error("Solo se puede dar de baja una chapa Disponible o Reservada.") };
  }

  const detalle = [opts.motivo, opts.observacion?.trim()].filter(Boolean).join(" · ");
  const ts = nowIso();
  const { error: upErr } = await supabase
    .from("chapas_inventario")
    .update({
      estado: "Baja" as InventorySlabEstado,
      ot_reserva_id: opts.otId,
      motivo_estado: detalle || "Rotura",
      updated_at: ts,
    })
    .eq("id", c.id);
  if (upErr) return { error: new Error(upErr.message) };

  await logMovimiento({
    chapaId: c.id,
    otId: opts.otId,
    tipo: "baja",
    detalle: detalle || `Baja ${c.bulto}`,
    created_by: opts.created_by,
  });

  return { error: null, bulto: c.bulto };
}

export type SugerenciaReserva = {
  chapas: ChapaInventarioRow[];
  lotePreferido: string | null;
  materialNeedle: string | null;
};

/**
 * Sugiere chapas Disponibles del mismo material (y preferentemente un solo lote).
 * No reserva sola: el usuario confirma.
 */
export async function sugerirChapasParaOt(opts: {
  materialHint?: string;
  cantidad?: number;
}): Promise<{ data: SugerenciaReserva; error: Error | null }> {
  const needle =
    opts.materialHint && opts.materialHint !== "—"
      ? opts.materialHint.trim().split(/\s+/)[0] ?? null
      : null;
  const qty = Math.max(1, opts.cantidad ?? 1);

  const { data, error } = await listChapasDisponibles({
    materialNeedle: needle ?? undefined,
  });
  if (error) return { data: { chapas: [], lotePreferido: null, materialNeedle: needle }, error };

  let pool = data;
  if (pool.length === 0 && needle) {
    const all = await listChapasDisponibles();
    if (all.error) return { data: { chapas: [], lotePreferido: null, materialNeedle: needle }, error: all.error };
    pool = all.data;
  }

  // Preferir el lote con más chapas disponibles
  const porLote = new Map<string, ChapaInventarioRow[]>();
  for (const c of pool) {
    const key = (c.lote_codigo ?? "").trim() || "__sin_lote__";
    const arr = porLote.get(key) ?? [];
    arr.push(c);
    porLote.set(key, arr);
  }
  let bestKey = "__sin_lote__";
  let bestLen = -1;
  for (const [k, arr] of porLote) {
    if (arr.length > bestLen) {
      bestLen = arr.length;
      bestKey = k;
    }
  }
  const delLote = porLote.get(bestKey) ?? pool;
  const sugeridas = delLote.slice(0, qty);

  return {
    data: {
      chapas: sugeridas,
      lotePreferido: bestKey === "__sin_lote__" ? null : bestKey,
      materialNeedle: needle,
    },
    error: null,
  };
}

export type MovimientoStockRow = Database["public"]["Tables"]["stock_movimientos"]["Row"] & {
  chapa_bulto?: string | null;
  chapa_lote?: string | null;
  chapa_estado?: string | null;
};

export async function listTrazabilidadStockPorOt(
  otId: string,
): Promise<{ data: MovimientoStockRow[]; error: Error | null }> {
  if (!isSupabaseConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from("stock_movimientos")
    .select("*, chapas_inventario ( bulto, lote_codigo, estado )")
    .eq("ot_id", otId)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: new Error(error.message) };

  const rows = (data ?? []).map((m) => {
    const ch = (
      m as unknown as {
        chapas_inventario:
          | { bulto: string; lote_codigo: string | null; estado: string }
          | { bulto: string; lote_codigo: string | null; estado: string }[]
          | null;
      }
    ).chapas_inventario;
    const chapa = Array.isArray(ch) ? ch[0] : ch;
    const base = m as Database["public"]["Tables"]["stock_movimientos"]["Row"];
    return {
      ...base,
      chapa_bulto: chapa?.bulto ?? null,
      chapa_lote: chapa?.lote_codigo ?? null,
      chapa_estado: chapa?.estado ?? null,
    } satisfies MovimientoStockRow;
  });
  return { data: rows, error: null };
}

export type TrazabilidadObraRow = {
  ot_id: string;
  ot_titulo: string;
  cliente: string;
  presupuesto_numero: string | null;
  chapa_id: string;
  bulto: string;
  material_label: string;
  lote_codigo: string | null;
  origen_placa: string | null;
  estado: InventorySlabEstado;
  motivo_estado: string | null;
};

/** Consulta inversa: chapas vinculadas a OTs de un cliente (por nombre en presupuesto). */
export async function listTrazabilidadStockPorCliente(
  cliente: string,
): Promise<{ data: TrazabilidadObraRow[]; error: Error | null }> {
  if (!isSupabaseConfigured) return { data: [], error: null };
  const q = cliente.trim();
  if (!q) return { data: [], error: null };

  const { data: presupuestos, error: pErr } = await supabase
    .from("presupuestos")
    .select("id, numero, cliente")
    .ilike("cliente", `%${q}%`);
  if (pErr) return { data: [], error: new Error(pErr.message) };
  if (!presupuestos?.length) return { data: [], error: null };

  const presIds = presupuestos.map((p) => p.id);
  const { data: ventas, error: vErr } = await supabase
    .from("ventas")
    .select("id, presupuesto_id")
    .in("presupuesto_id", presIds);
  if (vErr) return { data: [], error: new Error(vErr.message) };
  if (!ventas?.length) return { data: [], error: null };

  const ventaIds = ventas.map((v) => v.id);
  const { data: ots, error: oErr } = await supabase
    .from("ordenes_trabajo")
    .select("id, titulo, venta_id")
    .in("venta_id", ventaIds);
  if (oErr) return { data: [], error: new Error(oErr.message) };
  if (!ots?.length) return { data: [], error: null };

  const otIds = ots.map((o) => o.id);
  const { data: chapas, error: cErr } = await supabase
    .from("chapas_inventario")
    .select("id, bulto, material_label, lote_codigo, origen_placa, estado, motivo_estado, ot_reserva_id")
    .in("ot_reserva_id", otIds)
    .in("estado", ["Reservada", "Usada", "Baja"]);
  if (cErr) return { data: [], error: new Error(cErr.message) };

  const presById = new Map(presupuestos.map((p) => [p.id, p]));
  const ventaById = new Map(ventas.map((v) => [v.id, v]));
  const otById = new Map(ots.map((o) => [o.id, o]));

  const rows: TrazabilidadObraRow[] = [];
  for (const c of chapas ?? []) {
    const ot = c.ot_reserva_id ? otById.get(c.ot_reserva_id) : undefined;
    if (!ot?.venta_id) continue;
    const venta = ventaById.get(ot.venta_id);
    const pres = venta ? presById.get(venta.presupuesto_id) : undefined;
    rows.push({
      ot_id: ot.id,
      ot_titulo: ot.titulo,
      cliente: pres?.cliente ?? q,
      presupuesto_numero: pres?.numero ?? null,
      chapa_id: c.id,
      bulto: c.bulto,
      material_label: c.material_label,
      lote_codigo: c.lote_codigo,
      origen_placa: c.origen_placa ?? null,
      estado: c.estado as InventorySlabEstado,
      motivo_estado: c.motivo_estado,
    });
  }

  return { data: rows, error: null };
}

export async function listChapasUsadasPorOt(
  otId: string,
): Promise<{ data: ChapaInventarioRow[]; error: Error | null }> {
  return listChapasPorOt(otId, ["Reservada", "Usada", "Baja"]);
}
