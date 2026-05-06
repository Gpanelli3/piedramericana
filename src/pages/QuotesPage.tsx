import { useEffect, useState } from "react";
import { listQuotesWithClients } from "../lib/data";
import type { QuoteStatus } from "../types/database";

type QuoteRow = {
  id: string;
  client_id: string;
  status: QuoteStatus;
  title: string | null;
  total_cents: number;
  created_at: string;
  clients: { id: string; name: string } | null;
};

const statusLabel: Record<QuoteStatus, string> = {
  draft: "Borrador",
  sent: "Enviado",
  accepted: "Aceptado",
  rejected: "Rechazado",
  expired: "Vencido",
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(cents / 100);
}

export function QuotesPage() {
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listQuotesWithClients().then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err.message);
      setRows((data as QuoteRow[]) ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Presupuestos</h1>
        <p className="text-slate-600">Listado enlazado a clientes.</p>
      </div>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2 font-medium">Título</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-slate-500">
                  Cargando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-slate-500">
                  No hay presupuestos. Crearlos desde Supabase o amplía la UI aquí.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {r.title ?? "Sin título"}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{r.clients?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{statusLabel[r.status]}</td>
                  <td className="px-4 py-2 tabular-nums text-slate-800">
                    {formatMoney(r.total_cents)}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
