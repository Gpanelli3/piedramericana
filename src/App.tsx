import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { MainWorkspace } from "./pages/MainWorkspace";
import { PresupuestoPrintPage } from "./pages/PresupuestoPrintPage";
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
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
