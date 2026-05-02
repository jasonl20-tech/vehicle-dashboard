/**
 * Frontend: `inside_views`-Settings (`settings.id = inside_views`).
 * Slugs dort werden im Korrektur-Flow mit `mode: inside` geschrieben
 * („richtig“ = `correct` bei `check: 0`).
 */

export const INSIDE_VIEWS_SETTINGS_PATH = "/api/configs/inside-views";

export type InsideViewsApiResponse = {
  views: string[];
  _meta?: { source: "database" | "default"; configsBound: boolean };
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Komma-/Listen-Slugs → Set für Lookup. */
export function makeInsideViewsSet(
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
