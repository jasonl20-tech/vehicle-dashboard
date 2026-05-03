import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import MfaForcedSetupGate from "./components/auth/MfaForcedSetupGate";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AccountLayout from "./components/layout/AccountLayout";
import ControlPlatformLayout from "./components/layout/ControlPlatformLayout";
import DashboardLayout from "./components/layout/DashboardLayout";
import AccountPage from "./pages/AccountPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AnfragenKartePage from "./pages/AnfragenKartePage";
import AnfragenPage from "./pages/AnfragenPage";
import AssetsPage from "./pages/AssetsPage";
import BildaustrahlungKartePage from "./pages/BildaustrahlungKartePage";
import BildempfangPage from "./pages/BildempfangPage";
import ControllingPage from "./pages/ControllingPage";
import ControllJobsPage from "./pages/ControllJobsPage";
import ControlPlatformPage from "./pages/ControlPlatformPage";
import DeveloperOverviewPage from "./pages/DeveloperOverviewPage";
import EmailLogDetailPage from "./pages/EmailLogDetailPage";
import EmailLogsPage from "./pages/EmailLogsPage";
import EmailManuellPage from "./pages/EmailManuellPage";
import EmailTemplatesPage from "./pages/EmailTemplatesPage";
import EmailTrackingPage from "./pages/EmailTrackingPage";
import ExternalRedirectPage from "./pages/ExternalRedirectPage";
import KundenApiPage from "./pages/KundenApiPage";
import KundenCrmPage from "./pages/KundenCrmPage";
import KundenKeysPage, { KundenTestKeysPage } from "./pages/KundenKeysPage";
import LoginPage from "./pages/LoginPage";
import ModulePage from "./pages/ModulePage";
import NewsletterPage from "./pages/NewsletterPage";
import OneautoApiPage from "./pages/OneautoApiPage";
import OneautoReportsPage from "./pages/OneautoReportsPage";
import OverviewPage from "./pages/OverviewPage";
import PlatformHomePage from "./pages/PlatformHomePage";
import ProductionDatabasePage from "./pages/ProductionDatabasePage";
import ProductionImagesPage from "./pages/ProductionImagesPage";
import ProductionVehicleDetailPage from "./pages/ProductionVehicleDetailPage";
import SystemeBlockedVehiclesPage from "./pages/SystemeBlockedVehiclesPage";
import SystemeMappingPage from "./pages/SystemeMappingPage";
import SystemePromptsPage from "./pages/SystemePromptsPage";
import VehicleDatabaseStatusPage from "./pages/VehicleDatabaseStatusPage";
import ZahlungenPlaenePage from "./pages/ZahlungenPlaenePage";
import ZahlungenZahlungslinksPage from "./pages/ZahlungenZahlungslinksPage";

