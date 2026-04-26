import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import KundenApiPage from "./pages/KundenApiPage";
import KundenKeyDetailPage from "./pages/KundenKeyDetailPage";
import KundenKeysPage, { KundenTestKeysPage } from "./pages/KundenKeysPage";
import ControllJobsPage from "./pages/ControllJobsPage";
import ControllingPage from "./pages/ControllingPage";
import LoginPage from "./pages/LoginPage";
import ModulePage from "./pages/ModulePage";
import OneautoApiPage from "./pages/OneautoApiPage";
import OneautoReportsPage from "./pages/OneautoReportsPage";
import OverviewPage from "./pages/OverviewPage";
import SettingsPage from "./pages/SettingsPage";
import SystemePromptsPage from "./pages/SystemePromptsPage";
import SystemeBlockedVehiclesPage from "./pages/SystemeBlockedVehiclesPage";
import SystemeMappingPage from "./pages/SystemeMappingPage";
import ProductionDatabasePage from "./pages/ProductionDatabasePage";
import ZahlungenPlaenePage from "./pages/ZahlungenPlaenePage";
import ZahlungenZahlungslinksPage from "./pages/ZahlungenZahlungslinksPage";

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
        <Route path="/kunden/crm" element={<ModulePage />} />
        <Route path="/kunden/anfragen" element={<ModulePage />} />
        <Route path="/kunden/keys/:key" element={<KundenKeyDetailPage />} />
        <Route path="/kunden/keys" element={<KundenKeysPage />} />
        <Route path="/kunden/test-keys/:key" element={<KundenKeyDetailPage />} />
        <Route path="/kunden/test-keys" element={<KundenTestKeysPage />} />
        <Route path="/kunden/newsletter" element={<ModulePage />} />
        <Route
          path="/kunden"
          element={<Navigate to="/kunden/anfragen" replace />}
        />
        <Route path="/crm" element={<Navigate to="/kunden/crm" replace />} />
        <Route
          path="/anfragen"
          element={<Navigate to="/kunden/anfragen" replace />}
        />
        <Route
          path="/newsletter"
          element={<Navigate to="/kunden/newsletter" replace />}
        />
        <Route path="/systeme/prompts" element={<SystemePromptsPage />} />
        <Route
          path="/systeme/blockierte-fahrzeuge"
          element={<SystemeBlockedVehiclesPage />}
        />
        <Route path="/systeme/mapping" element={<SystemeMappingPage />} />
        <Route
          path="/systeme"
          element={<Navigate to="/systeme/prompts" replace />}
        />
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
        <Route
          path="/intern-analytics/controlling"
          element={<ControllingPage />}
        />
        <Route
          path="/intern-analytics/jobs"
          element={<ControllJobsPage />}
        />
        <Route
          path="/intern-analytics"
          element={<Navigate to="/intern-analytics/controlling" replace />}
        />
        <Route path="/zahlungen" element={<Outlet />}>
          <Route
            index
            element={<Navigate to="zahlungslinks" replace />}
          />
          <Route
            path="zahlungslinks"
            element={<ZahlungenZahlungslinksPage />}
          />
          <Route path="plaene" element={<ZahlungenPlaenePage />} />
        </Route>
        <Route
          path="/zahlungslinks"
          element={<Navigate to="/zahlungen/zahlungslinks" replace />}
        />
        <Route path="/website/blogs" element={<ModulePage />} />
        <Route path="/website/landing-pages" element={<ModulePage />} />
        <Route path="/website/faq" element={<ModulePage />} />
        <Route path="/website/tutorials" element={<ModulePage />} />
        <Route path="/website/whitepaper" element={<ModulePage />} />
        <Route path="/website/company" element={<ModulePage />} />
        <Route path="/website/changelog" element={<ModulePage />} />
        <Route
          path="/databases/production"
          element={<ProductionDatabasePage />}
        />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
