/**
 * GET /api/databases/vehicle-imagery-controlling
 * PUT /api/databases/vehicle-imagery-controlling
 *
 * D1 `vehicledatabase` → `vehicleimagery_controlling_storage`
 * Gleiche Felder wie Public-Storage, **ohne** Spalte `genehmigt`.
 *
 * GET/PUT-Verhalten entspricht `vehicle-imagery.ts`, jedoch ohne genehmigt-Parameter/Filter/Suche-Spalte.
 *
 * CDN-Basis für `cdnBase`: `IMAGE_CDN_CONTROLLING_BASE` oder Default
 * `https://vehicleimagery-controlling.vehicleimagery.com` (Pfad `v1/…` wie beim Public-CDN).
 *
 * Detail-Antwort (`?id=`) liefert zusätzlich `statuses[]` aus `controll_status`
 * für `vehicle_id = ?id` (alle modes/statuses; Frontend filtert pro Modus).
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  correctionExpectedViewCountFromViews,
  scalingPairExpectedCountFromViews,
} from "../../_lib/controllStorageViewCounts";

const STORAGE_TABLE = "vehicleimagery_controlling_storage";

const MAX_LIMIT = 150;
const DEFAULT_LIMIT = 40;
const DEFAULT_CONTROLLING_CDN_BASE =
  "https://vehicleimagery-controlling.vehicleimagery.com";

function requireVehicleDb(env: AuthEnv): D1Database | Response {
  if (!env.vehicledatabase) {
    return jsonResponse(
      {
        error:
          "D1-Binding `vehicledatabase` fehlt. Im Cloudflare-Dashboard → Functions → D1, Variable `vehicledatabase` (env.vehicledatabase) setzen.",
      },
      { status: 503 },
    );
  }
  return env.vehicledatabase;
}

function likePatternForToken(t: string): string {
  const x = t.replace(/[%_]/g, "").trim();
  if (!x) return "";
  return `%${x}%`;
}

function searchTokensFromQuery(q: string): string[] {
  const words = q.trim().split(/\s+/);
  const out: string[] = [];
  for (const w of words) {
    const pat = likePatternForToken(w);
    if (pat) out.push(pat);
    if (out.length >= 24) break;
  }
  return out;
}

const BINDS_PER_TOKEN = 12;

export type VehicleImageryControllingRow = {
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
  active: number | null;
  last_updated: string | null;
};

/** Eintrag aus `controll_status` für ein Fahrzeug. */
export type ControllStatusRow = {
  id: number;
  vehicle_id: number;
  view_token: string;
  /** z. B. `correction`, `scaling`. */
  mode: string;
  /** z. B. `correct`, `regen_vertex`, `regen_batch`, `delete`. */
  status: string;
  updated_at: string | null;
  key: string | null;
  /** Spalte heißt `"check"` (reserviertes Wort). */
  check: number;
};

const SELECT_CONTROLL_STATUS = `SELECT
  id, vehicle_id, view_token, mode, status, updated_at, key, "check" AS "check"
FROM controll_status
WHERE vehicle_id = ?`;

function controllingCdnBaseFromEnv(env: AuthEnv): string {
  const raw = (env.IMAGE_CDN_CONTROLLING_BASE ?? "").trim();
  if (raw) return raw.replace(/\/$/, "");
  return DEFAULT_CONTROLLING_CDN_BASE;
}

function imageUrlQueryFromEnv(env: AuthEnv): string {
  const s = (env.image_url_secret ?? "").trim();
  if (!s) return "";
  return `?key=${encodeURIComponent(s)}`;
}

/** Spaltenliste der Storage-Tabelle (mit `v.`-Alias). */
const STORAGE_COLUMNS_VALIASED = `
  v.id, v.marke, v.modell, v.jahr, v.body, v.trim, v.farbe, v.resolution,
  v.format, v.views, v.sonstiges, v.active, v.last_updated
`;

