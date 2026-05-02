/**
 * Frontend-Typen + API-Pfad für die `first_views`-Settings.
 *
 * Die Liste enthält View-Slugs (lowercase), die für ein Fahrzeug zuerst auf
 * `correction.correct` (check=2) stehen müssen — oder alternativ bei
 * `inside.correct` (check=0), wenn derselbe Slug zusätzlich als Inside-Ansicht
 * geführt wird — bevor andere Views bearbeitet werden dürfen.
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
 * Prüft, ob alle `first_views` erledigt sind: `correction.correct` (check 2)
 * oder `inside.correct` (check 0). Bei leerer Liste gilt das Fahrzeug als
 * „first views erledigt”.
 */
export function areFirstViewsReady(
  firstViews: Set<string> | readonly string[] | null | undefined,
  statuses: readonly ControllStatusRow[] | null | undefined,
): boolean {
  const set =
    firstViews instanceof Set ? firstViews : makeFirstViewsSet(firstViews);
  if (set.size === 0) return true;
  if (!statuses || statuses.length === 0) return false;

  const corrBy = new Map<string, ControllStatusRow>();
  const insBy = new Map<string, ControllStatusRow>();
  for (const s of statuses) {
    const m = (s.mode ?? "").toLowerCase();
    const k = norm(s.view_token);
    if (m === "correction") corrBy.set(k, s);
    else if (m === "inside") insBy.set(k, s);
  }
  for (const slug of set) {
    const c = corrBy.get(slug);
    const i = insBy.get(slug);
    const corrOk =
      c != null &&
      Number(c.check) === 2 &&
      (c.status ?? "").trim().toLowerCase() === "correct";
    const insOk =
      i != null &&
      Number(i.check) === 0 &&
      (i.status ?? "").trim().toLowerCase() === "correct";
    if (!(corrOk || insOk)) return false;
  }
  return true;
}

/**
 * Ist die **Steuerung** für diesen Slot durch first_views blockiert?
 * (Pflicht-Ansichten noch nicht fertig.) Ansehen / Großansicht bleiben möglich;
 * gemeint sind die Control-Aktionen (Buttons, Kurzbefehle), nicht die Vorschau.
 * Slots aus `firstViews` selbst sind nie so blockiert.
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
