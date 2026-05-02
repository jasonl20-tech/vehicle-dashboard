/**
 * AssetsPage — Standalone-Browser für den R2-Bucket `assets`
 * (Custom-Domain `assets.vehicleimagery.com`).
 *
 * Routes: `/dashboard/databases/assets`. Sidebar-Eintrag unter "Datenbanken".
 *
 * Logik liegt komplett in `components/assets/AssetBrowser.tsx`,
 * damit dieselbe UI auch im Email-Builder via `AssetPicker` genutzt
 * werden kann.
 */
import { useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import AssetBrowser from "../components/assets/AssetBrowser";
import type { DashboardOutletContext } from "../components/layout/dashboardOutletContext";

const noopSetHeader: DashboardOutletContext["setHeaderTrailing"] = () => {};

export default function AssetsPage() {
  const ctx = useOutletContext<DashboardOutletContext | undefined>();
  const setHeaderTrailing = ctx?.setHeaderTrailing ?? noopSetHeader;

  useEffect(() => {
    setHeaderTrailing(null);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AssetBrowser mode="manage" />
    </div>
  );
}
