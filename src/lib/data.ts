import { supabase } from "./supabase";

export async function fetchDashboardCounts() {
  const [clients, quotes, ordenesTrabajo, invoices] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("quotes").select("*", { count: "exact", head: true }),
    supabase.from("ordenes_trabajo").select("*", { count: "exact", head: true }),
    supabase.from("invoices").select("*", { count: "exact", head: true }),
  ]);

  return {
    clients: clients.count ?? 0,
    quotes: quotes.count ?? 0,
    ordenesTrabajo: ordenesTrabajo.count ?? 0,
    invoices: invoices.count ?? 0,
    error:
      clients.error ?? quotes.error ?? ordenesTrabajo.error ?? invoices.error ?? null,
  };
}

export function listClients() {
  return supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
}

export function insertClient(payload: {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}) {
  return supabase.from("clients").insert(payload).select().single();
}

export function listQuotesWithClients(pageSize = 50) {
  return supabase
    .from("quotes")
    .select("*, clients ( id, name )")
    .order("created_at", { ascending: false })
    .limit(pageSize);
}

export function listOrdenesTrabajoWithClients(pageSize = 50) {
  return supabase
    .from("ordenes_trabajo")
    .select("*, clients ( id, name )")
    .order("creado_en", { ascending: false })
    .limit(pageSize);
}

export function listInvoicesWithClients(pageSize = 50) {
  return supabase
    .from("invoices")
    .select("*, clients ( id, name )")
    .order("created_at", { ascending: false })
    .limit(pageSize);
}
