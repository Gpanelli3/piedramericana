"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  ChevronRight,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
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
  Ruler,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarmoGestMark } from "@/components/marmogest-mark";
import { useAuth } from "@/contexts/AuthContext";
import { useRol } from "@/hooks/useRol";
import {
  EQUIPO_SECCION_LABELS,
  EQUIPO_SECCIONES,
  FINANZAS_SECCION_LABELS,
  FINANZAS_SECCIONES,
  PRODUCCION_OT_FILTROS,
  PRODUCCION_OT_LABELS,
  WORKSPACE_TABS,
  equipoSeccionDesdeParam,
  finanzasSeccionDesdeParam,
  produccionOtDesdeParam,
  type EquipoSeccion,
  type FinanzasSeccion,
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
  roles?: string[];
};

const NAV_ITEMS: NavItemDef[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-[18px] w-[18px]" />,
  },
  {
    id: "ventas",
    label: "Presupuestos",
    icon: <FileText className="h-[18px] w-[18px]" />,
    roles: ["vendedor", "admin", "administracion"],
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: <Users className="h-[18px] w-[18px]" />,
    roles: ["vendedor", "admin", "administracion"],
  },
  {
    id: "articulos",
    label: "Trabajos",
    icon: <Tags className="h-[18px] w-[18px]" />,
    roles: ["vendedor", "admin", "administracion"],
  },
  {
    id: "administracion",
    label: "Ventas",
    icon: <Wallet className="h-[18px] w-[18px]" />,
    roles: ["vendedor", "admin", "administracion"],
  },
  {
    id: "medicion",
    label: "Medición",
    icon: <Ruler className="h-[18px] w-[18px]" />,
    roles: ["vendedor", "medidor", "admin", "administracion"],
  },
  {
    id: "produccion",
    label: "Producción",
    icon: <Wrench className="h-[18px] w-[18px]" />,
    roles: ["cortador", "produccion", "medidor", "admin"],
  },
  {
    id: "cantera",
    label: "Cantera",
    icon: <Mountain className="h-[18px] w-[18px]" />,
    roles: ["admin", "administracion"],
  },
  {
    id: "stock",
    label: "Stock",
    icon: <Package className="h-[18px] w-[18px]" />,
    roles: ["admin", "administracion", "produccion"],
  },
  {
    id: "proveedores",
    label: "Proveedores",
    icon: <Truck className="h-[18px] w-[18px]" />,
    roles: ["admin", "administracion"],
  },
  {
    id: "comercio_exterior",
    label: "Comercio exterior",
    icon: <Ship className="h-[18px] w-[18px]" />,
    roles: ["admin", "administracion"],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    icon: <Landmark className="h-[18px] w-[18px]" />,
    roles: ["admin", "administracion"],
  },
  {
    id: "equipo",
    label: "Equipo",
    icon: <UserCog className="h-[18px] w-[18px]" />,
    roles: ["admin", "administracion"],
  },
  {
    id: "reportes",
    label: "Reportes",
    icon: <BarChart3 className="h-[18px] w-[18px]" />,
    roles: ["admin", "administracion"],
  },
  {
    id: "configuracion",
    label: "Configuración",
    icon: <Settings className="h-[18px] w-[18px]" />,
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
  if (tab !== "finanzas") n.delete("fn");
  if (tab !== "clientes") n.delete("cid");
  if (tab !== "administracion") n.delete("pid");
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
    <div className="space-y-0.5">
      <div
        className={cn(
          "flex w-full items-stretch rounded-xl transition-colors",
          active ? "bg-accent text-accent-foreground" : "text-sidebar-foreground",
        )}
      >
        <button
          type="button"
          className={cn(
            "shrink-0 flex items-center justify-center rounded-xl px-1 py-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
            active
              ? "text-accent-foreground hover:bg-accent/80"
              : "text-sidebar-foreground/70 hover:bg-muted hover:text-sidebar-foreground",
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
            "flex flex-1 min-w-0 items-center gap-2.5 px-1 py-2.5 rounded-xl text-sm font-medium transition-colors text-left",
            active
              ? "text-accent-foreground"
              : "text-sidebar-foreground hover:bg-muted",
          )}
        >
          <span>{item.icon}</span>
          <span className="truncate flex-1">{item.label}</span>
        </button>
      </div>

      {menuAbierto && active ? (
        <div
          id={submenuId}
          className="border-l-2 border-accent/40 ml-5 pl-2 space-y-0.5 mt-1"
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
  const [finanzasMenuAbierto, setFinanzasMenuAbierto] = useState(false);

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
  const fnSeccion = useMemo(
    () => finanzasSeccionDesdeParam(searchParams.get("fn")),
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
          if (tab === "finanzas") n.set("fn", "libro");
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

  const gotoFinanzasSeccion = useCallback(
    (seccion: FinanzasSeccion) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("ws", "finanzas");
          limpiarParamsDeOtrosModulos(n, "finanzas");
          n.set("fn", seccion);
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
    if (activeTab !== "finanzas") setFinanzasMenuAbierto(false);
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

  const onFinanzasEncabezado = useCallback(() => {
    if (activeTab !== "finanzas") {
      gotoFinanzasSeccion("libro");
      setFinanzasMenuAbierto(true);
      return;
    }
    setFinanzasMenuAbierto((prev) => !prev);
  }, [activeTab, gotoFinanzasSeccion]);

  const meta = user?.user_metadata as { full_name?: string } | undefined;
  const displayName = meta?.full_name?.trim() || user?.email?.split("@")[0] || "Usuario";
  const initials = initialsFromUser(user?.email, meta?.full_name);

  const submenuLinkCn = (active: boolean) =>
    cn(
      "flex w-full items-center rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors",
      active
        ? "bg-accent/20 text-accent-foreground font-medium"
        : "text-sidebar-foreground/80 hover:bg-muted hover:text-sidebar-foreground",
    );

  return (
    <aside className="flex h-full min-h-0 w-60 shrink-0 flex-col self-stretch bg-sidebar border-r border-sidebar-border overflow-y-auto [scrollbar-gutter:stable]">
      {/* Brand */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
            <MarmoGestMark className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">MarmoGest</span>
        </div>
      </div>

      {/* User */}
      <div className="border-y border-sidebar-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</p>
            {roles.length > 0 ? (
              <p className="truncate text-xs text-sidebar-foreground/50">
                {(esAdmin ? ["admin"] : roles.slice(0, 2))
                  .map((r) => ETIQUETAS_ROL[r] ?? r)
                  .join(" · ")}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-success-strong">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-strong" />
                Sesión activa
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Navegación
        </p>
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
                  className={submenuLinkCn(pv === "nuevo")}
                >
                  Nuevo presupuesto
                </button>
                <button
                  type="button"
                  onClick={() => gotoVentasQuery("lista", "todos")}
                  className={submenuLinkCn(pv !== "nuevo" && ft === "todos")}
                >
                  Todos
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
                    className={submenuLinkCn(otFiltro === filtro)}
                  >
                    {PRODUCCION_OT_LABELS[filtro]}
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
                    className={submenuLinkCn(eqSeccion === seccion)}
                  >
                    {EQUIPO_SECCION_LABELS[seccion]}
                  </button>
                ))}
              </ExpandableNavItem>
            );
          }

          if (item.id === "finanzas") {
            return (
              <ExpandableNavItem
                key={item.id}
                item={item}
                active={activeTab === item.id}
                menuAbierto={finanzasMenuAbierto}
                onToggleEncabezado={onFinanzasEncabezado}
                submenuId="sidebar-finanzas-submenu"
              >
                {FINANZAS_SECCIONES.map((seccion) => (
                  <button
                    key={seccion}
                    type="button"
                    onClick={() => gotoFinanzasSeccion(seccion)}
                    className={submenuLinkCn(fnSeccion === seccion)}
                  >
                    {FINANZAS_SECCION_LABELS[seccion]}
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
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                activeTab === item.id
                  ? "bg-accent text-accent-foreground"
                  : "text-sidebar-foreground hover:bg-muted",
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-2 border-t border-sidebar-border px-4 py-4">
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground/60 hover:bg-muted hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
        <p className="px-3 text-[11px] text-sidebar-foreground/30">Piedra Americana · escritorio</p>
      </div>
    </aside>
  );
}
