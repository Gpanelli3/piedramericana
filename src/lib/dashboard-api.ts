import { listPresupuestosResumen } from "@/lib/presupuestos-api";
import { loadOtKanbanView } from "@/lib/ventas-api";
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
  presupuestosPendientes: number;
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

export async function fetchDashboardResumen(): Promise<{
  data: DashboardResumen | null;
  error: Error | null;
}> {
  const [presRes, otRes, pendientesRes, medicionRes] = await Promise.all([
    listPresupuestosResumen(),
    loadOtKanbanView(),
    supabase
      .from("presupuestos")
      .select("*", { count: "exact", head: true })
      .eq("status", "pendiente"),
    supabase
      .from("presupuesto_mediciones")
      .select("id", { count: "exact", head: true })
      .eq("estado", "listo_para_medir"),
  ]);

  if (presRes.error) return { data: null, error: presRes.error };
  if (otRes.error) return { data: null, error: otRes.error };
  if (pendientesRes.error) return { data: null, error: new Error(pendientesRes.error.message) };
  if (medicionRes.error) return { data: null, error: new Error(medicionRes.error.message) };

  const presupuestos = presRes.data ?? [];
  const aprobados = presupuestos.filter((p) => p.status === "aprobado");

  let sinSena = 0;
  for (const r of aprobados) {
    if (r.venta_estado === null) sinSena += 1;
  }

  const ots = otRes.data ?? [];
  const otsActivas = ots.length;
  const otsEnMedicion = medicionRes.count ?? 0;
  const otsEnProduccion = ots.filter((t) => t.orden.etapa === "corte" || t.orden.etapa === "produccion").length;

  const hoy = hoyIso();
  const limite = enDias(7);
  const proximasEntregas: ProximaEntregaRow[] = ots
    .filter((t) => {
      const f = t.orden.fecha_programada;
      return f && f >= hoy && f <= limite;
    })
    .map((t) => ({
      id: t.orden.id,
      titulo: t.orden.titulo?.trim() || t.presupuestoFuente?.numero || "OT",
      cliente: t.presupuestoFuente?.cliente?.trim() || "—",
      fecha: t.orden.fecha_programada as string,
      etapa: etiquetaEtapaKanban(String(t.orden.etapa)),
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 5);

  return {
    data: {
      presupuestosPendientes: pendientesRes.count ?? 0,
      presupuestosAprobados: aprobados.length,
      otsActivas,
      otsEnMedicion,
      otsEnProduccion,
      ventasSinSena: sinSena,
      proximasEntregas,
    },
    error: null,
  };
}