/**
 * Aggregat-Subquery für `controll_status` – `mode` ist Pflicht-Bind.
 * Liefert pro `vehicle_id` Counts (n_done/n_errored/...) und n_total.
 *
 * Sonderfall „übertragen": gilt **nur** im Skalierungs-Modus (`mode = scaling`)
 * und nur wenn `status = 'correct'` und `check = 6`. In allen anderen Modi
 * zählt `n_transferred = 0`. Ein `check = 6` mit anderem Kontext fällt unter
 * `n_errored` (alle `check >= 3` außer der spezifischen scaling/correct/6-Kombi).
 *
 * Korrektur: Zeilen mit `mode = inside` sind eingeschlossen. „Done“ ist wahlweise
 * `correction`: `correct`/`check = 2` oder `inside`: `correct`/`check = 0`.
 *
 * Skalierung: `#skaliert` und `#skaliert_weiß` zum **selben Basis-Slug** werden
 * zu **einer** logischen Ansicht zusammengefasst (wie die gekoppelte Kachel);
 * die Counts beziehen sich auf diese Paare, nicht auf einzelne Zeilen.
 */
function controllStatusAggSubquery(statusMode: string): string {
  const isScaling = statusMode === "scaling";
  /** Nur `view_token` mit exakt `#skaliert` / `#skaliert_weiß` (kein `#skaliert_foo`). */
  const scalingViewFilter = isScaling
    ? ` AND (
        lower(view_token) GLOB '*#skaliert_weiß'
        OR (
          lower(view_token) GLOB '*#skaliert'
          AND NOT lower(view_token) GLOB '*#skaliert_*'
        )
      )`
    : "";
  if (isScaling) {
    return `(
  SELECT
    vehicle_id,
    SUM(CASE WHEN ne = 0 AND rc > 0 AND NOT (nt = rc) AND n2 = rc THEN 1 ELSE 0 END) AS n_done,
    SUM(CASE WHEN ne > 0 THEN 1 ELSE 0 END) AS n_errored,
    SUM(CASE WHEN ne = 0 AND rc > 0 AND nt = rc THEN 1 ELSE 0 END) AS n_transferred,
    SUM(CASE WHEN ne = 0 AND rc > 0 AND NOT (nt = rc) AND NOT (n2 = rc) AND NOT (n0 = rc) THEN 1 ELSE 0 END) AS n_in_progress,
    SUM(CASE WHEN ne = 0 AND rc > 0 AND NOT (nt = rc) AND NOT (n2 = rc) AND n0 = rc THEN 1 ELSE 0 END) AS n_pending,
    SUM(1) AS n_total
  FROM (
    SELECT
      vehicle_id,
      COUNT(*) AS rc,
      SUM(CASE WHEN "check" = 2 THEN 1 ELSE 0 END) AS n2,
      SUM(CASE WHEN "check" = 6 AND lower(ifnull(status, '')) = 'correct' THEN 1 ELSE 0 END) AS nt,
      SUM(CASE WHEN "check" >= 3 AND NOT ("check" = 6 AND lower(ifnull(status, '')) = 'correct') THEN 1 ELSE 0 END) AS ne,
      SUM(CASE WHEN "check" = 0 THEN 1 ELSE 0 END) AS n0
    FROM controll_status
    WHERE mode = 'scaling'${scalingViewFilter}
    GROUP BY vehicle_id, lower(substr(view_token, 1, instr(lower(view_token), '#') - 1))
  ) grp
  GROUP BY vehicle_id
) cs`;
  }
  const transferredExpr = `0`;
  const erroredExpr = `SUM(CASE WHEN "check" >= 3 THEN 1 ELSE 0 END)`;
  if (statusMode === "correction") {
    const modeWhere = `lower(ifnull(mode, '')) IN ('correction', 'inside')`;
    const doneExpr = `SUM(CASE WHEN (
        (lower(ifnull(mode, '')) = 'correction' AND "check" = 2 AND lower(ifnull(status, '')) = 'correct')
        OR (lower(ifnull(mode, '')) = 'inside' AND "check" = 0 AND lower(ifnull(status, '')) = 'correct')
      ) THEN 1 ELSE 0 END)`;
    const pendingExpr = `SUM(CASE WHEN "check" = 0 AND NOT (
        lower(ifnull(mode, '')) = 'inside' AND lower(ifnull(status, '')) = 'correct'
      ) THEN 1 ELSE 0 END)`;
    const inProgExpr = `SUM(CASE WHEN "check" = 1 THEN 1 ELSE 0 END)`;
    return `(
  SELECT
    vehicle_id,
    ${doneExpr} AS n_done,
    ${transferredExpr} AS n_transferred,
    ${erroredExpr} AS n_errored,
    ${inProgExpr} AS n_in_progress,
    ${pendingExpr} AS n_pending,
    COUNT(*) AS n_total
  FROM controll_status
  WHERE ${modeWhere}${scalingViewFilter}
  GROUP BY vehicle_id
) cs`;
  }

  const modeWhere =
    statusMode === "shadow" ? `mode = 'shadow'` : `mode = 'transparency'`;
  return `(
  SELECT
    vehicle_id,
    SUM(CASE WHEN "check" = 2 THEN 1 ELSE 0 END) AS n_done,
    ${transferredExpr} AS n_transferred,
    ${erroredExpr} AS n_errored,
    SUM(CASE WHEN "check" = 1 THEN 1 ELSE 0 END) AS n_in_progress,
    SUM(CASE WHEN "check" = 0 THEN 1 ELSE 0 END) AS n_pending,
    COUNT(*) AS n_total
  FROM controll_status
  WHERE ${modeWhere}${scalingViewFilter}
  GROUP BY vehicle_id
) cs`;
}

