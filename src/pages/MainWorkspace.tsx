import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { ConfigWarning } from "@/components/ConfigWarning";
import { Toaster } from "@/components/ui/sonner";
import { VistaDashboard } from "@/components/vista-dashboard";
import { VistaAdministracion } from "@/components/vista-administracion";
import { VistaFinanzas } from "@/components/vista-finanzas";
import { VistaArticulos } from "@/components/vista-articulos";
import { VistaCantera } from "@/components/vista-cantera";
import { VistaProduccionShell } from "@/components/vista-produccion-shell";
import { VistaStock } from "@/components/vista-stock";
import { VistaVentas } from "@/components/vista-ventas";
import { VistaModuloPendiente } from "@/components/vista-modulo-pendiente";
import { VistaClientes } from "@/components/vista-clientes";
import { VistaProveedores } from "@/components/vista-proveedores";
import { VistaEquipo } from "@/components/vista-equipo";
import { VistaReportes } from "@/components/vista-reportes";
import { VistaComercioExterior } from "@/components/vista-comercio-exterior";
import { StockProvider } from "@/contexts/StockContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { WORKSPACE_TABS, type WorkspaceTab } from "@/types/workspace";
import { Settings } from "lucide-react";

const KNOWN_WS = new Set<WorkspaceTab>(WORKSPACE_TABS);

function workspaceDesdeSearchParams(ws: string | null): WorkspaceTab {
  return ws && KNOWN_WS.has(ws as WorkspaceTab) ? (ws as WorkspaceTab) : "dashboard";
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
            {activeTab === "dashboard" && <VistaDashboard />}
            {activeTab === "ventas" && <VistaVentas />}
            {activeTab === "clientes" && <VistaClientes />}
            {activeTab === "articulos" && <VistaArticulos />}
            {activeTab === "produccion" && <VistaProduccionShell />}
            {activeTab === "cantera" && <VistaCantera />}
            {activeTab === "stock" && <VistaStock />}
            {activeTab === "proveedores" && <VistaProveedores />}
            {activeTab === "comercio_exterior" && <VistaComercioExterior />}
            {activeTab === "administracion" && <VistaAdministracion />}
            {activeTab === "finanzas" && <VistaFinanzas />}
            {activeTab === "equipo" && <VistaEquipo />}
            {activeTab === "reportes" && <VistaReportes />}
            {activeTab === "configuracion" && (
              <VistaModuloPendiente
                titulo="Configuración"
                resumen="Usuarios, roles, datos de la empresa y parámetros del flujo."
                icono={Settings}
              />
            )}
          </div>
        </div>
      </div>
    </StockProvider>
  );
}
