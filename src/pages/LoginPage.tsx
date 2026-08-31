import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { isSupabaseConfigured } from "../lib/supabase";
import { ConfigWarning } from "../components/ConfigWarning";

export function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <ConfigWarning />
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-muted-foreground">Configura Supabase para iniciar sesión.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Comprobando sesión…
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(err.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
            <LayoutDashboard className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">MarmoGest</h1>
            <p className="text-xs text-muted-foreground">Piedra Americana</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">Iniciá sesión para continuar</p>
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none transition-[color,box-shadow] focus:border-ring focus:ring-ring/50 focus:ring-[3px]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none transition-[color,box-shadow] focus:border-ring focus:ring-ring/50 focus:ring-[3px]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/85 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground/70">
          Solo entran usuarios dados de alta en el sistema.
        </p>
      </div>
    </div>
  );
}
