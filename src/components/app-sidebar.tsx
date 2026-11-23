"use client";

import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import type { FocusEvent, ReactNode } from "react";
import {
  BarChart3,
  CircleHelp,
  CalendarDays,
  ChevronRight,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Mountain,
  Package,
  Settings,
  Ship,
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
import { useGuia } from "@/components/guia/GuiaProvider";
import { useGuiaActiva } from "@/lib/guia/estado";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    id: "planificacion",
    label: "Planificación",
    icon: <CalendarDays className="h-[18px] w-[18px]" />,
    roles: ["vendedor", "medidor", "produccion", "instalador", "admin", "administracion"],
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
    label: "Órdenes de Trabajo",
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
    roles: ["vendedor", "admin", "administracion", "produccion"],
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

const SIDEBAR_MOTION =
  "transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

function sidebarFadeCn(visible: boolean, className?: string) {
  return cn(
    "min-w-0 overflow-hidden transition-[opacity,transform] motion-reduce:transition-none",
    visible
      ? "translate-x-0 opacity-100 duration-200 delay-150 ease-out"
      : "pointer-events-none -translate-x-0.5 opacity-0 duration-100 delay-0 ease-in",
    className,
  );
}

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
  if (tab !== "stock") n.delete("st");
}

type ExpandableNavProps = {
  item: NavItemDef;
  active: boolean;
  menuAbierto: boolean;
  expandido: boolean;
  onToggleEncabezado: () => void;
  onToggleSubmenu: () => void;
  submenuId: string;
  children: ReactNode;
};

