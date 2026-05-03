/**
 * Temporärer Bulk-Endpunkt: Dashboard-regen_vertex (check 8) für Fahrzeuge
 * ohne Dashboard in `views`. Siehe Functions `seed-dashboard-regen-status`.
 */

export const SEED_DASHBOARD_REGEN_STATUS_PATH =
  "/api/system/seed-dashboard-regen-status";

export type SeedDashboardRegenStatusResponse = {
  inserted: number;
};

export async function postSeedDashboardRegenStatus(): Promise<SeedDashboardRegenStatusResponse> {
  const res = await fetch(SEED_DASHBOARD_REGEN_STATUS_PATH, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const j = (await res.json().catch(() => ({}))) as
    | SeedDashboardRegenStatusResponse
    | { error?: string; detail?: string };
  if (!res.ok) {
    const e = j as { error?: string; detail?: string };
    const parts: string[] = [];
    parts.push(e.error || `HTTP ${res.status}`);
    if (e.detail) parts.push(e.detail);
    throw new Error(parts.join(" • "));
  }
  return j as SeedDashboardRegenStatusResponse;
}
