import { useEffect, useState } from "react";
import { fetchDashboardCounts } from "../lib/data";

export function HomePage() {
  const [counts, setCounts] = useState({
    clients: 0,
    quotes: 0,
    jobs: 0,
    invoices: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardCounts().then((res) => {
      if (cancelled) return;
      if (res.error) setError(res.error.message);
      setCounts({
        clients: res.clients,
        quotes: res.quotes,
        jobs: res.jobs,
        invoices: res.invoices,
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { label: "Clientes", value: counts.clients },
    { label: "Presupuestos", value: counts.quotes },
    { label: "Trabajos", value: counts.jobs },
    { label: "Facturas", value: counts.invoices },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Inicio</h1>
        <p className="text-slate-600">Resumen de la operación del taller.</p>
      </div>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
              {loading ? "—" : c.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
