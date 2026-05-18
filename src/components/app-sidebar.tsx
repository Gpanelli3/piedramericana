"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  ChevronRight,
  FileText,
  LogOut,
  Mountain,
  Package,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type { WorkspaceTab } from "@/types/workspace";
import { useSearchParams } from "react-router-dom";

const KNOWN_WS = new Set<WorkspaceTab>([
  "ventas",
  "administracion",
  "produccion",
  "cantera",
  "stock",
]);

function wsDesdeParam(v: string | null): WorkspaceTab {
  return v && KNOWN_WS.has(v as WorkspaceTab) ? (v as WorkspaceTab) : "ventas";
}

const navItems: { id: WorkspaceTab; label: string; icon: ReactNode; color: string; dot: string }[] = [
  {
    id: "ventas",
    label: "Presupuestos",
    icon: <FileText className="h-4 w-4" />,
    color: "text-red-400",
    dot: "bg-red-400",
  },
  {
    id: "administracion",
    label: "Ventas",
    icon: <Wallet className="h-4 w-4" />,
    color: "text-purple-400",
    dot: "bg-purple-400",
  },
  {
    id: "produccion",
    label: "Producción",
    icon: <Wrench className="h-4 w-4" />,
    color: "text-green-400",
    dot: "bg-green-400",
  },
  {
    id: "cantera",
    label: "Cantera",
    icon: <Mountain className="h-4 w-4" />,
    color: "text-sky-400",
    dot: "bg-sky-400",
  },
  {
    id: "stock",
    label: "Stock",
    icon: <Package className="h-4 w-4" />,
    color: "text-amber-400",
    dot: "bg-amber-400",
  },
];