/** Detail-Lookup (ohne JOIN, ohne Counts). */
const SELECT_LIST_BY_ID = `SELECT
  id, marke, modell, jahr, body, trim, farbe, resolution, format, views, sonstiges, active, last_updated
FROM ${STORAGE_TABLE}`;

function likeContainsUserInput(raw: string): string | null {
  const esc = raw.replace(/[%_]/g, "").trim();
  if (!esc) return null;
  return `%${esc}%`;
}

function isYyyyMmDd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

const VIEWS_MODES = ["korrektur", "transparenz", "skalierung", "schatten"] as const;
type ViewsMode = (typeof VIEWS_MODES)[number];

function isViewsMode(s: string): s is ViewsMode {
  return (VIEWS_MODES as readonly string[]).includes(s);
}

/** Mapping Frontend-Modus → `controll_status.mode`. */
const VIEWS_MODE_TO_STATUS_MODE: Record<ViewsMode, string> = {
  korrektur: "correction",
  transparenz: "transparency",
  skalierung: "scaling",
  schatten: "shadow",
};

/**
 * Sortier-Whitelist (Schlüssel). SQL-Snippets werden in
 * `buildSortOptionsSql()` mode-abhängig gebaut – nutzer-input wird *nur*
 * gegen die Schlüssel geprüft, das tatsächliche SQL ist hardcoded
 * → kein SQL-Injection-Risiko.
 *
 * `default` = letzte Aktualisierung. `not_done_desc` = absteigend nach
 * "noch offen" (erwartete Views minus done minus übertragen).
 */
const SORT_OPTION_KEYS = [
  "default",
  "not_done_desc",
  "id_desc",
  "id_asc",
  "done_desc",
  "errored_desc",
  "transferred_desc",
  "inProgress_desc",
  "pending_desc",
  "total_desc",
] as const;
type SortOption = (typeof SORT_OPTION_KEYS)[number];
function isSortOption(s: string): s is SortOption {
  return (SORT_OPTION_KEYS as readonly string[]).includes(s);
}

function buildSortOptionsSql(
  statusMode: string,
): Record<SortOption, string> {
  const nExp = expectedViewsExpr(statusMode);
  // "Anzahl noch offener Views" = erwartete Views minus done minus übertragen.
  // Negative Werte (kann passieren wenn die views-Spalte weniger Tokens
  // listet als wirklich Status-Einträge existieren) auf 0 clampen.
  const openExpr = `MAX(0, ${nExp} - ifnull(cs.n_done, 0) - ifnull(cs.n_transferred, 0))`;
  return {
    default: "v.last_updated DESC, v.id DESC",
    not_done_desc: `${openExpr} DESC, ifnull(cs.n_errored, 0) DESC, v.last_updated DESC, v.id DESC`,
    id_desc: "v.id DESC",
    id_asc: "v.id ASC",
    done_desc:
      "ifnull(cs.n_done, 0) DESC, v.last_updated DESC, v.id DESC",
    errored_desc:
      "ifnull(cs.n_errored, 0) DESC, v.last_updated DESC, v.id DESC",
    transferred_desc:
      "ifnull(cs.n_transferred, 0) DESC, v.last_updated DESC, v.id DESC",
    inProgress_desc:
      "ifnull(cs.n_in_progress, 0) DESC, v.last_updated DESC, v.id DESC",
    pending_desc:
      "ifnull(cs.n_pending, 0) DESC, v.last_updated DESC, v.id DESC",
    total_desc:
      "ifnull(cs.n_total, 0) DESC, v.last_updated DESC, v.id DESC",
  };
}

