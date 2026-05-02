/**
 * `settings`-Eintrag `first_views` (D1 `configs`) — Liste der Ansichten,
 * die für ein Fahrzeug **zuerst** auf `correction.correct` (check=2) sein
 * müssen, bevor andere Ansichten bearbeitet werden dürfen.
 *
 * Das `config`-Feld kann in mehreren Formen vorliegen:
 *
 * 1. Komma-separierter String:
 *
 *    ```
 *    front,rear,right,left,front_right,front_left,rear_right,rear_left
 *    ```
 *
 * 2. JSON-Array:
 *
 *    ```json
 *    ["front", "rear", "right"]
 *    ```
 *
 * 3. Objekt mit `views`-Array:
 *
 *    ```json
 *    { "views": ["front", "rear"] }
 *    ```
 *
 * Alle Slugs werden auf lowercase getrimmt; Duplikate werden entfernt.
 */

export const FIRST_VIEWS_SETTING_ID = "first_views";

export type FirstViewsConfig = {
  views: string[];
};

export const DEFAULT_FIRST_VIEWS_CONFIG: FirstViewsConfig = { views: [] };

export function normalizeFirstViewsConfig(raw: unknown): FirstViewsConfig {
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

export function parseSettingsConfigColumn(config: unknown): unknown {
  if (config == null) return null;
  if (typeof config === "string") {
    const trimmed = config.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      trimmed.startsWith('"')
    ) {
      try {
        return JSON.parse(trimmed) as unknown;
      } catch {
        /* noop */
      }
    }
    return trimmed;
  }
  if (typeof config === "object") return config;
  return null;
}
