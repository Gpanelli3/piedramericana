import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { isSupabaseConfigured } from "../lib/supabase";
import { ConfigWarning } from "../components/ConfigWarning";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? "bg-slate-800 text-white" : "text-slate-200 hover:bg-slate-800/60"
  }`;

export function AppShell() {
  const { signOut, user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {!isSupabaseConfigured ? <ConfigWarning /> : null}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 flex-col bg-slate-900 text-white">
          <div className="border-b border-slate-700 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Marmolería</p>
            <p className="font-semibold">Piedra Americana</p>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3">
            <NavLink to="/" end className={navClass}>
              Inicio
            </NavLink>
            <NavLink to="/clientes" className={navClass}>
              Clientes
            </NavLink>
            <NavLink to="/presupuestos" className={navClass}>
              Presupuestos
            </NavLink>
            <NavLink to="/trabajos" className={navClass}>
              Trabajos
            </NavLink>
            <NavLink to="/facturas" className={navClass}>
              Facturación
            </NavLink>
          </nav>
          <div className="border-t border-slate-700 p-3 text-xs text-slate-400">
            {user?.email ? (
              <>
                <p className="truncate text-slate-200">{user.email}</p>
                <button
                  type="button"
                  className="mt-2 w-full rounded-md border border-slate-600 px-2 py-1 text-left text-slate-200 hover:bg-slate-800"
                  onClick={() => void signOut()}
                >
                  Cerrar sesión
                </button>
              </>
            ) : null}
          </div>
        </aside>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
