import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import AnalyticsPage from "./pages/AnalyticsPage";
import LoginPage from "./pages/LoginPage";
import ModulePage from "./pages/ModulePage";
import OverviewPage from "./pages/OverviewPage";
import SettingsPage from "./pages/SettingsPage";

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
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/zahlungslinks" element={<ModulePage />} />
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
