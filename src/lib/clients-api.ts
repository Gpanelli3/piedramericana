import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { mergeVentasResumenIntoPresupuestos } from "@/lib/ventas-api";
import type { Database, JobStatus, PresupuestoEstado, VentaEstado } from "@/types/database";
import type { ProduccionOtFiltro } from "@/types/workspace";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
export type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

/** Vista usada por el wizard de presupuesto y el módulo Clientes. */
export type ClientePresupuesto = {
  id: string;
  nombre: string;
  contacto: string;
  tel: string;
  email: string;
  direccion: string;
  notes: string;
  esAgenteRetencion: boolean;
  retencionPorcentaje: number | null;
};

export type ClienteInput = {
  nombre: string;
  contacto?: string;
  tel?: string;
  email?: string;
  direccion?: string;
  notes?: string;
  esAgenteRetencion?: boolean;
  retencionPorcentaje?: number | null;
};

function parsePorcentaje(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function clientRowToClientePresupuesto(row: ClientRow): ClientePresupuesto {
  const esAgente = Boolean(row.es_agente_retencion);
  const pct = parsePorcentaje(row.retencion_porcentaje);
  return {
    id: row.id,
    nombre: row.name,
    contacto: row.contact_name?.trim() || row.name,
    tel: row.phone ?? "",
    email: row.email ?? "",
    direccion: row.address ?? "",
    notes: row.notes ?? "",
    esAgenteRetencion: esAgente,
    retencionPorcentaje: esAgente ? pct : null,
  };
}

function toInsertPayload(input: ClienteInput): ClientInsert | { error: string } {
  const name = input.nombre.trim();
  if (!name) {
    return { error: "El nombre del cliente es obligatorio" };
  }
  const esAgente = Boolean(input.esAgenteRetencion);
  const pct = esAgente ? parsePorcentaje(input.retencionPorcentaje) : null;
  if (esAgente && (pct == null || pct < 0 || pct > 100)) {
    return { error: "Indicá el porcentaje de retención (entre 0 y 100)" };
  }

  return {
    name,
    contact_name: input.contacto?.trim() || null,
    phone: input.tel?.trim() || null,
    email: input.email?.trim() || null,
    address: input.direccion?.trim() || null,
    notes: input.notes?.trim() || null,
    es_agente_retencion: esAgente,
    retencion_porcentaje: pct,
  };
}

export async function listClients(): Promise<{
  data: ClientePresupuesto[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error("Supabase no está configurado") };
  }

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  return {
    data: (data ?? []).map((row) => clientRowToClientePresupuesto(row as ClientRow)),
    error: null,
  };
}

export async function createClient(
  input: ClienteInput,
): Promise<{ data: ClientePresupuesto | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }

  const payload = toInsertPayload(input);
  if ("error" in payload) {
    return { data: null, error: new Error(payload.error) };
  }

  const { data, error } = await supabase
    .from("clients")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return {
    data: clientRowToClientePresupuesto(data as ClientRow),
    error: null,
  };
}

export async function updateClient(
  id: string,
  input: ClienteInput,
): Promise<{ data: ClientePresupuesto | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }

  const payload = toInsertPayload(input);
  if ("error" in payload) {
    return { data: null, error: new Error(payload.error) };
  }

  const update: ClientUpdate = {
    name: payload.name,
    contact_name: payload.contact_name,
    phone: payload.phone,
    email: payload.email,
    address: payload.address,
    notes: payload.notes,
    es_agente_retencion: payload.es_agente_retencion,
    retencion_porcentaje: payload.retencion_porcentaje,
  };

  const { data, error } = await supabase
    .from("clients")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return {
    data: clientRowToClientePresupuesto(data as ClientRow),
    error: null,
  };
}

export async function getClientById(id: string): Promise<{
  data: ClientePresupuesto | null;
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error("Supabase no está configurado") };
  }
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };
  return { data: clientRowToClientePresupuesto(data as ClientRow), error: null };
}

