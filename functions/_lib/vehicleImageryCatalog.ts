/**
 * Lese-API für D1: vehicleimagery_public_storage (nur SELECT).
 * Keine Schreib- oder DDL-Operationen.
 */

const TABLE = "vehicleimagery_public_storage";

const DISTINCT_TEXT_COLS = [
  "marke",
  "modell",
  "body",
  "trim",
  "farbe",
  "resolution",
  "format",
] as const;

export type VehicleImageryTextColumn = (typeof DISTINCT_TEXT_COLS)[number];

export type VehicleImageryFilter = {
  marke?: string;
  modell?: string;
};

type BindValue = string | number;

export function buildVehicleImageryWhereClause(
  baseFilter: VehicleImageryFilter,
): { clause: string; binds: BindValue[] } {
  const parts = ["active = 1"];
  const binds: BindValue[] = [];
  if (baseFilter.marke) {
    parts.push("marke = ?");
    binds.push(baseFilter.marke);
  }
  if (baseFilter.modell) {
    parts.push("modell = ?");
    binds.push(baseFilter.modell);
  }
  return { clause: parts.join(" AND "), binds };
}

/** Einzelne Kamera-/Ansichtsnamen aus dem Feld `views` (z. B. "right#trp" → "right"). */
export function parseViewNamesFromViewsField(views: string | null): string[] {
  if (views == null || views.trim() === "") return [];
  const set = new Set<string>();
  for (const seg of views.split(";")) {
    const t = seg.trim();
    if (!t) continue;
    const name = t.split("#")[0]?.trim() ?? "";
    if (name) set.add(name);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "de"));
}

/**
 * Sammelt alle vorkommenden Ansichtsnamen (Teil vor `#` pro Segment), nur SELECT auf `views`.
 */
export async function collectDistinctViewAngles(
  db: D1Database,
  whereClause: string,
  binds: BindValue[],
): Promise<string[]> {
  const sql = `SELECT views FROM ${TABLE} WHERE ${whereClause} AND views IS NOT NULL AND views != ''`;
  const res = await db
    .prepare(sql)
    .bind(...binds)
    .all<{ views: string }>();
  const merged = new Set<string>();
  for (const r of res.results ?? []) {
    for (const v of parseViewNamesFromViewsField(r.views)) {
      merged.add(v);
    }
  }
  return [...merged].sort((a, b) => a.localeCompare(b, "de"));
}

export async function selectDistinctText(
  db: D1Database,
  column: VehicleImageryTextColumn,
  whereClause: string,
  binds: BindValue[],
): Promise<string[]> {
  const sql = `SELECT DISTINCT ${column} AS v FROM ${TABLE} WHERE ${whereClause} AND ${column} IS NOT NULL AND ${column} != '' ORDER BY ${column} COLLATE NOCASE`;
  const res = await db
    .prepare(sql)
    .bind(...binds)
    .all<{ v: string }>();
  return (res.results ?? []).map((r) => r.v);
}

export async function selectDistinctJahre(
  db: D1Database,
  whereClause: string,
  binds: BindValue[],
): Promise<number[]> {
  const sql = `SELECT DISTINCT jahr AS j FROM ${TABLE} WHERE ${whereClause} AND jahr IS NOT NULL ORDER BY jahr`;
  const res = await db
    .prepare(sql)
    .bind(...binds)
    .all<{ j: number }>();
  return (res.results ?? []).map((r) => r.j);
}

export async function countRows(
  db: D1Database,
  whereClause: string,
  binds: BindValue[],
): Promise<number> {
  const sql = `SELECT COUNT(*) AS c FROM ${TABLE} WHERE ${whereClause}`;
  const row = await db
    .prepare(sql)
    .bind(...binds)
    .first<{ c: number }>();
  return row?.c ?? 0;
}

export type VehicleImageryRow = {
  id: number;
  marke: string | null;
  modell: string | null;
  jahr: number | null;
  body: string | null;
  trim: string | null;
  farbe: string | null;
  resolution: string | null;
  format: string | null;
  views: string | null;
  sonstiges: string | null;
  active: number;
  last_updated: string | null;
};

const MAX_ROWS = 500;

export async function selectRowsPage(
  db: D1Database,
  whereClause: string,
  binds: BindValue[],
  limit: number,
  offset: number,
): Promise<VehicleImageryRow[]> {
  const lim = Math.min(Math.max(0, limit), MAX_ROWS);
  const off = Math.max(0, offset);
  const sql = `SELECT id, marke, modell, jahr, body, trim, farbe, resolution, format, views, sonstiges, active, last_updated
    FROM ${TABLE} WHERE ${whereClause}
    ORDER BY marke, modell, jahr, id
    LIMIT ? OFFSET ?`;
  const res = await db
    .prepare(sql)
    .bind(...binds, lim, off)
    .all<VehicleImageryRow>();
  return res.results ?? [];
}

export { DISTINCT_TEXT_COLS, TABLE };

export async function buildFacets(
  db: D1Database,
  filter: VehicleImageryFilter,
): Promise<{
  marken: string[];
  modelle: string[];
  jahre: number[];
  bodies: string[];
  trims: string[];
  farben: string[];
  resolutions: string[];
  formate: string[];
  ansichten: string[];
  rowCount: number;
}> {
  const { clause, binds } = buildVehicleImageryWhereClause(filter);

  const [
    marken,
    modelle,
    jahre,
    bodies,
    trims,
    farben,
    resolutions,
    formate,
    ansichten,
    rowCount,
  ] = await Promise.all([
    selectDistinctText(db, "marke", clause, binds),
    selectDistinctText(db, "modell", clause, binds),
    selectDistinctJahre(db, clause, binds),
    selectDistinctText(db, "body", clause, binds),
    selectDistinctText(db, "trim", clause, binds),
    selectDistinctText(db, "farbe", clause, binds),
    selectDistinctText(db, "resolution", clause, binds),
    selectDistinctText(db, "format", clause, binds),
    collectDistinctViewAngles(db, clause, binds),
    countRows(db, clause, binds),
  ]);

  return {
    marken,
    modelle,
    jahre,
    bodies,
    trims,
    farben,
    resolutions,
    formate,
    ansichten,
    rowCount,
  };
}
