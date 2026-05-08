import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ConfigWarning } from "@/components/ConfigWarning";
import { Toaster } from "@/components/ui/sonner";
import { VistaAdministracion } from "@/components/vista-administracion";
import { VistaProduccion } from "@/components/vista-produccion";
import { VistaStock } from "@/components/vista-stock";
import { VistaVentas } from "@/components/vista-ventas";
import { StockProvider } from "@/contexts/StockContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { WorkspaceTab } from "@/types/workspace";

export function MainWorkspace() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("ventas");

  return (
    <StockProvider>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
        <Toaster richColors position="top-center" />
        {!isSupabaseConfigured && <ConfigWarning />}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {activeTab === "ventas" && <VistaVentas />}
            {activeTab === "produccion" && <VistaProduccion />}
            {activeTab === "stock" && <VistaStock />}
            {activeTab === "administracion" && <VistaAdministracion />}
          </div>
        </div>
      </div>
    </StockProvider>
  );
}
