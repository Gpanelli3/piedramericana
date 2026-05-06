export function ConfigWarning() {
  return (
    <div
      className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
      role="status"
    >
      Falta configurar Supabase: crea un archivo <code className="rounded bg-amber-100 px-1">.env.local</code>{" "}
      en la raíz del proyecto con <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> y{" "}
      <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code>. Consulta{" "}
      <code className="rounded bg-amber-100 px-1">.env.example</code>.
    </div>
  );
}
