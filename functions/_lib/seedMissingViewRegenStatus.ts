/**
 * Temporärer Bulk-Job: `correction` / `regen_vertex` / check 8 für Fahrzeuge,
 * in deren `views` ein bestimmter Basis-Slug noch nicht vorkommt.
 */

export const SEED_MISSING_VIEW_SLUGS = ["dashboard", "center_console"] as const;
export type SeedMissingViewSlug = (typeof SEED_MISSING_VIEW_SLUGS)[number];

export const STORAGE_TABLE_SEED_MISSING_VIEW =
  "vehicleimagery_controlling_storage";

export function parseSeedMissingViewSlug(
  raw: string | null | undefined,
): SeedMissingViewSlug | null {
  const s = (raw ?? "").trim().toLowerCase();
  if ((SEED_MISSING_VIEW_SLUGS as readonly string[]).includes(s)) {
    return s as SeedMissingViewSlug;
  }
  return null;
}

/** SQL-Ausdruck: normalisierte ;-Tokens aus v.views (lowercase). */
export const WRAPPED_VIEWS_TOKENS_EXPR = `REPLACE(REPLACE(
  ';' || REPLACE(REPLACE(LOWER(TRIM(IFNULL(v.views,''))), char(13), ';'), char(10), ';') || ';',
  '; ',
  ';'
), ' ;', ';')`;

/** `slug` nur aus `parseSeedMissingViewSlug` verwenden — wird in LIKE eingebettet. */
export function sqlWhereVehicleLacksSlugInViews(slug: SeedMissingViewSlug): string {
  const w = WRAPPED_VIEWS_TOKENS_EXPR;
  return `NOT (
  (${w}) LIKE '%;${slug};%'
  OR (${w}) LIKE '%;${slug}#%'
)`;
}

export function sqlCountEligibleMissingView(storageTable: string, slug: SeedMissingViewSlug): string {
  return `
SELECT COUNT(*) AS n
FROM ${storageTable} v
WHERE ${sqlWhereVehicleLacksSlugInViews(slug)}
`;
}

/** Zeilen für Bulk-INSERT mit pro-Fahrzeug berechnetem R2-`key`. */
export function sqlSelectEligibleRowsForMissingView(
  storageTable: string,
  slug: SeedMissingViewSlug,
): string {
  return `
SELECT v.id, v.format, v.resolution, v.marke, v.modell, v.jahr, v.body, v.trim, v.farbe
FROM ${storageTable} v
WHERE ${sqlWhereVehicleLacksSlugInViews(slug)}
`;
}

/** Einzelzeile; slug kommt gebunden (kein String-Interpolation im SQL). */
export const INSERT_OR_IGNORE_MISSING_VIEW_REGEN_ONE = `INSERT OR IGNORE INTO controll_status (vehicle_id, view_token, mode, status, key, updated_at, "check")
VALUES (?, ?, 'correction', 'regen_vertex', ?, datetime('now'), 8)`;
