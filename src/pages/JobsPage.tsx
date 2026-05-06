import { useEffect, useState } from "react";
import { listJobsWithClients } from "../lib/data";
import type { JobStatus } from "../types/database";

type JobRow = {
  id: string;
  client_id: string;
  title: string;
  status: JobStatus;
  scheduled_for: string | null;
  created_at: string;
  clients: { id: string; name: string } | null;
};

const statusLabel: Record<JobStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Finalizado",
  cancelled: "Cancelado",
};

export function JobsPage() {
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listJobsWithClients().then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err.message);
      setRows((data as JobRow[]) ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Trabajos</h1>
        <p className="text-slate-600">Órdenes de trabajo por cliente.</p>
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
              <th className="px-4 py-2 font-medium">Trabajo</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Programado</th>
              <th className="px-4 py-2 font-medium">Alta</th>
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
                  No hay trabajos registrados.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-900">{r.title}</td>
                  <td className="px-4 py-2 text-slate-700">{r.clients?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{statusLabel[r.status]}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.scheduled_for
                      ? new Date(r.scheduled_for).toLocaleDateString()
                      : "—"}
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