type PresupuestoFichaRow = {
  id: string;
  numero: string;
  cliente: string;
  client_id: string | null;
  total: number;
  moneda: "ars" | "usd";
  status: PresupuestoEstado;
  created_at: string;
};

type OrdenFichaRow = Database["public"]["Tables"]["ordenes_trabajo"]["Row"];

export type ClienteFichaPresupuesto = {
  id: string;
  numero: string;
  status: PresupuestoEstado;
  total: number;
  moneda: "ars" | "usd";
  created_at: string;
};

export type ClienteFichaVenta = {
  id: string;
  presupuestoId: string;
  numero: string;
  estado: VentaEstado;
  total: number;
  moneda: "ars" | "usd";
  cobrado: number;
  saldo: number;
  created_at: string;
};

export type ClienteFichaOt = {
  id: string;
  titulo: string;
  etapa: string;
  estado: JobStatus;
  bloqueada: boolean;
  pausada: boolean;
  fecha_programada: string | null;
  presupuestoId: string | null;
  presupuestoNumero: string;
  ventaId: string | null;
  tabProduccion: ProduccionOtFiltro;
  enMedicion: boolean;
};

export type ClienteFichaMovimiento = {
  id: string;
  fecha: string;
  presupuestoId: string;
  numero: string;
  tipo: "cargo" | "pago";
  detalle: string;
  metodo: string | null;
  nota: string | null;
  moneda: "ars" | "usd";
  debe: number;
  haber: number;
  saldo: number;
};

export type ClienteFichaData = {
  presupuestos: ClienteFichaPresupuesto[];
  ventas: ClienteFichaVenta[];
  ots: ClienteFichaOt[];
  movimientos: ClienteFichaMovimiento[];
  saldoArs: number;
  saldoUsd: number;
  cobradoArs: number;
  cobradoUsd: number;
  otsAbiertas: number;
};

export function tabProduccionDesdeOt(ot: {
  estado: JobStatus | string;
  etapa: string;
  bloqueada: boolean;
  pausada: boolean;
}): ProduccionOtFiltro {
  if (ot.estado === "done") return "entregadas";
  if (ot.bloqueada || ot.pausada) return "venta_retenida";
  if (ot.etapa === "corte") return "corte";
  if (ot.etapa === "produccion") return "produccion";
  if (ot.etapa === "despacho") return "logistica";
  return "general";
}

function emptyFicha(): ClienteFichaData {
  return {
    presupuestos: [],
    ventas: [],
    ots: [],
    movimientos: [],
    saldoArs: 0,
    saldoUsd: 0,
    cobradoArs: 0,
    cobradoUsd: 0,
    otsAbiertas: 0,
  };
}

function montoPagoNum(raw: unknown): number {
  const val = typeof raw === "string" ? parseFloat(raw) : Number(raw ?? 0);
  return Number.isFinite(val) ? val : 0;
}

function armarCuentaCorriente(opts: {
  cargos: Array<{
    id: string;
    fecha: string;
    presupuestoId: string;
    numero: string;
    moneda: "ars" | "usd";
    total: number;
  }>;
  pagos: Array<{
    id: string;
    fecha: string;
    created_at: string;
    ventaId: string;
    presupuestoId: string;
    numero: string;
    moneda: "ars" | "usd";
    monto: number;
    metodo: string | null;
    nota: string | null;
  }>;
}): ClienteFichaMovimiento[] {
  const items: Array<ClienteFichaMovimiento & { sortKey: string }> = [];
  for (const c of opts.cargos) {
    const fecha = c.fecha.slice(0, 10);
    items.push({
      id: `cargo-${c.id}`,
      fecha,
      presupuestoId: c.presupuestoId,
      numero: c.numero,
      tipo: "cargo",
      detalle: `Cargo ${c.numero}`,
      metodo: null,
      nota: null,
      moneda: c.moneda,
      debe: c.total,
      haber: 0,
      saldo: 0,
      sortKey: `${fecha}T0-${c.id}`,
    });
  }
  for (const p of opts.pagos) {
    const fecha = p.fecha.slice(0, 10);
    items.push({
      id: p.id,
      fecha,
      presupuestoId: p.presupuestoId,
      numero: p.numero,
      tipo: "pago",
      detalle: p.nota?.trim() ? p.nota.trim() : `Pago ${p.numero}`,
      metodo: p.metodo,
      nota: p.nota,
      moneda: p.moneda,
      debe: 0,
      haber: p.monto,
      saldo: 0,
      sortKey: `${fecha}T1-${p.created_at}`,
    });
  }
  items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const run = { ars: 0, usd: 0 };
  const withSaldo: ClienteFichaMovimiento[] = items.map(({ sortKey: _s, ...m }) => {
    const delta = m.debe - m.haber;
    if (m.moneda === "usd") run.usd += delta;
    else run.ars += delta;
    return { ...m, saldo: m.moneda === "usd" ? run.usd : run.ars };
  });
  return withSaldo.reverse();
}

