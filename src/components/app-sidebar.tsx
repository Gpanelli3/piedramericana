"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  ChevronRight,
  FileText,
  Landmark,
  LayoutDashboard,
  Mountain,
  Package,
  Settings,
  Ship,
  Tags,
  Truck,
  Users,
  UserCog,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRol } from "@/hooks/useRol";
import {
  EQUIPO_SECCION_LABELS,
  EQUIPO_SECCIONES,
  PRODUCCION_OT_FILTROS,
  PRODUCCION_OT_LABELS,
  WORKSPACE_TABS,
  equipoSeccionDesdeParam,
  produccionOtDesdeParam,
  type EquipoSeccion,
  type ProduccionOtFiltro,
  type WorkspaceTab,
} from "@/types/workspace";
import { useSearchParams } from "react-router-dom";

const KNOWN_WS = new Set<WorkspaceTab>(WORKSPACE_TABS);

function wsDesdeParam(v: string | null): WorkspaceTab {
  return v && KNOWN_WS.has(v as WorkspaceTab) ? (v as WorkspaceTab) : "dashboard";
}

type NavItemDef = {
  id: WorkspaceTab;
  label: string;
  icon: ReactNode;
  color: string;
  /** Roles que pueden ver este módulo. Si está vacío, todos lo ven. */
  roles?: string[];
};