function initialsFromUser(email: string | undefined, name: string | undefined) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (!email) return "?";
  const local = email.split("@")[0];
  const segs = local.split(/[._-]/).filter(Boolean);
  if (segs.length >= 2) return (segs[0][0] + segs[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [presupuestosMenuAbierto, setPresupuestosMenuAbierto] = useState(false);

  const activeTab = useMemo(() => wsDesdeParam(searchParams.get("ws")), [searchParams]);
  const pv = searchParams.get("pv") ?? "";
  const ft = searchParams.get("ft") ?? "pendientes";

  const gotoWorkspace = useCallback(
    (tab: WorkspaceTab) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("ws", tab);
          if (tab !== "ventas") {
            n.delete("pv");
            n.delete("ft");
            n.delete("rid");
          }
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const gotoVentasQuery = useCallback(
    (
      tipo: "nuevo" | "lista",
      filt: "pendientes" | "aprobados" | "rechazados" | "todos" = "pendientes",
    ) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("ws", "ventas");
          if (tipo === "nuevo") {
            n.set("pv", "nuevo");
            n.delete("ft");
            n.delete("rid");
          } else {
            n.set("pv", "list");
            n.set("ft", filt);
            n.delete("rid");
          }
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (activeTab !== "ventas") {
      setPresupuestosMenuAbierto(false);
    }
  }, [activeTab]);

  const onPresupuestosEncabezado = useCallback(() => {
    if (activeTab !== "ventas") {
      gotoVentasQuery("nuevo");
      setPresupuestosMenuAbierto(true);
      return;
    }
    setPresupuestosMenuAbierto((prev) => !prev);
  }, [activeTab, gotoVentasQuery]);

  const meta = user?.user_metadata as { full_name?: string } | undefined;
  const displayName = meta?.full_name?.trim() || user?.email?.split("@")[0] || "Usuario";
  const initials = initialsFromUser(user?.email, meta?.full_name);

  const submenuLinkCn = (active: boolean) =>
    cn(
      "flex w-full items-center rounded-md px-3 py-1.5 text-left text-[12.5px] transition-colors border-l-2",
      active
        ? "border-red-400 bg-white/5 text-sidebar-foreground font-medium"
        : "border-transparent text-sidebar-foreground/50 hover:bg-white/5 hover:text-sidebar-foreground/80",
    );

  const activeItem = navItems.find((i) => i.id === activeTab);

  return (
    <aside className="flex h-full min-h-0 w-56 shrink-0 flex-col self-stretch bg-sidebar overflow-y-auto [scrollbar-gutter:stable]">
      {/* Logo / marca */}
      <div className="border-b border-sidebar-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
            <Mountain className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-none text-sidebar-foreground tracking-tight">MarmoGest</p>
            <p className="mt-0.5 text-[10px] leading-none text-sidebar-foreground/35 tracking-wide">Piedra Americana</p>
          </div>
        </div>
      </div>

      {/* Usuario */}
      <div className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/80 text-[11px] font-bold text-white ring-1 ring-white/10">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-none text-sidebar-foreground">{displayName}</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-green-400/80">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
              Conectado
            </p>
          </div>
        </div>
      </div>

      {/* Sección activa - etiqueta superior */}
      {activeItem && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-sidebar-foreground/30">
            Navegación
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {navItems.map((item) =>
          item.id === "ventas" ? (
            <div key={item.id} className="space-y-0.5">
              <div
                className={cn(
                  "flex w-full items-stretch rounded-lg transition-colors",
                  activeTab === item.id
                    ? "bg-white/8"
                    : "",
                )}
              >
                {/* Indicador activo lateral */}
                {activeTab === item.id && (
                  <span className="my-1 ml-0.5 w-0.5 shrink-0 rounded-full bg-red-400" />
                )}
                <button
                  type="button"
                  className={cn(
                    "shrink-0 flex items-center justify-center rounded-lg px-1.5 py-2 text-sidebar-foreground/60 hover:text-sidebar-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    activeTab === item.id ? "text-sidebar-foreground/80" : "hover:bg-white/5",
                  )}
                  aria-expanded={activeTab === "ventas" ? presupuestosMenuAbierto : false}
                  aria-controls="sidebar-presupuestos-submenu"
                  aria-label={
                    presupuestosMenuAbierto
                      ? "Contraer submenú de presupuestos"
                      : "Desplegar submenú de presupuestos"
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onPresupuestosEncabezado();
                  }}
                >
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                      presupuestosMenuAbierto && activeTab === "ventas" && "rotate-90",
                    )}
                  />
                </button>
                <button
                  type="button"
                  onClick={onPresupuestosEncabezado}
                  className={cn(
                    "flex flex-1 min-w-0 items-center gap-2.5 px-1 py-2 rounded-lg text-[13px] font-medium transition-colors text-left",
                    activeTab === item.id
                      ? "text-sidebar-foreground"
                      : "text-sidebar-foreground/55 hover:bg-white/5 hover:text-sidebar-foreground/80",
                  )}
                >
                  <span className={cn("shrink-0", activeTab === item.id ? item.color : "text-sidebar-foreground/40")}>
                    {item.icon}
                  </span>
                  <span className="truncate flex-1">{item.label}</span>
                </button>
              </div>

              {presupuestosMenuAbierto && activeTab === "ventas" ? (
                <div
                  id="sidebar-presupuestos-submenu"
                  className="ml-5 pl-1 space-y-0.5 mt-0.5 border-l border-sidebar-border/60"
                >
                  <button
                    type="button"
                    onClick={() => gotoVentasQuery("nuevo")}
                    className={submenuLinkCn(pv === "nuevo")}
                  >
                    Nuevo presupuesto
                  </button>
                  <button
                    type="button"
                    onClick={() => gotoVentasQuery("lista", "aprobados")}
                    className={submenuLinkCn(pv !== "nuevo" && ft === "aprobados")}
                  >
                    Aprobados
                  </button>
                  <button
                    type="button"
                    onClick={() => gotoVentasQuery("lista", "pendientes")}
                    className={submenuLinkCn(pv !== "nuevo" && ft === "pendientes")}
                  >
                    Pendientes
                  </button>
                  <button
                    type="button"
                    onClick={() => gotoVentasQuery("lista", "rechazados")}
                    className={submenuLinkCn(pv !== "nuevo" && ft === "rechazados")}
                  >
                    Rechazados
                  </button>
                  <button
                    type="button"
                    onClick={() => gotoVentasQuery("lista", "todos")}
                    className={submenuLinkCn(pv !== "nuevo" && ft === "todos")}
                  >
                    Todos
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              key={item.id}
              type="button"
              onClick={() => gotoWorkspace(item.id)}
              className={cn(
                "group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                activeTab === item.id
                  ? "bg-white/8 text-sidebar-foreground"
                  : "text-sidebar-foreground/55 hover:bg-white/5 hover:text-sidebar-foreground/80",
              )}
            >
              {/* Indicador activo lateral */}
              {activeTab === item.id && (
                <span className={cn("absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full", item.dot)} />
              )}
              <span className={cn("shrink-0 ml-1", activeTab === item.id ? item.color : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60")}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ),
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-sidebar-foreground/50 hover:bg-white/5 hover:text-sidebar-foreground/80 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