export default function App() {
  return (
    <>
      {/*
       * Globaler Sicherheits-Gate: bei `mfa.requireTotp && !mfa.totpEnabled`
       * (Spalte `user.require_2fa = 1` ohne TOTP-Setup) erscheint ein
       * blockierendes Modal über allem, das durch das Authenticator-Setup
       * führt. Bestätigt dies, wird `refresh()` ausgeführt.
       */}
      <MfaForcedSetupGate />

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
          <Route path="/developer" element={<DeveloperOverviewPage />} />

          <Route element={<ControlPlatformLayout />}>
            <Route
              path="/control-platform"
              element={<ControlPlatformPage />}
            />
          </Route>

          <Route
            path="/n8n"
            element={
              <ExternalRedirectPage href="https://n8n.vehicleimagery.com" />
            }
          />
          <Route
            path="/socialmediamanager"
            element={
              <ExternalRedirectPage href="https://publish.buffer.com/schedule?tab=approvals" />
            }
          />
          <Route
            path="/docusign"
            element={
              <ExternalRedirectPage href="https://app-eu.boldsign.com/dashboard" />
            }
          />

          {/*
           * User-Settings (Sicherheit / 2FA / Profil) bewusst NICHT unter
           * /dashboard, sondern auf eigener Top-Level-Route mit eigenem
           * schlankem Layout.
           */}
          <Route path="/account" element={<AccountLayout />}>
            <Route index element={<AccountPage />} />
          </Route>

          <Route path="/admin-settings" element={<AdminSettingsPage />} />

          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            <Route
              path="ansichten"
              element={<Navigate to="bildaustrahlung" replace />}
            />
            <Route
              path="ansichten/bildaustrahlung"
              element={<BildaustrahlungKartePage />}
            />
            <Route path="ansichten/bildempfang" element={<BildempfangPage />} />
            <Route
              path="ansichten/anfragen-karte"
              element={<AnfragenKartePage />}
            />
            <Route path="leads" element={<ModulePage />} />
            <Route path="kunden/crm" element={<KundenCrmPage />} />
            <Route path="kunden/anfragen" element={<AnfragenPage />} />
            <Route
              path="kunden/test-anfragen"
              element={<AnfragenPage variant="trial" />}
            />
            <Route path="kunden/keys/:key" element={<KundenKeysPage />} />
            <Route path="kunden/keys" element={<KundenKeysPage />} />
            <Route
              path="kunden/test-keys/:key"
              element={<KundenTestKeysPage />}
            />
            <Route path="kunden/test-keys" element={<KundenTestKeysPage />} />
            <Route path="kunden/newsletter" element={<NewsletterPage />} />
            <Route
              path="kunden"
              element={<Navigate to="anfragen" replace />}
            />
            <Route path="systeme/prompts" element={<SystemePromptsPage />} />
            <Route
              path="systeme/blockierte-fahrzeuge"
              element={<SystemeBlockedVehiclesPage />}
            />
            <Route path="systeme/mapping" element={<SystemeMappingPage />} />
            <Route
              path="systeme"
              element={<Navigate to="prompts" replace />}
            />
            <Route
              path="logs"
              element={<Navigate to="skalierungs-worker" replace />}
            />
            <Route path="logs/skalierungs-worker" element={<ModulePage />} />
            <Route path="logs/generierungs-worker" element={<ModulePage />} />
            <Route path="analytics/kunden-api" element={<KundenApiPage />} />
            <Route path="analytics/oneauto-api" element={<OneautoApiPage />} />
            <Route
              path="analytics/oneauto-reports"
              element={<OneautoReportsPage />}
            />
            <Route
              path="analytics"
              element={<Navigate to="kunden-api" replace />}
            />
            <Route
              path="intern-analytics/controlling"
              element={<ControllingPage />}
            />
            <Route
              path="intern-analytics/jobs"
              element={<ControllJobsPage />}
            />
            <Route
              path="intern-analytics"
              element={<Navigate to="controlling" replace />}
            />
            <Route path="zahlungen">
              <Route index element={<Navigate to="zahlungslinks" replace />} />
              <Route
                path="zahlungslinks"
                element={<ZahlungenZahlungslinksPage />}
              />
              <Route path="plaene" element={<ZahlungenPlaenePage />} />
            </Route>
            <Route
              path="emails"
              element={<Navigate to="templates" replace />}
            />
            <Route path="emails/logs" element={<EmailLogsPage />} />
            <Route path="emails/logs/:id" element={<EmailLogDetailPage />} />
            <Route path="emails/tracking" element={<EmailTrackingPage />} />
            <Route path="emails/templates" element={<EmailTemplatesPage />} />
            <Route path="emails/sending" element={<EmailManuellPage />} />
            <Route
              path="emails/manuell"
              element={<Navigate to="sending" replace />}
            />
            <Route path="emails/automator" element={<ModulePage />} />
            <Route path="website/blogs" element={<ModulePage />} />
            <Route path="website/landing-pages" element={<ModulePage />} />
            <Route path="website/faq" element={<ModulePage />} />
            <Route path="website/tutorials" element={<ModulePage />} />
            <Route path="website/whitepaper" element={<ModulePage />} />
            <Route path="website/company" element={<ModulePage />} />
            <Route path="website/changelog" element={<ModulePage />} />
            <Route
              path="databases/production/:id"
              element={<ProductionVehicleDetailPage />}
            />
            <Route
              path="databases/production"
              element={<ProductionDatabasePage />}
            />
            <Route path="databases/assets" element={<AssetsPage />} />
            <Route
              path="databases/production-images"
              element={<ProductionImagesPage />}
            />
            <Route
              path="databases/status"
              element={<VehicleDatabaseStatusPage />}
            />
            <Route
              path="databases"
              element={<Navigate to="production" replace />}
            />
            {/* User-Settings sind ab sofort unter /account erreichbar. */}
            <Route
              path="settings"
              element={<Navigate to="/account" replace />}
            />
          </Route>

          {/*
           * Legacy-Aliasse: alte Top-Level-Pfade auf neue Dashboard-Pfade
           * umleiten, damit Bookmarks und externe Links nicht abrupt brechen.
           */}
          <Route
            path="/anfragen"
            element={<Navigate to="/dashboard/kunden/anfragen" replace />}
          />
          <Route
            path="/newsletter"
            element={<Navigate to="/dashboard/kunden/newsletter" replace />}
          />
          <Route
            path="/zahlungslinks"
            element={
              <Navigate to="/dashboard/zahlungen/zahlungslinks" replace />
            }
          />
          <Route
            path="/settings"
            element={<Navigate to="/account" replace />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