/**
 * Status-Filter-Whitelist (Schlüssel). SQL-Snippets werden in
 * `buildStatusFiltersSql()` mode-abhängig zusammengebaut – nutzer-input
 * wird *nur* gegen die Schlüssel geprüft.
 *
 * - `open`: alle Fahrzeuge, die im aktuellen Modus noch Arbeit haben
 *   (mindestens eine Ansicht offen ODER ein `errored` vorhanden).
 *   Default für die Liste.
 * - `all`: alles (auch Fahrzeuge ohne erwartete Views in diesem Modus).
 * - `done`: alle erwarteten Views des aktuellen Modus sind erledigt
 *   (`done`/`übertragen`) und kein `errored` mehr aktiv.
 */
const STATUS_FILTER_KEYS = ["open", "all", "done"] as const;
type StatusFilter = (typeof STATUS_FILTER_KEYS)[number];
function isStatusFilter(s: string): s is StatusFilter {
  return (STATUS_FILTER_KEYS as readonly string[]).includes(s);
}
const STATUS_FILTER_DEFAULT: StatusFilter = "open";

/**
 * SQL-Ausdruck für die "Anzahl erwarteter Views im aktuellen Modus".
 * Approximierung über `;`-Trennzeichen in `v.views`.
 *
 * - Korrektur: nur Tokens **ohne** `#` (d. h. `gesamt - mit_#`).
 * - Skalierung: nur Tokens mit exakt `#skaliert` bzw. `#skaliert_weiß`;
 *   **ein Basis-Slug** (z. B. `front#…` + `front#…weiß`) zählt als **eine**
 *   erwartete Ansicht (analog gekoppelte Kachel / `countScalingViewPairsInViews`).
 * - Sonst: alle Tokens (Anzahl Semikolon-Segmente).
 *
 * Edge-Case: leere `views`-Spalte → `0` (Fahrzeuge ohne erwartete Views
 * tauchen damit in "done"/"open" gar nicht auf).
 */
function expectedViewsExpr(statusMode: string): string {
  const viewsEmpty = "ifnull(v.views, '') = ''";
  const tokensTotal =
    "(length(v.views) - length(replace(v.views, ';', '')) + 1)";
  const tokensWithHash =
    "(length(v.views) - length(replace(v.views, '#', '')))";
  if (statusMode === "correction") {
    const formula = `(${tokensTotal} - ${tokensWithHash})`;
    return `(CASE WHEN ${viewsEmpty} THEN 0 ELSE ${formula} END)`;
  }
  if (statusMode === "scaling") {
    return `(CASE WHEN ${viewsEmpty} THEN 0 ELSE (
  COALESCE((
    SELECT COUNT(*) FROM (
      WITH RECURSIVE
        split(rest) AS (
          SELECT replace(replace(ifnull(v.views, ''), char(13), ''), char(10), ';') || ';'
          UNION ALL
          SELECT substr(rest, instr(rest, ';') + 1)
          FROM split
          WHERE instr(rest, ';') > 0
        ),
        tok_row(tok) AS (
          SELECT trim(substr(rest, 1, instr(rest, ';') - 1))
          FROM split
          WHERE instr(rest, ';') > 0
        )
      SELECT DISTINCT lower(substr(tok, 1, instr(tok, '#') - 1)) AS slug
      FROM tok_row
      WHERE instr(tok, '#') > 0
        AND (
          lower(tok) GLOB '*#skaliert_weiß'
          OR (
            lower(tok) GLOB '*#skaliert'
            AND NOT lower(tok) GLOB '*#skaliert_*'
          )
        )
    )
  ), 0)
) END)`;
  }
  const formula = tokensTotal;
  return `(CASE WHEN ${viewsEmpty} THEN 0 ELSE ${formula} END)`;
}

