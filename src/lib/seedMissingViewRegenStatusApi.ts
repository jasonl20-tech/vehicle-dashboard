/**
 * Temporär: Vorschau (GET) und Bulk (POST) für fehlende Ansichten in `views`.
 */

export const SEED_MISSING_VIEW_SLUGS = ["dashboard", "center_console"] as const;
export type SeedMissingViewSlug = (typeof SEED_MISSING_VIEW_SLUGS)[number];

export const SEED_MISSING_VIEW_REGEN_STATUS_PATH =
  "/api/system/seed-missing-view-regen-status";

export type SeedMissingViewPreviewResponse = {
  slug: string;
  eligibleVehicleCount: number;
};

export type SeedMissingViewPostResponse = {
  slug: string;
  inserted: number;
  eligibleVehicleCount: number;
};

export async function getSeedMissingViewRegenPreview(
  slug: SeedMissingViewSlug,
): Promise<SeedMissingViewPreviewResponse> {
  const u = new URL(SEED_MISSING_VIEW_REGEN_STATUS_PATH, window.location.origin);
  u.searchParams.set("slug", slug);
  const res = await fetch(u.toString(), { credentials: "include" });
  const j = (await res.json().catch(() => ({}))) as
    | SeedMissingViewPreviewResponse
    | { error?: string; detail?: string };
  if (!res.ok) {
    const e = j as { error?: string; detail?: string };
    const parts: string[] = [];
    parts.push(e.error || `HTTP ${res.status}`);
    if (e.detail) parts.push(e.detail);
    throw new Error(parts.join(" • "));
  }
  return j as SeedMissingViewPreviewResponse;
}

export async function postSeedMissingViewRegenStatus(
  slug: SeedMissingViewSlug,
): Promise<SeedMissingViewPostResponse> {
  const res = await fetch(SEED_MISSING_VIEW_REGEN_STATUS_PATH, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
  });
  const j = (await res.json().catch(() => ({}))) as
    | SeedMissingViewPostResponse
    | { error?: string; detail?: string };
  if (!res.ok) {
    const e = j as { error?: string; detail?: string };
    const parts: string[] = [];
    parts.push(e.error || `HTTP ${res.status}`);
    if (e.detail) parts.push(e.detail);
    throw new Error(parts.join(" • "));
  }
  return j as SeedMissingViewPostResponse;
}
