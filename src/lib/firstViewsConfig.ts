/**
 * Frontend-Typen + API-Pfad für die `first_views`-Settings.
 *
 * Die Liste enthält View-Slugs (lowercase), die für ein Fahrzeug zuerst
 * `correction.correct` (check=2) sein müssen, bevor andere Views
 * bearbeitet werden dürfen.
 */

import type { ControllStatusRow } from "./vehicleImageryPublicApi";

export const FIRST_VIEWS_SETTINGS_PATH = "/api/configs/first-views";

export type FirstViewsApiResponse = {
  views: string[];
  _meta?: { source: "database" | "default"; configsBound: boolean };
};

/** Normalisiert einen Slug für den Lookup (lowercase, getrimmt). */
function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Erzeugt ein effizient abfragbares Set aus der first-views-Liste.
 */
export function makeFirstViewsSet(
  views: readonly string[] | null | undefined,
): Set<string> {
  const out = new Set<string>();
  if (!views) return out;
  for (const v of views) {
    const n = norm(v);
    if (n) out.add(n);
  }
  return out;
}

/**
 * Prüft, ob *alle* `first_views` für ein Fahrzeug bereits auf
 * `correction.correct` mit `check === 2` stehen. Wenn die Liste leer ist,
 * gilt das Vehicle als „first views erledigt".
 */
export function areFirstViewsReady(
  firstViews: Set<string> | readonly string[] | null | undefined,
  statuses: readonly ControllStatusRow[] | null | undefined,
): boolean {
  const set =
    firstViews instanceof Set ? firstViews : makeFirstViewsSet(firstViews);
  if (set.size === 0) return true;
  if (!statuses || statuses.length === 0) return false;

  // Index: viewToken (lowercase) → ControllStatusRow für mode=correction
  const byToken = new Map<string, ControllStatusRow>();
  for (const s of statuses) {
    if ((s.mode ?? "").toLowerCase() !== "correction") continue;
    byToken.set(norm(s.view_token), s);
  }
  for (const slug of set) {
    const row = byToken.get(slug);
    if (!row) return false;
    if (Number(row.check) !== 2) return false;
    if ((row.status ?? "").toLowerCase() !== "correct") return false;
  }
  return true;
}

/**
 * Hilft beim Tile-Rendern: ist dieser Slot durch die first-views-Regel
 * blockiert? Slots, die *selbst* in `firstViews` enthalten sind, sind
 * niemals blockiert (sie sind ja diejenigen, die zuerst dran sind).
 */
export function isSlotBlockedByFirstViews(
  firstViews: Set<string> | readonly string[] | null | undefined,
  firstViewsReady: boolean,
  slotSlug: string | null | undefined,
): boolean {
  if (firstViewsReady) return false;
  const set =
    firstViews instanceof Set ? firstViews : makeFirstViewsSet(firstViews);
  if (set.size === 0) return false;
  return !set.has(norm(slotSlug));
}