function buildStatusFiltersSql(
  statusMode: string,
): Record<StatusFilter, string> {
  const nExp = expectedViewsExpr(statusMode);
  return {
    all: "",
    open: `(${nExp} > 0 AND ifnull(cs.n_done, 0) + ifnull(cs.n_transferred, 0) < ${nExp}) OR ifnull(cs.n_errored, 0) > 0`,
    done: `${nExp} > 0 AND ifnull(cs.n_errored, 0) = 0 AND ifnull(cs.n_done, 0) + ifnull(cs.n_transferred, 0) = ${nExp}`,
  };
}

export type ControllStatusCountsForRow = {
  done: number;
  errored: number;
  transferred: number;
  inProgress: number;
  pending: number;
  total: number;
};

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireVehicleDb(env);
  if (db instanceof Response) return db;

  const url = new URL(request.url);
  const idParam = (url.searchParams.get("id") || "").trim();
  if (idParam) {
    const oneId = Number(idParam);
    if (!Number.isInteger(oneId) || oneId < 1) {
      return jsonResponse({ error: "id ungültig" }, { status: 400 });
    }
    const row = await db
      .prepare(`${SELECT_LIST_BY_ID} WHERE id = ?`)
      .bind(oneId)
      .first<VehicleImageryControllingRow>();
    if (!row) {
      return jsonResponse({ error: "Nicht gefunden" }, { status: 404 });
    }
    const cdnBase = controllingCdnBaseFromEnv(env);
    const imageUrlQuery = imageUrlQueryFromEnv(env);
    const statuses = await loadControllStatuses(db, oneId);
    return jsonResponse(
      { row, cdnBase, imageUrlQuery, statuses },
      { status: 200 },
    );
  }

  const q = (url.searchParams.get("q") || "").trim();
  const searchTokens = searchTokensFromQuery(q);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      Number(url.searchParams.get("limit") || DEFAULT_LIMIT) || DEFAULT_LIMIT,
    ),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);
  const activeRaw = (url.searchParams.get("active") || "all").trim().toLowerCase();
  if (!["all", "0", "1", ""].includes(activeRaw)) {
    return jsonResponse(
      { error: "active muss leer, all, 0 oder 1 sein" },
      { status: 400 },
    );
  }

  const updatedFrom = (url.searchParams.get("updated_from") || "").trim();
  const updatedTo = (url.searchParams.get("updated_to") || "").trim();
  if (updatedFrom && !isYyyyMmDd(updatedFrom)) {
    return jsonResponse(
      { error: "updated_from muss YYYY-MM-DD sein" },
      { status: 400 },
    );
  }
  if (updatedTo && !isYyyyMmDd(updatedTo)) {
    return jsonResponse(
      { error: "updated_to muss YYYY-MM-DD sein" },
      { status: 400 },
    );
  }

  const filterId = (url.searchParams.get("filter_id") || "").trim();
  if (filterId && (!/^\d+$/.test(filterId) || Number(filterId) < 1)) {
    return jsonResponse({ error: "filter_id ungültig" }, { status: 400 });
  }

  const filterJahr = (url.searchParams.get("jahr") || "").trim();
  if (filterJahr && (!/^-?\d+$/.test(filterJahr) || Number.isNaN(Number(filterJahr)))) {
    return jsonResponse({ error: "jahr ungültig" }, { status: 400 });
  }

  /**
   * `views_mode` wird auf Server-Seite **nicht** in einen WHERE-Filter umgesetzt:
   * alle Fahrzeuge sollen in jedem Modus auftauchen, pro Modus filtert das Frontend
   * lediglich, welche `views`-Tokens als Kacheln erscheinen.
   *
   * Der `mode`-Wert wird aber für die Aggregat-Subquery genutzt
   * (`controll_status.mode = ?`).
   */
  const viewsModeRaw = (url.searchParams.get("views_mode") || "")
    .trim()
    .toLowerCase();
  if (viewsModeRaw && !isViewsMode(viewsModeRaw)) {
    return jsonResponse(
      {
        error:
          "views_mode muss korrektur, transparenz, skalierung oder schatten sein",
      },
      { status: 400 },
    );
  }
  const statusMode =
    viewsModeRaw && isViewsMode(viewsModeRaw)
      ? VIEWS_MODE_TO_STATUS_MODE[viewsModeRaw]
      : "correction";

  const sortRaw = (url.searchParams.get("sort") || "default").trim();
  if (!isSortOption(sortRaw)) {
    return jsonResponse(
      {
        error: `sort muss einer von: ${SORT_OPTION_KEYS.join(", ")} sein`,
      },
      { status: 400 },
    );
  }
  const sortOptionsSql = buildSortOptionsSql(statusMode);
  const orderBySql = sortOptionsSql[sortRaw];

  const statusFilterRaw = (
    url.searchParams.get("status_filter") || STATUS_FILTER_DEFAULT
  ).trim();
  if (!isStatusFilter(statusFilterRaw)) {
    return jsonResponse(
      {
        error: `status_filter muss einer von: ${STATUS_FILTER_KEYS.join(", ")} sein`,
      },
      { status: 400 },
    );
  }
  const statusFiltersSql = buildStatusFiltersSql(statusMode);
  const statusFilterSql = statusFiltersSql[statusFilterRaw];

  const where: string[] = ["1=1"];
  const binds: (string | number)[] = [];

  if (activeRaw === "0" || activeRaw === "1") {
    where.push("v.active = ?");
    binds.push(activeRaw === "1" ? 1 : 0);
  }

  if (updatedFrom) {
    where.push("date(v.last_updated) >= date(?)");
    binds.push(updatedFrom);
  }
  if (updatedTo) {
    where.push("date(v.last_updated) <= date(?)");
    binds.push(updatedTo);
  }

  if (filterId) {
    where.push("v.id = ?");
    binds.push(Number(filterId));
  }

  const textFilters: [string, string][] = [
    ["marke", url.searchParams.get("marke") || ""],
    ["modell", url.searchParams.get("modell") || ""],
    ["body", url.searchParams.get("body") || ""],
    ["trim", url.searchParams.get("trim") || ""],
    ["farbe", url.searchParams.get("farbe") || ""],
    ["resolution", url.searchParams.get("resolution") || ""],
    ["format", url.searchParams.get("format") || ""],
  ];
  for (const [col, raw] of textFilters) {
    const pat = likeContainsUserInput(raw);
    if (pat) {
      where.push(`ifnull(v.${col}, '') LIKE ?`);
      binds.push(pat);
    }
  }

  if (filterJahr) {
    where.push("v.jahr = ?");
    binds.push(Number(filterJahr));
  }

  for (const pat of searchTokens) {
    where.push(searchOrSqlAliased());
    for (let i = 0; i < BINDS_PER_TOKEN; i++) binds.push(pat);
  }

  if (statusFilterSql) {
    where.push(`(${statusFilterSql})`);
  }

  // Im aktuellen Modus „leere" Fahrzeuge (n_views_expected = 0 UND
  // keine Status-Einträge) werden bei jedem expliziten Filter ausgeblendet
  // — sie tauchen nur unter „alle" (all) auf, weil dort bewusst
  // alles zur Ansicht gehört.
  if (statusFilterRaw !== "all") {
    const nExp = expectedViewsExpr(statusMode);
    where.push(`(${nExp} > 0 OR ifnull(cs.n_total, 0) > 0)`);
  }

  const whereSql = ` WHERE ${where.join(" AND ")}`;
  const fromJoin = `FROM ${STORAGE_TABLE} v LEFT JOIN ${controllStatusAggSubquery(statusMode)} ON cs.vehicle_id = v.id`;

  const countSql = `SELECT COUNT(*) as n ${fromJoin}${whereSql}`;
  const countRow = await db.prepare(countSql).bind(...binds).first<{ n: number }>();
  const total = countRow?.n ?? 0;

  const listSql = `SELECT
${STORAGE_COLUMNS_VALIASED},
  ifnull(cs.n_done, 0) AS n_done,
  ifnull(cs.n_errored, 0) AS n_errored,
  ifnull(cs.n_transferred, 0) AS n_transferred,
  ifnull(cs.n_in_progress, 0) AS n_in_progress,
  ifnull(cs.n_pending, 0) AS n_pending,
  ifnull(cs.n_total, 0) AS n_total
${fromJoin}
${whereSql}
ORDER BY ${orderBySql}
LIMIT ? OFFSET ?`;

  type ListRowRaw = VehicleImageryControllingRow & {
    n_done: number;
    n_errored: number;
    n_transferred: number;
    n_in_progress: number;
    n_pending: number;
    n_total: number;
  };

  let results: ListRowRaw[] = [];
  try {
    const r = await db
      .prepare(listSql)
      .bind(...binds, limit, offset)
      .all<ListRowRaw>();
    results = r.results ?? [];
  } catch (err) {
    // Fallback ohne JOIN, falls `controll_status` (noch) nicht existiert
    const fallbackWhere = where
      .map((w) => w.replace(/\(cs\.[^)]*\)/g, "1=1"))
      .filter((w) => !w.startsWith("(cs."));
    const fallbackSql = `SELECT ${STORAGE_COLUMNS_VALIASED}
FROM ${STORAGE_TABLE} v
WHERE ${fallbackWhere.join(" AND ")}
ORDER BY v.last_updated DESC, v.id DESC
LIMIT ? OFFSET ?`;
    const r = await db
      .prepare(fallbackSql)
      .bind(...binds, limit, offset)
      .all<VehicleImageryControllingRow>();
    results = (r.results ?? []).map((row) => ({
      ...row,
      n_done: 0,
      n_errored: 0,
      n_transferred: 0,
      n_in_progress: 0,
      n_pending: 0,
      n_total: 0,
    }));
    void err;
  }

  const cdnBase = controllingCdnBaseFromEnv(env);
  const imageUrlQuery = imageUrlQueryFromEnv(env);

  const rows = results.map((r) => {
    const {
      n_done,
      n_errored,
      n_transferred,
      n_in_progress,
      n_pending,
      n_total,
      ...storageCols
    } = r;
    const controllStatusCounts: ControllStatusCountsForRow = {
      done: Number(n_done) || 0,
      errored: Number(n_errored) || 0,
      transferred: Number(n_transferred) || 0,
      inProgress: Number(n_in_progress) || 0,
      pending: Number(n_pending) || 0,
      total: Number(n_total) || 0,
    };
    return { ...storageCols, controllStatusCounts };
  });

  return jsonResponse(
    {
      rows,
      total,
      offset,
      limit,
      cdnBase,
      imageUrlQuery,
    },
    { status: 200 },
  );
};

