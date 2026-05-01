import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import KundenApiPage from "./pages/KundenApiPage";
import KundenKeysPage, { KundenTestKeysPage } from "./pages/KundenKeysPage";
import ControllJobsPage from "./pages/ControllJobsPage";
import ControllingPage from "./pages/ControllingPage";
import LoginPage from "./pages/LoginPage";
import ModulePage from "./pages/ModulePage";
import OneautoApiPage from "./pages/OneautoApiPage";
import OneautoReportsPage from "./pages/OneautoReportsPage";
import PlatformHomePage from "./pages/PlatformHomePage";
import AnfragenKartePage from "./pages/AnfragenKartePage";
import BildaustrahlungKartePage from "./pages/BildaustrahlungKartePage";
import BildempfangPage from "./pages/BildempfangPage";
import OverviewPage from "./pages/OverviewPage";
import SettingsPage from "./pages/SettingsPage";
import SystemePromptsPage from "./pages/SystemePromptsPage";
import SystemeBlockedVehiclesPage from "./pages/SystemeBlockedVehiclesPage";
import SystemeMappingPage from "./pages/SystemeMappingPage";
import KundenCrmPage from "./pages/KundenCrmPage";
import AnfragenPage from "./pages/AnfragenPage";
import EmailTemplatesPage from "./pages/EmailTemplatesPage";
import EmailLogDetailPage from "./pages/EmailLogDetailPage";
import EmailLogsPage from "./pages/EmailLogsPage";
import EmailManuellPage from "./pages/EmailManuellPage";
import EmailTrackingPage from "./pages/EmailTrackingPage";
import NewsletterPage from "./pages/NewsletterPage";
import AssetsPage from "./pages/AssetsPage";
import ProductionDatabasePage from "./pages/ProductionDatabasePage";
import ProductionImagesPage from "./pages/ProductionImagesPage";
import ProductionVehicleDetailPage from "./pages/ProductionVehicleDetailPage";
import VehicleDatabaseStatusPage from "./pages/VehicleDatabaseStatusPage";
import ZahlungenPlaenePage from "./pages/ZahlungenPlaenePage";
import ZahlungenZahlungslinksPage from "./pages/ZahlungenZahlungslinksPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Outlet />
          </ProtectedRoute>
        }
      >
        <Route index element={<PlatformHomePage />} />
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<OverviewPage />} />
          <Route
            path="/ansichten"
            element={<Navigate to="/ansichten/bildaustrahlung" replace />}
          />
          <Route
            path="/ansichten/bildaustrahlung"
            element={<BildaustrahlungKartePage />}
          />
          <Route path="/ansichten/bildempfang" element={<BildempfangPage />} />
          <Route
            path="/ansichten/anfragen-karte"
            element={<AnfragenKartePage />}
          />
          <Route path="/leads" element={<ModulePage />} />
          <Route path="/kunden/crm" element={<KundenCrmPage />} />
          <Route path="/kunden/anfragen" element={<AnfragenPage />} />
          <Route
            path="/kunden/test-anfragen"
            element={<AnfragenPage variant="trial" />}
          />
          <Route path="/kunden/keys/:key" element={<KundenKeysPage />} />
          <Route path="/kunden/keys" element={<KundenKeysPage />} />
          <Route path="/kunden/test-keys/:key" element={<KundenTestKeysPage />} />
          <Route path="/kunden/test-keys" element={<KundenTestKeysPage />} />
          <Route path="/kunden/newsletter" element={<NewsletterPage />} />
          <Route
            path="/kunden"
            element={<Navigate to="/kunden/anfragen" replace />}
          />
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
          <Route
            path="/logs"
            element={<Navigate to="/logs/skalierungs-worker" replace />}
          />
          <Route path="/logs/skalierungs-worker" element={<ModulePage />} />
          <Route path="/logs/generierungs-worker" element={<ModulePage />} />
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
          <Route path="/intern-analytics/jobs" element={<ControllJobsPage />} />
          <Route
            path="/intern-analytics"
            element={<Navigate to="/intern-analytics/controlling" replace />}
          />
          <Route path="/zahlungen" element={<Outlet />}>
            <Route index element={<Navigate to="zahlungslinks" replace />} />
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
          <Route
            path="/emails"
            element={<Navigate to="/emails/templates" replace />}
          />
          <Route path="/emails/logs" element={<EmailLogsPage />} />
          <Route path="/emails/logs/:id" element={<EmailLogDetailPage />} />
          <Route path="/emails/tracking" element={<EmailTrackingPage />} />
          <Route path="/emails/templates" element={<EmailTemplatesPage />} />
          <Route path="/emails/sending" element={<EmailManuellPage />} />
          <Route
            path="/emails/manuell"
            element={<Navigate to="/emails/sending" replace />}
          />
          <Route path="/emails/automator" element={<ModulePage />} />
          <Route path="/website/blogs" element={<ModulePage />} />
          <Route path="/website/landing-pages" element={<ModulePage />} />
          <Route path="/website/faq" element={<ModulePage />} />
          <Route path="/website/tutorials" element={<ModulePage />} />
          <Route path="/website/whitepaper" element={<ModulePage />} />
          <Route path="/website/company" element={<ModulePage />} />
          <Route path="/website/changelog" element={<ModulePage />} />
          <Route
            path="/databases/production/:id"
            element={<ProductionVehicleDetailPage />}
          />
          <Route
            path="/databases/production"
            element={<ProductionDatabasePage />}
          />
          <Route path="/databases/assets" element={<AssetsPage />} />
          <Route
            path="/databases/production-images"
            element={<ProductionImagesPage />}
          />
          <Route
            path="/databases/status"
            element={<VehicleDatabaseStatusPage />}
          />
          <Route
            path="/databases"
            element={<Navigate to="/databases/production" replace />}
          />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
