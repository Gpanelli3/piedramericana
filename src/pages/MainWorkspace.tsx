import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { ConfigWarning } from "@/components/ConfigWarning";
import { Toaster } from "@/components/ui/sonner";
import { VistaAdministracion } from "@/components/vista-administracion";
import { VistaCantera } from "@/components/vista-cantera";
import { VistaProduccion } from "@/components/vista-produccion";
import { VistaStock } from "@/components/vista-stock";
import { VistaVentas } from "@/components/vista-ventas";
import { StockProvider } from "@/contexts/StockContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { WorkspaceTab } from "@/types/workspace";

const KNOWN_WS = new Set<WorkspaceTab>([
  "ventas",
  "administracion",
  "produccion",
  "cantera",
  "stock",
]);

function workspaceDesdeSearchParams(ws: string | null): WorkspaceTab {
  return ws && KNOWN_WS.has(ws as WorkspaceTab) ? (ws as WorkspaceTab) : "ventas";
}

export function MainWorkspace() {
  const [searchParams] = useSearchParams();
  const activeTab = useMemo(
    () => workspaceDesdeSearchParams(searchParams.get("ws")),
    [searchParams],
  );

  return (
    <StockProvider>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
        <Toaster richColors position="top-center" />
        {!isSupabaseConfigured && <ConfigWarning />}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <AppSidebar />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {activeTab === "ventas" && <VistaVentas />}
            {activeTab === "produccion" && <VistaProduccion />}
            {activeTab === "cantera" && <VistaCantera />}
            {activeTab === "stock" && <VistaStock />}
            {activeTab === "administracion" && <VistaAdministracion />}
          </div>
        </div>
      </div>
    </StockProvider>
  );
}