/** SEARCH_OR_SQL mit `v.`-Alias-Spalten (für JOIN-Query). */
function searchOrSqlAliased(): string {
  return `(
  CAST(v.id AS TEXT) LIKE ?
  OR ifnull(v.marke, '') LIKE ?
  OR ifnull(v.modell, '') LIKE ?
  OR CAST(v.jahr AS TEXT) LIKE ?
  OR ifnull(v.body, '') LIKE ?
  OR ifnull(v.trim, '') LIKE ?
  OR ifnull(v.farbe, '') LIKE ?
  OR ifnull(v.resolution, '') LIKE ?
  OR ifnull(v.format, '') LIKE ?
  OR ifnull(v.views, '') LIKE ?
  OR ifnull(v.sonstiges, '') LIKE ?
  OR ifnull(v.last_updated, '') LIKE ?
)`;
}

type PutBody = { id?: unknown; active?: unknown };

export const onRequestPut: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireVehicleDb(env);
  if (db instanceof Response) return db;

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) {
    return jsonResponse({ error: "id ungültig" }, { status: 400 });
  }
  const a = body.active;
  let activeVal: 0 | 1;
  if (a === 0 || a === "0" || a === false) {
    activeVal = 0;
  } else if (a === 1 || a === "1" || a === true) {
    activeVal = 1;
  } else {
    return jsonResponse(
      { error: "active muss 0 oder 1 sein" },
      { status: 400 },
    );
  }

  const run = await db
    .prepare(
      `UPDATE ${STORAGE_TABLE}
SET active = ?, last_updated = datetime('now')
WHERE id = ?`,
    )
    .bind(activeVal, id)
    .run();
  const changes = Number(
    (run as { meta?: { changes?: number } }).meta?.changes ?? 0,
  );
  if (changes === 0) {
    return jsonResponse({ error: "Nicht gefunden" }, { status: 404 });
  }

  const row = await db
    .prepare(`${SELECT_LIST_BY_ID} WHERE id = ?`)
    .bind(id)
    .first<VehicleImageryControllingRow>();
  if (!row) {
    return jsonResponse({ error: "Nicht gefunden" }, { status: 404 });
  }
  const cdnBase = controllingCdnBaseFromEnv(env);
  const imageUrlQuery = imageUrlQueryFromEnv(env);
  const statuses = await loadControllStatuses(db, id);
  return jsonResponse({ row, cdnBase, imageUrlQuery, statuses }, { status: 200 });
};

