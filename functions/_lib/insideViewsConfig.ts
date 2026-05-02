/**
 * `settings`-Eintrag `inside_views` (D1 `configs`) — kommaseparierte Liste
 * von Basis-Slugs. Im Korrektur-Flow wird `controll_status` für diese
 * Ansichten mit `mode = 'inside'` geschrieben (z. B. `correct` bei `check = 0`).
 *
 * Parsing wie bei `first_views` (`firstViewsConfig`).
 */

export const INSIDE_VIEWS_SETTING_ID = "inside_views";

export type InsideViewsConfig = {
  views: string[];
};

export const DEFAULT_INSIDE_VIEWS_CONFIG: InsideViewsConfig = { views: [] };

export function normalizeInsideViewsConfig(raw: unknown): InsideViewsConfig {
  let arr: string[] = [];
  if (typeof raw === "string") {
    arr = raw.split(",");
  } else if (Array.isArray(raw)) {
    arr = raw.map((v) => (typeof v === "string" ? v : ""));
  } else if (raw && typeof raw === "object") {
    const v = (raw as Record<string, unknown>).views;
    if (Array.isArray(v)) {
      arr = v.map((x) => (typeof x === "string" ? x : ""));
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const slug = v.trim().toLowerCase();
    if (!slug) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return { views: out };
}
