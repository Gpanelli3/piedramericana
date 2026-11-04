import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { MainWorkspace } from "./pages/MainWorkspace";
import { PresupuestoPrintPage } from "./pages/PresupuestoPrintPage";
import { HojaTrabajoPrintPage } from "./pages/HojaTrabajoPrintPage";
import { CobrosComprobantePrintPage } from "./pages/CobrosComprobantePrintPage";
import { ObrasCobrosPrintPage } from "./pages/ObrasCobrosPrintPage";
import { OtRotuloPrintPage } from "./pages/OtRotuloPrintPage";
import { RemitoRotulosPrintPage } from "./pages/RemitoRotulosPrintPage";
import { RequireAuth } from "./routes/RequireAuth";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<MainWorkspace />} />
            <Route path="/presupuestos/:id/imprimir" element={<PresupuestoPrintPage />} />
            <Route path="/presupuestos/:id/hoja-trabajo" element={<HojaTrabajoPrintPage />} />
            <Route
              path="/presupuestos/:id/cobros/imprimir"
              element={<CobrosComprobantePrintPage />}
            />
            <Route path="/obras-cobros/imprimir" element={<ObrasCobrosPrintPage />} />
            <Route path="/ordenes-trabajo/:id/rotulo" element={<OtRotuloPrintPage />} />
            <Route path="/remitos/:id/rotulos" element={<RemitoRotulosPrintPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
