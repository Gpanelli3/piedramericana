import { limitePresupuestoDormido } from "@/lib/presupuestos-api";
import { supabase } from "@/lib/supabase";
import { etiquetaEtapaKanban } from "@/lib/etiquetas-ot";

export type ProximaEntregaRow = {
  id: string;
  titulo: string;
  cliente: string;
  fecha: string;
  etapa: string;
};

export type DashboardResumen = {
  presupuestosDormidos: number;
  presupuestosAprobados: number;
  otsActivas: number;
  otsEnMedicion: number;
  otsEnProduccion: number;
  ventasSinSena: number;
  proximasEntregas: ProximaEntregaRow[];
};

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function enDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

type OtDashboard = {
  id: string;
  titulo: string | null;
  etapa: unknown;
  fecha_programada: string | null;
  venta: { presupuesto: { numero: string; cliente: string } | null } | null;
};

/**
 * Resumen del Dashboard en un solo viaje: solo conteos y las OTs activas con su presupuesto
 * anidado (antes bajaba la lista completa de presupuestos con saldos y hacía hasta 7 vueltas).
 */
export async function fetchDashboardResumen(): Promise<{
  data: DashboardResumen | null;
  error: Error | null;
}> {
  const [aprobadosRes, sinSenaRes, otRes, pendientesRes, medicionRes] = await Promise.all([
    supabase
      .from("presupuestos")
      .select("id", { count: "exact", head: true })
      .eq("status", "aprobado"),
    // Aprobados que todavía no tienen venta (anti-join: la venta embebida es null).
    supabase
      .from("presupuestos")
      .select("id, ventas!ventas_presupuesto_id_fkey!left(id)", { count: "exact", head: true })
      .eq("status", "aprobado")
      .is("ventas", null),
    supabase
      .from("ordenes_trabajo")
      .select(
        "id,titulo,etapa,fecha_programada,venta:ventas!ordenes_trabajo_venta_id_fkey(presupuesto:presupuestos!ventas_presupuesto_id_fkey(numero,cliente))",
      )
      .not("venta_id", "is", null)
      .neq("estado", "cancelled")
      .neq("estado", "done"),
    supabase
      .from("presupuestos")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendiente")
      .lte("created_at", limitePresupuestoDormido()),
    supabase
      .from("presupuesto_mediciones")
      .select("id", { count: "exact", head: true })
      .eq("estado", "listo_para_medir"),
  ]);

  for (const r of [aprobadosRes, sinSenaRes, otRes, pendientesRes, medicionRes]) {
    if (r.error) return { data: null, error: new Error(r.error.message) };
  }

  const ots = (otRes.data ?? []) as unknown as OtDashboard[];
  const hoy = hoyIso();
  const limite = enDias(7);
  const proximasEntregas: ProximaEntregaRow[] = ots
    .filter((t) => {
      const f = t.fecha_programada;
      return f && f >= hoy && f <= limite;
    })
    .map((t) => ({
      id: t.id,
      titulo: t.titulo?.trim() || t.venta?.presupuesto?.numero || "OT",
      cliente: t.venta?.presupuesto?.cliente?.trim() || "—",
      fecha: t.fecha_programada as string,
      etapa: etiquetaEtapaKanban(String(t.etapa)),
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 5);

  return {
    data: {
      presupuestosDormidos: pendientesRes.count ?? 0,
      presupuestosAprobados: aprobadosRes.count ?? 0,
      otsActivas: ots.length,
      otsEnMedicion: medicionRes.count ?? 0,
      otsEnProduccion: ots.filter((t) => t.etapa === "corte" || t.etapa === "produccion").length,
      ventasSinSena: sinSenaRes.count ?? 0,
      proximasEntregas,
    },
    error: null,
  };
}
