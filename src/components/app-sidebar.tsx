import type { ReactNode } from "react";
import { FileText, LayoutDashboard, Mountain, Package, Wallet, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type { WorkspaceTab } from "@/types/workspace";

interface AppSidebarProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
}

const navItems: { id: WorkspaceTab; label: string; icon: ReactNode; color: string }[] = [
  {
    id: "ventas",
    label: "Presupuestos",
    icon: <FileText className="h-5 w-5" />,
    color: "text-red-400",
  },
  {
    id: "administracion",
    label: "Ventas",
    icon: <Wallet className="h-5 w-5" />,
    color: "text-purple-400",
  },
  {
    id: "produccion",
    label: "Producción",
    icon: <Wrench className="h-5 w-5" />,
    color: "text-green-400",
  },
  {
    id: "cantera",
    label: "Cantera",
    icon: <Mountain className="h-5 w-5" />,
    color: "text-sky-400",
  },
  {
    id: "stock",
    label: "Stock",
    icon: <Package className="h-5 w-5" />,
    color: "text-yellow-400",
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

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const { user, signOut } = useAuth();
  const meta = user?.user_metadata as { full_name?: string } | undefined;
  const displayName = meta?.full_name?.trim() || user?.email?.split("@")[0] || "Usuario";
  const initials = initialsFromUser(user?.email, meta?.full_name);

  return (
    <aside className="flex h-full min-h-0 w-56 shrink-0 flex-col self-stretch bg-sidebar">
      <div className="border-b border-sidebar-border px-5 py-5">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-accent" />
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
            MarmoGest
          </span>
        </div>
      </div>

      <div className="border-b border-sidebar-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-bold text-sidebar-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</p>
            <p className="flex items-center gap-1 text-xs text-green-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
              Sesión Supabase
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
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
              <span
                className={cn("ml-auto h-2 w-2 rounded-full", item.color.replace("text-", "bg-"))}
              />
            )}
          </button>
        ))}
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