const NAV_ITEMS: NavItemDef[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    color: "text-accent",
  },
  {
    id: "ventas",
    label: "Presupuestos",
    icon: <FileText className="h-5 w-5" />,
    color: "text-red-400",
    roles: ["vendedor", "admin", "administracion"],
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: <Users className="h-5 w-5" />,
    color: "text-blue-400",
    roles: ["vendedor", "admin", "administracion"],
  },
  {
    id: "articulos",
    label: "Sub-ítems",
    icon: <Tags className="h-5 w-5" />,
    color: "text-orange-400",
    roles: ["vendedor", "admin", "administracion"],
  },
  {
    id: "administracion",
    label: "Ventas",
    icon: <Wallet className="h-5 w-5" />,
    color: "text-purple-400",
    roles: ["vendedor", "admin", "administracion"],
  },
  {
    id: "produccion",
    label: "Producción",
    icon: <Wrench className="h-5 w-5" />,
    color: "text-green-400",
    roles: ["cortador", "produccion", "medidor", "admin"],
  },
  {
    id: "cantera",
    label: "Cantera",
    icon: <Mountain className="h-5 w-5" />,
    color: "text-sky-400",
    roles: ["admin", "administracion"],
  },
  {
    id: "stock",
    label: "Stock",
    icon: <Package className="h-5 w-5" />,
    color: "text-yellow-400",
    roles: ["admin", "administracion", "produccion"],
  },
  {
    id: "proveedores",
    label: "Proveedores",
    icon: <Truck className="h-5 w-5" />,
    color: "text-amber-400",
    roles: ["admin", "administracion"],
  },
  {
    id: "comercio_exterior",
    label: "Comercio exterior",
    icon: <Ship className="h-5 w-5" />,
    color: "text-indigo-400",
    roles: ["admin", "administracion"],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    icon: <Landmark className="h-5 w-5" />,
    color: "text-teal-400",
    roles: ["admin", "administracion"],
  },
  {
    id: "equipo",
    label: "Equipo",
    icon: <UserCog className="h-5 w-5" />,
    color: "text-rose-400",
    roles: ["admin", "administracion"],
  },
  {
    id: "reportes",
    label: "Reportes",
    icon: <BarChart3 className="h-5 w-5" />,
    color: "text-emerald-400",
    roles: ["admin", "administracion"],
  },
  {
    id: "configuracion",
    label: "Configuración",
    icon: <Settings className="h-5 w-5" />,
    color: "text-zinc-400",
    roles: ["admin"],
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

const ETIQUETAS_ROL: Record<string, string> = {
  vendedor: "Vendedor",
  medidor: "Medidor",
  cortador: "Cortador",
  produccion: "Producción",
  instalador: "Instalador",
  reparador: "Reparador",
  administracion: "Administración",
  admin: "Administrador",
};

function limpiarParamsDeOtrosModulos(n: URLSearchParams, tab: WorkspaceTab) {
  if (tab !== "ventas") {
    n.delete("pv");
    n.delete("ft");
    n.delete("rid");
    n.delete("id");
  }
  if (tab !== "produccion") n.delete("ot");
  if (tab !== "equipo") n.delete("eq");
}

type ExpandableNavProps = {
  item: NavItemDef;
  active: boolean;
  menuAbierto: boolean;
  onToggleEncabezado: () => void;
  submenuId: string;
  children: ReactNode;
};

function ExpandableNavItem({
  item,
  active,
  menuAbierto,
  onToggleEncabezado,
  submenuId,
  children,
}: ExpandableNavProps) {
  return (
    <div className="space-y-0.5 pb-2">
      <div
        className={cn(
          "flex w-full items-stretch rounded-md",
          active ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/60",
        )}
      >
        <button
          type="button"
          className={cn(
            "shrink-0 flex items-center justify-center rounded-md px-1 py-2.5 text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
            active ? "hover:bg-white/10" : "hover:bg-sidebar-accent/45",
          )}
          aria-expanded={active ? menuAbierto : false}
          aria-controls={submenuId}
          aria-label={menuAbierto ? `Contraer submenú de ${item.label}` : `Desplegar submenú de ${item.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleEncabezado();
          }}
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200",
              menuAbierto && active && "rotate-90",
            )}
          />
        </button>
        <button
          type="button"
          onClick={onToggleEncabezado}
          className={cn(
            "flex flex-1 min-w-0 items-center gap-2 px-1 py-2.5 rounded-md text-sm font-medium transition-colors text-left",
            active
              ? "text-sidebar-foreground"
              : "hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          <span className={cn(active ? item.color : "")}>{item.icon}</span>
          <span className="truncate flex-1">{item.label}</span>
          {active ? (
            <span className={cn("h-2 w-2 shrink-0 rounded-full", item.color.replace("text-", "bg-"))} />
          ) : null}
        </button>
      </div>

      {menuAbierto && active ? (
        <div
          id={submenuId}
          className="border-l border-sidebar-border ml-5 pl-1 space-y-0.5 mt-1"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { roles, esAdmin } = useRol();
  const [searchParams, setSearchParams] = useSearchParams();
  const [presupuestosMenuAbierto, setPresupuestosMenuAbierto] = useState(false);
  const [produccionMenuAbierto, setProduccionMenuAbierto] = useState(false);
  const [equipoMenuAbierto, setEquipoMenuAbierto] = useState(false);

  const activeTab = useMemo(() => wsDesdeParam(searchParams.get("ws")), [searchParams]);
  const pv = searchParams.get("pv") ?? "";
  const ft = searchParams.get("ft") ?? "pendientes";
  const otFiltro = useMemo(
    () => produccionOtDesdeParam(searchParams.get("ot")),
    [searchParams],
  );
  const eqSeccion = useMemo(
    () => equipoSeccionDesdeParam(searchParams.get("eq")),
    [searchParams],
  );

  const navItems = useMemo(() => {
    if (esAdmin || roles.length === 0) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => {
      if (!item.roles || item.roles.length === 0) return true;
      return item.roles.some((r) => roles.includes(r as never));
    });
  }, [roles, esAdmin]);

  const gotoWorkspace = useCallback(
    (tab: WorkspaceTab) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("ws", tab);
          limpiarParamsDeOtrosModulos(n, tab);
          if (tab === "produccion") n.set("ot", "general");
          if (tab === "equipo") n.set("eq", "empleados");
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
      filt:
        | "pendientes"
        | "aprobados"
        | "rechazados"
        | "todos" = "pendientes",
    ) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("ws", "ventas");
          limpiarParamsDeOtrosModulos(n, "ventas");
          if (tipo === "nuevo") {
            n.set("pv", "nuevo");
            n.delete("ft");
            n.delete("rid");
            n.delete("id");
          } else {
            n.set("pv", "list");
            n.set("ft", filt);
            n.delete("rid");
            n.delete("id");
          }
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const gotoProduccionOt = useCallback(
    (filtro: ProduccionOtFiltro) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("ws", "produccion");
          limpiarParamsDeOtrosModulos(n, "produccion");
          n.set("ot", filtro);
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const gotoEquipoSeccion = useCallback(
    (seccion: EquipoSeccion) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("ws", "equipo");
          limpiarParamsDeOtrosModulos(n, "equipo");
          n.set("eq", seccion);
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (activeTab !== "ventas") setPresupuestosMenuAbierto(false);
    if (activeTab !== "produccion") setProduccionMenuAbierto(false);
    if (activeTab !== "equipo") setEquipoMenuAbierto(false);
  }, [activeTab]);

  const onPresupuestosEncabezado = useCallback(() => {
    if (activeTab !== "ventas") {
      gotoVentasQuery("nuevo");
      setPresupuestosMenuAbierto(true);
      return;
    }
    setPresupuestosMenuAbierto((prev) => !prev);
  }, [activeTab, gotoVentasQuery]);

  const onProduccionEncabezado = useCallback(() => {
    if (activeTab !== "produccion") {
      gotoProduccionOt("general");
      setProduccionMenuAbierto(true);
      return;
    }
    setProduccionMenuAbierto((prev) => !prev);
  }, [activeTab, gotoProduccionOt]);

  const onEquipoEncabezado = useCallback(() => {
    if (activeTab !== "equipo") {
      gotoEquipoSeccion("empleados");
      setEquipoMenuAbierto(true);
      return;
    }
    setEquipoMenuAbierto((prev) => !prev);
  }, [activeTab, gotoEquipoSeccion]);

  const meta = user?.user_metadata as { full_name?: string } | undefined;
  const displayName = meta?.full_name?.trim() || user?.email?.split("@")[0] || "Usuario";
  const initials = initialsFromUser(user?.email, meta?.full_name);

  const submenuLinkCn = (active: boolean, accentBorder: string) =>
    cn(
      "flex w-full items-center rounded-md px-3 py-1.5 text-left text-[13px] transition-colors border-l-2",
      active
        ? cn(accentBorder, "bg-sidebar-accent text-sidebar-foreground font-medium")
        : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
    );

  return (
    <aside className="flex h-full min-h-0 w-56 shrink-0 flex-col self-stretch bg-sidebar overflow-y-auto [scrollbar-gutter:stable]">
      <div className="border-b border-sidebar-border px-5 py-5">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-accent" />
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">MarmoGest</span>
        </div>
      </div>

      <div className="border-b border-sidebar-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</p>
            {roles.length > 0 ? (
              <p className="truncate text-xs text-sidebar-foreground/60">
                {(esAdmin ? ["admin"] : roles.slice(0, 2))
                  .map((r) => ETIQUETAS_ROL[r] ?? r)
                  .join(" · ")}
              </p>
            ) : (
              <p className="flex items-center gap-1 text-xs text-green-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                Sesión activa
              </p>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => {
          if (item.id === "ventas") {
            return (
              <ExpandableNavItem
                key={item.id}
                item={item}
                active={activeTab === item.id}
                menuAbierto={presupuestosMenuAbierto}
                onToggleEncabezado={onPresupuestosEncabezado}
                submenuId="sidebar-presupuestos-submenu"
              >
                <button
                  type="button"
                  onClick={() => gotoVentasQuery("nuevo")}
                  className={submenuLinkCn(pv === "nuevo", "border-red-400")}
                >
                  Nuevo presupuesto
                </button>
                <button
                  type="button"
                  onClick={() => gotoVentasQuery("lista", "aprobados")}
                  className={submenuLinkCn(pv !== "nuevo" && ft === "aprobados", "border-red-400")}
                >
                  Aprobados
                </button>
                <button
                  type="button"
                  onClick={() => gotoVentasQuery("lista", "pendientes")}
                  className={submenuLinkCn(pv !== "nuevo" && ft === "pendientes", "border-red-400")}
                >
                  Pendientes
                </button>
                <button
                  type="button"
                  onClick={() => gotoVentasQuery("lista", "rechazados")}
                  className={submenuLinkCn(pv !== "nuevo" && ft === "rechazados", "border-red-400")}
                >
                  Rechazados
                </button>
                <button
                  type="button"
                  onClick={() => gotoVentasQuery("lista", "todos")}
                  className={submenuLinkCn(pv !== "nuevo" && ft === "todos", "border-red-400")}
                >
                  Todos
                </button>
              </ExpandableNavItem>
            );
          }

          if (item.id === "produccion") {
            return (
              <ExpandableNavItem
                key={item.id}
                item={item}
                active={activeTab === item.id}
                menuAbierto={produccionMenuAbierto}
                onToggleEncabezado={onProduccionEncabezado}
                submenuId="sidebar-produccion-submenu"
              >
                {PRODUCCION_OT_FILTROS.map((filtro) => (
                  <button
                    key={filtro}
                    type="button"
                    onClick={() => gotoProduccionOt(filtro)}
                    className={submenuLinkCn(
                      otFiltro === filtro,
                      filtro === "entregadas" ? "border-orange-400" : "border-green-400",
                    )}
                  >
                    <span className={filtro === "entregadas" ? "text-orange-300" : undefined}>
                      {PRODUCCION_OT_LABELS[filtro]}
                    </span>
                  </button>
                ))}
              </ExpandableNavItem>
            );
          }

          if (item.id === "equipo") {
            return (
              <ExpandableNavItem
                key={item.id}
                item={item}
                active={activeTab === item.id}
                menuAbierto={equipoMenuAbierto}
                onToggleEncabezado={onEquipoEncabezado}
                submenuId="sidebar-equipo-submenu"
              >
                {EQUIPO_SECCIONES.map((seccion) => (
                  <button
                    key={seccion}
                    type="button"
                    onClick={() => gotoEquipoSeccion(seccion)}
                    className={submenuLinkCn(eqSeccion === seccion, "border-rose-400")}
                  >
                    {EQUIPO_SECCION_LABELS[seccion]}
                  </button>
                ))}
              </ExpandableNavItem>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => gotoWorkspace(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                activeTab === item.id
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <span className={cn(activeTab === item.id ? item.color : "")}>{item.icon}</span>
              {item.label}
              {activeTab === item.id && (
                <span className={cn("ml-auto h-2 w-2 rounded-full", item.color.replace("text-", "bg-"))} />
              )}
            </button>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border px-5 py-4">
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-md border border-sidebar-border px-2 py-1.5 text-left text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
        >
          Cerrar sesión
        </button>
        <p className="text-xs text-sidebar-foreground/30">Piedra Americana · escritorio</p>
      </div>
    </aside>
  );
}
