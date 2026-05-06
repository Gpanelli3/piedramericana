import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ConfigWarning } from "@/components/ConfigWarning";
import { VistaAdministracion } from "@/components/vista-administracion";
import { VistaProduccion } from "@/components/vista-produccion";
import { VistaStock } from "@/components/vista-stock";
import { VistaVentas } from "@/components/vista-ventas";
import type { WorkspaceTab } from "@/types/workspace";

export function MainWorkspace() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("ventas");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ConfigWarning />
      <div className="flex min-h-0 flex-1">
        <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex flex-1 flex-col overflow-hidden">
          {activeTab === "ventas" && <VistaVentas />}
          {activeTab === "produccion" && <VistaProduccion />}
          {activeTab === "stock" && <VistaStock />}
          {activeTab === "administracion" && <VistaAdministracion />}
        </div>
      </div>
    </div>
  );
}