function ExpandableNavItem({
  item,
  active,
  menuAbierto,
  expandido,
  onToggleEncabezado,
  onToggleSubmenu,
  submenuId,
  children,
}: ExpandableNavProps) {
  const submenuVisible = expandido && menuAbierto && active;

  return (
    <div data-guia={`nav-${item.id}`}>
      <div
        className={cn(
          "flex w-full items-stretch rounded-xl transition-colors",
          active ? "bg-accent text-accent-foreground" : "text-sidebar-foreground",
        )}
      >
        <button
          type="button"
          onClick={onToggleEncabezado}
          aria-label={!expandido ? item.label : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center rounded-xl py-2.5 text-left text-sm font-medium transition-colors",
            active
              ? "text-accent-foreground"
              : "text-sidebar-foreground hover:bg-muted",
          )}
        >
          <span className="flex w-12 shrink-0 items-center justify-center">{item.icon}</span>
          <span
            aria-hidden={!expandido}
            className={sidebarFadeCn(expandido, "flex-1 truncate whitespace-nowrap")}
          >
            {item.label}
          </span>
        </button>
        <button
          type="button"
          tabIndex={expandido ? 0 : -1}
          aria-hidden={!expandido}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl outline-none transition-[opacity,width,padding] duration-200 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
            expandido ? "w-8 px-1 opacity-100" : "w-0 overflow-hidden p-0 opacity-0",
            active
              ? "text-accent-foreground hover:bg-accent/80"
              : "text-sidebar-foreground/70 hover:bg-muted hover:text-sidebar-foreground",
          )}
          aria-expanded={active ? menuAbierto : false}
          aria-controls={submenuId}
          aria-label={menuAbierto ? `Contraer submenú de ${item.label}` : `Desplegar submenú de ${item.label}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSubmenu();
          }}
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              submenuVisible && "rotate-90",
            )}
          />
        </button>
      </div>

      <div
        id={submenuId}
        inert={!submenuVisible}
        aria-hidden={!submenuVisible}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          submenuVisible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none",
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-5 mt-1 space-y-0.5 border-l-2 border-accent/40 pl-2">
            {children}
          </div>
        </div>
      </div>
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
  const [hover, setHover] = useState(false);
  const [foco, setFoco] = useState(false);
  const cierreRef = useRef<number | null>(null);
  const guiaActiva = useGuiaActiva();
  const { iniciarRecorridoGeneral, iniciarGuiaPantalla } = useGuia();
  const [menuAyudaAbierto, setMenuAyudaAbierto] = useState(false);
  const expandido = hover || foco || guiaActiva || menuAyudaAbierto;

  const cancelarCierre = useCallback(() => {
    if (cierreRef.current != null) {
      window.clearTimeout(cierreRef.current);
      cierreRef.current = null;
    }
  }, []);

  const abrirPorHover = useCallback(() => {
    cancelarCierre();
    setHover(true);
  }, [cancelarCierre]);

  const programarCierre = useCallback(() => {
    cancelarCierre();
    cierreRef.current = window.setTimeout(() => {
      setHover(false);
      setFoco(false);
    }, 240);
  }, [cancelarCierre]);

  const alEnfocar = useCallback(() => {
    setFoco(true);
  }, []);

  const alDesenfocar = useCallback((e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setFoco(false);
    }
  }, []);

  useEffect(() => cancelarCierre, [cancelarCierre]);

  const activeTab = useMemo(() => wsDesdeParam(searchParams.get("ws")), [searchParams]);
  const pv = searchParams.get("pv") ?? "";
  const ftParam = searchParams.get("ft");
  const ft = ftParam === "pendientes" ? "dormidos" : (ftParam ?? "");
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
          if (tab === "finanzas") n.set("fn", "resumen");
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
        | "dormidos"
        | "aprobados"
        | "todos" = "dormidos",
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
    gotoVentasQuery("lista", "todos");
    setPresupuestosMenuAbierto(true);
  }, [gotoVentasQuery]);

  const onPresupuestosSubmenu = useCallback(() => {
    if (activeTab !== "ventas") {
      gotoVentasQuery("lista", "todos");
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
      gotoFinanzasSeccion("resumen");
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
    <div className="relative h-full w-16 shrink-0 self-stretch">
    <aside
      className={cn(
        "absolute inset-y-0 left-0 z-50 flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto border-r border-sidebar-border bg-sidebar [scrollbar-width:thin] [scrollbar-color:oklch(0.34_0.01_60_/_0.22)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-sidebar-foreground/20",
        SIDEBAR_MOTION,
        expandido
          ? "w-60 shadow-[12px_0_28px_-10px_rgba(28,25,23,0.16)]"
          : "w-16 shadow-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
      onMouseEnter={abrirPorHover}
      onMouseLeave={programarCierre}
      onFocusCapture={alEnfocar}
      onBlurCapture={alDesenfocar}
    >
      {/* Brand */}
      <div className="px-2 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex w-12 shrink-0 items-center justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
              <MarmoGestMark className="h-5 w-5 text-accent-foreground" />
            </div>
          </div>
          <span
            aria-hidden={!expandido}
            className={sidebarFadeCn(expandido, "whitespace-nowrap text-lg font-bold tracking-tight text-sidebar-foreground")}
          >
            MarmoGest
          </span>
        </div>
      </div>

      {/* User */}
      <div className="border-y border-sidebar-border px-2 py-4" data-guia="usuario">
        <div className="flex items-center gap-2.5">
          <div className="flex w-12 shrink-0 items-center justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent-foreground">
              {initials}
            </div>
          </div>
          <div aria-hidden={!expandido} className={sidebarFadeCn(expandido, "flex-1")}>
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
      <nav className="flex-1 space-y-0.5 px-2 py-4" data-guia="nav">
        {navItems.map((item) => {
          if (item.id === "ventas") {
            return (
              <ExpandableNavItem
                key={item.id}
                item={item}
                active={activeTab === item.id}
                menuAbierto={presupuestosMenuAbierto}
                expandido={expandido}
                onToggleEncabezado={onPresupuestosEncabezado}
                onToggleSubmenu={onPresupuestosSubmenu}
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
                  onClick={() => gotoVentasQuery("lista", "dormidos")}
                  className={submenuLinkCn(pv !== "nuevo" && ft === "dormidos")}
                >
                  Dormidos
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
                expandido={expandido}
                onToggleEncabezado={onProduccionEncabezado}
                onToggleSubmenu={onProduccionEncabezado}
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
                expandido={expandido}
                onToggleEncabezado={onEquipoEncabezado}
                onToggleSubmenu={onEquipoEncabezado}
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
                expandido={expandido}
                onToggleEncabezado={onFinanzasEncabezado}
                onToggleSubmenu={onFinanzasEncabezado}
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
              data-guia={`nav-${item.id}`}
              onClick={() => gotoWorkspace(item.id)}
              aria-label={!expandido ? item.label : undefined}
              className={cn(
                "flex w-full items-center rounded-xl py-2.5 text-sm font-medium transition-colors",
                activeTab === item.id
                  ? "bg-accent text-accent-foreground"
                  : "text-sidebar-foreground hover:bg-muted",
              )}
            >
              <span className="flex w-12 shrink-0 items-center justify-center">{item.icon}</span>
              <span aria-hidden={!expandido} className={sidebarFadeCn(expandido, "truncate whitespace-nowrap")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-2 border-t border-sidebar-border px-2 py-4">
        <DropdownMenu open={menuAyudaAbierto} onOpenChange={setMenuAyudaAbierto}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-guia="ayuda"
              aria-label={!expandido ? "Guía de uso" : undefined}
              className="flex w-full items-center rounded-xl py-2.5 text-left text-sm font-medium text-sidebar-foreground transition-colors hover:bg-muted"
            >
              <span className="flex w-12 shrink-0 items-center justify-center">
                <CircleHelp className="h-[18px] w-[18px]" />
              </span>
              <span aria-hidden={!expandido} className={sidebarFadeCn(expandido, "whitespace-nowrap")}>
                Guía de uso
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-60">
            <DropdownMenuItem onSelect={() => iniciarRecorridoGeneral()}>
              Ver recorrido general
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => iniciarGuiaPantalla()}>
              Ver guía de esta pantalla
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label={!expandido ? "Cerrar sesión" : undefined}
          className="flex w-full items-center rounded-xl py-2.5 text-left text-sm font-medium text-sidebar-foreground transition-colors hover:bg-muted"
        >
          <span className="flex w-12 shrink-0 items-center justify-center">
            <LogOut className="h-[18px] w-[18px]" />
          </span>
          <span aria-hidden={!expandido} className={sidebarFadeCn(expandido, "whitespace-nowrap")}>
            Cerrar sesión
          </span>
        </button>
        <p
          className={cn(
            "overflow-hidden px-3 text-[11px] text-sidebar-foreground/30 transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            expandido ? "max-h-6 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          Piedra Americana · escritorio
        </p>
      </div>
    </aside>
    </div>
  );
}
