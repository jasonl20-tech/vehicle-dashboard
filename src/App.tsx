import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import KundenApiPage from "./pages/KundenApiPage";
import LoginPage from "./pages/LoginPage";
import ModulePage from "./pages/ModulePage";
import OneautoApiPage from "./pages/OneautoApiPage";
import OneautoReportsPage from "./pages/OneautoReportsPage";
import OverviewPage from "./pages/OverviewPage";
import SettingsPage from "./pages/SettingsPage";
import ZahlungenPage from "./pages/ZahlungenPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<OverviewPage />} />
        <Route path="/crm" element={<ModulePage />} />
        <Route path="/anfragen" element={<ModulePage />} />
        <Route path="/logs" element={<ModulePage />} />
        <Route path="/analytics/kunden-api" element={<KundenApiPage />} />
        <Route path="/analytics/oneauto-api" element={<OneautoApiPage />} />
        <Route
          path="/analytics/oneauto-reports"
          element={<OneautoReportsPage />}
        />
        <Route
          path="/analytics"
          element={<Navigate to="/analytics/kunden-api" replace />}
        />
        <Route path="/zahlungen" element={<ZahlungenPage />} />
        <Route
          path="/zahlungslinks"
          element={<Navigate to="/zahlungen" replace />}
        />
        <Route path="/website/blogs" element={<ModulePage />} />
        <Route path="/website/landing-pages" element={<ModulePage />} />
        <Route path="/website/faq" element={<ModulePage />} />
        <Route path="/website/tutorials" element={<ModulePage />} />
        <Route path="/website/whitepaper" element={<ModulePage />} />
        <Route path="/website/company" element={<ModulePage />} />
        <Route path="/website/changelog" element={<ModulePage />} />
        <Route path="/databases/production" element={<ModulePage />} />
        <Route path="/newsletter" element={<ModulePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
