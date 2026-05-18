import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { Mountain } from "lucide-react";
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
    <div className="flex min-h-screen">
      {/* Panel de marca — izquierda */}
      <div className="relative hidden w-[420px] shrink-0 overflow-hidden lg:flex lg:flex-col bg-[oklch(0.18_0.04_250)]">
        {/* Grilla decorativa */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.35 0.04 250 / 0.35) 1px, transparent 1px), linear-gradient(90deg, oklch(0.35 0.04 250 / 0.35) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        {/* Gradiente sutil abajo */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/40 to-transparent" />

        <div className="relative flex flex-1 flex-col items-start justify-center px-12">
          {/* Logo */}
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <Mountain className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-white/40 uppercase">Sistema</p>
              <p className="text-base font-bold text-white leading-none mt-0.5">MarmoGest</p>
            </div>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white leading-snug">
            Gestión integral<br />
            <span className="text-white/60">Piedra Americana</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/40">
            Presupuestos · Ventas · Stock<br />Producción · Cantera
          </p>

          <div className="mt-14 flex gap-10">
            {[
              { label: "Módulos", value: "5" },
              { label: "Gestión", value: "360°" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="mt-0.5 text-xs text-white/35">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative px-12 pb-8">
          <p className="text-xs text-white/25">© Piedra Americana · Escritorio</p>
        </div>
      </div>

      {/* Panel de formulario — derecha */}
      <div className="flex flex-1 flex-col items-center justify-center bg-muted/40 px-6">
        {/* Logo móvil */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <Mountain className="h-5 w-5" />
          <span className="text-base font-bold">MarmoGest</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingresá con tu cuenta para continuar
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="usuario@empresa.com"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2.5">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {busy ? "Entrando…" : "Entrar"}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground leading-relaxed">
            Las cuentas nuevas las crea un administrador en Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}