function mergePresupuestosUnicos(rows: PresupuestoFichaRow[]): PresupuestoFichaRow[] {
  const byId = new Map<string, PresupuestoFichaRow>();
  for (const r of rows) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function fetchClienteFicha(
  clientId: string,
  clientNombre: string,
): Promise<{ data: ClienteFichaData; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: emptyFicha(), error: new Error("Supabase no está configurado") };
  }

  const selectPres = "id, numero, cliente, client_id, total, moneda, status, created_at";
  const nombre = clientNombre.trim();

  const [byIdRes, byNameRes] = await Promise.all([
    supabase.from("presupuestos").select(selectPres).eq("client_id", clientId),
    nombre
      ? supabase.from("presupuestos").select(selectPres).eq("cliente", nombre).is("client_id", null)
      : Promise.resolve({ data: [] as PresupuestoFichaRow[], error: null }),
  ]);

  if (byIdRes.error) return { data: emptyFicha(), error: new Error(byIdRes.error.message) };
  if (byNameRes.error) return { data: emptyFicha(), error: new Error(byNameRes.error.message) };

  const presupuestos = mergePresupuestosUnicos([
    ...((byIdRes.data ?? []) as PresupuestoFichaRow[]),
    ...((byNameRes.data ?? []) as PresupuestoFichaRow[]),
  ]);

  let merged: Awaited<ReturnType<typeof mergeVentasResumenIntoPresupuestos<PresupuestoFichaRow>>> =
    [];
  try {
    merged = await mergeVentasResumenIntoPresupuestos(presupuestos);
  } catch (e) {
    return {
      data: emptyFicha(),
      error: e instanceof Error ? e : new Error("No se pudo cargar ventas del cliente."),
    };
  }

  const ventas: ClienteFichaVenta[] = [];
  const cargosCc: Array<{
    id: string;
    fecha: string;
    presupuestoId: string;
    numero: string;
    moneda: "ars" | "usd";
    total: number;
  }> = [];
  let saldoArs = 0;
  let saldoUsd = 0;
  let cobradoArs = 0;
  let cobradoUsd = 0;

  for (const r of merged) {
    const cobrado = r.total_pagado_misma_moneda ?? 0;
    if (r.venta_id && r.venta_estado) {
      const saldo = r.saldo_misma_moneda ?? r.total - cobrado;
      ventas.push({
        id: r.venta_id,
        presupuestoId: r.id,
        numero: r.numero,
        estado: r.venta_estado,
        total: r.total,
        moneda: r.moneda,
        cobrado,
        saldo,
        created_at: r.created_at,
      });
      if (r.moneda === "usd") cobradoUsd += cobrado;
      else cobradoArs += cobrado;
    }

    if (r.status !== "aprobado") continue;
    cargosCc.push({
      id: r.id,
      fecha: r.created_at,
      presupuestoId: r.id,
      numero: r.numero,
      moneda: r.moneda,
      total: r.total,
    });
    const saldoPendiente =
      typeof r.saldo_misma_moneda === "number" ? Math.max(0, r.saldo_misma_moneda) : Math.max(0, r.total);
    if (r.moneda === "usd") saldoUsd += saldoPendiente;
    else saldoArs += saldoPendiente;
  }

  const ventaIds = [...new Set(ventas.map((v) => v.id))];
  const [otVentaRes, otClienteRes, pagosRes] = await Promise.all([
    ventaIds.length > 0
      ? supabase.from("ordenes_trabajo").select("*").in("venta_id", ventaIds)
      : Promise.resolve({ data: [] as OrdenFichaRow[], error: null }),
    supabase.from("ordenes_trabajo").select("*").eq("id_cliente", clientId),
    ventaIds.length > 0
      ? supabase
          .from("ventas_pagos")
          .select("id, venta_id, monto, moneda, fecha, metodo, nota, created_at")
          .in("venta_id", ventaIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            venta_id: string;
            monto: unknown;
            moneda: "ars" | "usd";
            fecha: string;
            metodo: string | null;
            nota: string | null;
            created_at: string;
          }>,
          error: null,
        }),
  ]);

  if (otVentaRes.error) return { data: emptyFicha(), error: new Error(otVentaRes.error.message) };
  if (otClienteRes.error) return { data: emptyFicha(), error: new Error(otClienteRes.error.message) };
  if (pagosRes.error) return { data: emptyFicha(), error: new Error(pagosRes.error.message) };

  const otsById = new Map<string, OrdenFichaRow>();
  for (const row of [
    ...((otVentaRes.data ?? []) as OrdenFichaRow[]),
    ...((otClienteRes.data ?? []) as OrdenFichaRow[]),
  ]) {
    otsById.set(row.id, row);
  }

  const ventaPorId = new Map(ventas.map((v) => [v.id, v]));

  const pagosCc = (pagosRes.data ?? []).flatMap((p) => {
    const venta = ventaPorId.get(p.venta_id);
    if (!venta) return [];
    return [{
      id: p.id,
      fecha: p.fecha,
      created_at: p.created_at,
      ventaId: p.venta_id,
      presupuestoId: venta.presupuestoId,
      numero: venta.numero,
      moneda: p.moneda === "usd" ? "usd" as const : "ars" as const,
      monto: montoPagoNum(p.monto),
      metodo: p.metodo,
      nota: p.nota,
    }];
  });
  const movimientos = armarCuentaCorriente({ cargos: cargosCc, pagos: pagosCc });

  const ots: ClienteFichaOt[] = [...otsById.values()]
    .filter((ot) => ot.estado !== "cancelled")
    .map((ot) => {
      const venta = ot.venta_id ? ventaPorId.get(ot.venta_id) : undefined;
      const etapa = typeof ot.etapa === "string" ? ot.etapa : "medicion";
      return {
        id: ot.id,
        titulo: ot.titulo?.trim() || (venta ? `OT · ${venta.numero}` : "OT"),
        etapa,
        estado: ot.estado,
        bloqueada: Boolean(ot.bloqueada),
        pausada: Boolean(ot.pausada),
        fecha_programada: ot.fecha_programada,
        presupuestoId: venta?.presupuestoId ?? null,
        presupuestoNumero: venta?.numero ?? "—",
        ventaId: ot.venta_id,
        tabProduccion: tabProduccionDesdeOt({
          estado: ot.estado,
          etapa,
          bloqueada: Boolean(ot.bloqueada),
          pausada: Boolean(ot.pausada),
        }),
        enMedicion: etapa === "medicion" && ot.estado !== "done",
      };
    })
    .sort((a, b) => (b.fecha_programada ?? "").localeCompare(a.fecha_programada ?? ""));

  return {
    data: {
      presupuestos: presupuestos.map((p) => ({
        id: p.id,
        numero: p.numero,
        status: p.status,
        total: p.total,
        moneda: p.moneda,
        created_at: p.created_at,
      })),
      ventas,
      ots,
      movimientos,
      saldoArs: Math.round(saldoArs),
      saldoUsd: Math.round(saldoUsd * 100) / 100,
      cobradoArs: Math.round(cobradoArs),
      cobradoUsd: Math.round(cobradoUsd * 100) / 100,
      otsAbiertas: ots.filter((ot) => ot.estado !== "done").length,
    },
    error: null,
  };
}