/**
 * Fahrzeuge im Controlling-Speicher, die für den Modus den Listen-Filter
 * „open“ erfüllen — **ohne** Suche/Textfilter (globaler Umfang offener Arbeit).
 * `statusMode`: `correction` (Korrektur) oder `scaling` (Skalierung).
 */
export async function countControllingOpenByStatusMode(
  db: D1Database,
  statusMode: "correction" | "scaling",
): Promise<number> {
  const statusFilterSql = buildStatusFiltersSql(statusMode).open;
  const nExp = expectedViewsExpr(statusMode);
  const where: string[] = [
    "1=1",
    `(${statusFilterSql})`,
    `(${nExp} > 0 OR ifnull(cs.n_total, 0) > 0)`,
  ];
  const whereSql = ` WHERE ${where.join(" AND ")}`;
  const fromJoin = `FROM ${STORAGE_TABLE} v LEFT JOIN ${controllStatusAggSubquery(statusMode)} ON cs.vehicle_id = v.id`;
  const countSql = `SELECT COUNT(*) as n ${fromJoin}${whereSql}`;
  try {
    const countRow = await db.prepare(countSql).bind().first<{ n: number }>();
    return countRow?.n ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Summe aller noch offenen **Einzel-Ansichten** (Korrektur): pro Fahrzeug
 * `max(0, n_erwartet_korrektur − n_done − n_transferred)`.
 * `expectedViewsExpr(correction)` entspricht der UI (keine Tokens mit `#`, also
 * kein `#trp`, `#skaliert`, …).
 */
export async function sumRemainingCorrectionViewSlots(
  db: D1Database,
): Promise<number> {
  return sumRemainingViewSlotsByStatusMode(db, "correction");
}

/**
 * Summe aller noch offenen **Skalierungs-Kacheln** (Paar = 1): pro Fahrzeug
 * wie in der Liste; `#skaliert` + `#skaliert_weiß` zählen gemeinsam als eine erwartete Einheit.
 */
export async function sumRemainingScalingPairSlots(
  db: D1Database,
): Promise<number> {
  return sumRemainingViewSlotsByStatusMode(db, "scaling");
}

async function sumRemainingViewSlotsByStatusMode(
  db: D1Database,
  statusMode: "correction" | "scaling",
): Promise<number> {
  const fromJoin = `FROM ${STORAGE_TABLE} v LEFT JOIN ${controllStatusAggSubquery(statusMode)} cs ON cs.vehicle_id = v.id`;
  const sql = `SELECT v.views AS views, ifnull(cs.n_done, 0) AS n_done, ifnull(cs.n_transferred, 0) AS n_transferred ${fromJoin}`;
  const nExpFn =
    statusMode === "correction"
      ? correctionExpectedViewCountFromViews
      : scalingPairExpectedCountFromViews;
  try {
    const r = await db.prepare(sql).bind().all<{
      views: string | null;
      n_done: number;
      n_transferred: number;
    }>();
    let sum = 0;
    for (const row of r.results ?? []) {
      const nExp = nExpFn(row.views);
      const done = Number(row.n_done) || 0;
      const transferred = Number(row.n_transferred) || 0;
      sum += Math.max(0, nExp - done - transferred);
    }
    return sum;
  } catch (err) {
    console.error(
      `[vehicle-imagery-controlling] sumRemainingViewSlotsByStatusMode(${statusMode})`,
      err,
    );
    return 0;
  }
}

/**
 * Lädt die Status-Einträge zu einer `vehicle_id` aus `controll_status`.
 * Fängt einen "kein Tabelle"-Fehler ab und gibt dann ein leeres Array zurück.
 */
async function loadControllStatuses(
  db: D1Database,
  vehicleId: number,
): Promise<ControllStatusRow[]> {
  try {
    const r = await db
      .prepare(SELECT_CONTROLL_STATUS)
      .bind(vehicleId)
      .all<ControllStatusRow>();
    return r.results ?? [];
  } catch (_err) {
    return [];
  }
}
