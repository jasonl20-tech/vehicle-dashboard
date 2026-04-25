import { Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "./components/layout/DashboardLayout";
import AnalyticsPage from "./pages/AnalyticsPage";
import OverviewPage from "./pages/OverviewPage";
import FleetPage from "./pages/FleetPage";
import TripsPage from "./pages/TripsPage";
import MaintenancePage from "./pages/MaintenancePage";
import DriversPage from "./pages/DriversPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<Navigate to="/analytics" replace />} />
        <Route path="/dashboard" element={<OverviewPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/fleet" element={<FleetPage />} />
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/drivers" element={<DriversPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/analytics" replace />} />
      </Route>
    </Routes>
  );
}
