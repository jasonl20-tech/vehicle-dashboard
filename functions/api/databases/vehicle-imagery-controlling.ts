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
import { controllingStorageR2KeyFromViewToken } from "../../_lib/vehicleImageryR2Key";

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

// --- „Geister"-Erkennung (nutzen `v.`-Alias der Storage-Tabelle) ---
/** 1, wenn ein identisches Auto bereits live in der Public-API existiert. */
const ALREADY_PUBLIC_SQL = `CASE WHEN EXISTS (
  SELECT 1 FROM vehicleimagery_public_storage p
  WHERE p.marke = v.marke AND p.modell = v.modell AND p.jahr = v.jahr
    AND ifnull(p.body,'') = ifnull(v.body,'') AND ifnull(p.trim,'') = ifnull(v.trim,'')
    AND ifnull(p.farbe,'') = ifnull(v.farbe,'') AND ifnull(p.resolution,'') = ifnull(v.resolution,'')
    AND ifnull(p.format,'') = ifnull(v.format,'')
) THEN 1 ELSE 0 END`;
/** id des Live-Zwillings (oder NULL). */
const PUBLIC_ID_SQL = `(
  SELECT p.id FROM vehicleimagery_public_storage p
  WHERE p.marke = v.marke AND p.modell = v.modell AND p.jahr = v.jahr
    AND ifnull(p.body,'') = ifnull(v.body,'') AND ifnull(p.trim,'') = ifnull(v.trim,'')
    AND ifnull(p.farbe,'') = ifnull(v.farbe,'') AND ifnull(p.resolution,'') = ifnull(v.resolution,'')
    AND ifnull(p.format,'') = ifnull(v.format,'') LIMIT 1
)`;
/** 1, wenn aktuell noch eine Generierung läuft/wartet (check IN 0,1,7,8). */
const IS_RUNNING_SQL = `CASE WHEN EXISTS (
  SELECT 1 FROM controll_status cr WHERE cr.vehicle_id = v.id AND cr."check" IN (0, 1, 7, 8)
) THEN 1 ELSE 0 END`;
/** 1, wenn die Innenansichten bereits kontrolliert sind (mode=inside, status=correct). */
const INSIDE_CONTROLLED_SQL = `CASE WHEN EXISTS (
  SELECT 1 FROM controll_status cr WHERE cr.vehicle_id = v.id AND cr.mode = 'inside' AND cr.status = 'correct'
) THEN 1 ELSE 0 END`;
/** 1, wenn überhaupt irgendeine Ansicht kontrolliert ist (status=correct). */
const ANY_CONTROLLED_SQL = `CASE WHEN EXISTS (
  SELECT 1 FROM controll_status cr WHERE cr.vehicle_id = v.id AND cr.status = 'correct'
) THEN 1 ELSE 0 END`;

/**
 * Aggregat-Subquery für `controll_status` – `mode` ist Pflicht-Bind.
 * Liefert pro `vehicle_id` Counts (n_done/n_errored/...) und n_total.
 *
 * Sonderfall „übertragen":
 * - Skalierung (`mode = scaling`): `correct` + `check = 6` (pro gekoppeltem Paar).
 * - Korrektur-Aggregat (`correction` + `inside`): zusätzlich `inside` + `correct`
 *   + `check = 6` zählt als `n_transferred` und nicht als `n_errored`.
 * Sonst zählen alle `check >= 3`, die keine Übertragungs-Zeile sind, unter `n_errored`.
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
    const transferredCorrectionExpr = `SUM(CASE WHEN lower(ifnull(mode, '')) = 'inside' AND "check" = 6 AND lower(ifnull(status, '')) = 'correct' THEN 1 ELSE 0 END)`;
    const erroredCorrectionExpr = `SUM(CASE WHEN "check" >= 3 AND NOT (
      lower(ifnull(mode, '')) = 'inside' AND lower(ifnull(status, '')) = 'correct' AND "check" = 6
    ) THEN 1 ELSE 0 END)`;
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
    ${transferredCorrectionExpr} AS n_transferred,
    ${erroredCorrectionExpr} AS n_errored,
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

/** Detail-Lookup (ohne JOIN-Aggregat, aber mit Geister-Flags). */
const SELECT_LIST_BY_ID = `SELECT
  v.id, v.marke, v.modell, v.jahr, v.body, v.trim, v.farbe, v.resolution, v.format, v.views, v.sonstiges, v.active, v.last_updated,
  ${ALREADY_PUBLIC_SQL} AS already_public,
  ${PUBLIC_ID_SQL} AS public_id,
  ${IS_RUNNING_SQL} AS is_running,
  ${INSIDE_CONTROLLED_SQL} AS inside_controlled,
  ${ANY_CONTROLLED_SQL} AS any_controlled
FROM ${STORAGE_TABLE} v`;

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
const STATUS_FILTER_KEYS = [
  "open",
  "open_ext_only",
  "open_int",
  "all",
  "done",
] as const;
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
  // Außen/„vorhandene Views" fertig (klassisch über die Counts).
  const openSql = `(${nExp} > 0 AND ifnull(cs.n_done, 0) + ifnull(cs.n_transferred, 0) < ${nExp}) OR ifnull(cs.n_errored, 0) > 0`;
  const doneSql = `${nExp} > 0 AND ifnull(cs.n_errored, 0) = 0 AND ifnull(cs.n_done, 0) + ifnull(cs.n_transferred, 0) = ${nExp}`;
  // „Innen kontrolliert": dashboard UND center_console (inkl. Varianten) haben
  // je eine `correct`-Zeile. Nur im Korrektur-Modus relevant – in anderen Modi
  // gibt es keine Innen-Views, dort entfällt die Anforderung (= immer erfüllt).
  const interiorDone =
    statusMode === "correction"
      ? `(
    EXISTS (SELECT 1 FROM controll_status ci WHERE ci.vehicle_id = v.id AND lower(ci.status) = 'correct' AND (lower(ci.view_token) = 'dashboard' OR lower(ci.view_token) GLOB 'dashboard#*'))
    AND EXISTS (SELECT 1 FROM controll_status ci WHERE ci.vehicle_id = v.id AND lower(ci.status) = 'correct' AND (lower(ci.view_token) = 'center_console' OR lower(ci.view_token) GLOB 'center_console#*'))
  )`
      : "1=1";
  // „Innen offen/fehlt": Auto hat erwartete Views, aber Innen ist nicht
  // vollständig kontrolliert (offen ODER gar nicht vorhanden).
  const interiorOpen = `(${nExp} > 0 AND NOT ${interiorDone})`;
  return {
    all: "",
    // Default: irgendetwas offen ODER Innen noch nicht kontrolliert.
    open: `(${openSql}) OR ${interiorOpen}`,
    // „Nur außen offen": außen offen, Innen aber fertig kontrolliert.
    open_ext_only: `(${openSql}) AND ${interiorDone}`,
    // „Innen offen": Innen noch nicht kontrolliert.
    open_int: interiorOpen,
    // „Komplett done": außen fertig UND Innen kontrolliert.
    done: `(${doneSql}) AND ${interiorDone}`,
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

  // Facets für die „Auto erstellen"-Dropdowns: distinct Marken + Modelle.
  if (url.searchParams.get("facets")) {
    const r = await db
      .prepare(
        `SELECT DISTINCT marke, modell FROM ${STORAGE_TABLE}
         WHERE marke IS NOT NULL AND trim(marke) <> ''
         ORDER BY marke, modell`,
      )
      .all<{ marke: string; modell: string | null }>();
    const markes = new Set<string>();
    const modellsByMarke: Record<string, string[]> = {};
    for (const row of r.results ?? []) {
      if (!row.marke) continue;
      markes.add(row.marke);
      if (row.modell && row.modell.trim()) {
        (modellsByMarke[row.marke] ??= []).push(row.modell);
      }
    }
    return jsonResponse(
      { markes: [...markes].sort(), modellsByMarke },
      { status: 200 },
    );
  }

  const idParam = (url.searchParams.get("id") || "").trim();
  if (idParam) {
    const oneId = Number(idParam);
    if (!Number.isInteger(oneId) || oneId < 1) {
      return jsonResponse({ error: "id ungültig" }, { status: 400 });
    }
    const row = await db
      .prepare(`${SELECT_LIST_BY_ID} WHERE v.id = ?`)
      .bind(oneId)
      .first<
        VehicleImageryControllingRow & {
          already_public: number;
          public_id: number | null;
          is_running: number;
          inside_controlled: number;
          any_controlled: number;
        }
      >();
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

  /** Kern-`WHERE`-Teile ohne Status-Filter (für Hilfs-Counts wie „Übrig“). */
  const whereCore = where.slice();

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

  /** Fahrzeuge im aktuellen Modus ohne vollständig done/übertragen oder mit Fehler (wie Filter „offen“). */
  let remainingTotal: number;
  if (statusFilterRaw === "open") {
    remainingTotal = total;
  } else if (statusFilterRaw === "done") {
    remainingTotal = 0;
  } else {
    const openSql = statusFiltersSql.open;
    const whereRem = [...whereCore, `(${openSql})`];
    const whereRemSql = ` WHERE ${whereRem.join(" AND ")}`;
    const countRemSql = `SELECT COUNT(*) as n_rem ${fromJoin}${whereRemSql}`;
    const remRow = await db
      .prepare(countRemSql)
      .bind(...binds)
      .first<{ n_rem: number }>();
    remainingTotal = remRow?.n_rem ?? 0;
  }

  const listSql = `SELECT
${STORAGE_COLUMNS_VALIASED},
  ifnull(cs.n_done, 0) AS n_done,
  ifnull(cs.n_errored, 0) AS n_errored,
  ifnull(cs.n_transferred, 0) AS n_transferred,
  ifnull(cs.n_in_progress, 0) AS n_in_progress,
  ifnull(cs.n_pending, 0) AS n_pending,
  ifnull(cs.n_total, 0) AS n_total,
  ${ALREADY_PUBLIC_SQL} AS already_public,
  ${PUBLIC_ID_SQL} AS public_id,
  ${IS_RUNNING_SQL} AS is_running,
  ${INSIDE_CONTROLLED_SQL} AS inside_controlled,
  ${ANY_CONTROLLED_SQL} AS any_controlled
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
    already_public: number;
    public_id: number | null;
    is_running: number;
    inside_controlled: number;
    any_controlled: number;
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
      already_public: 0,
      public_id: null,
      is_running: 0,
      inside_controlled: 0,
      any_controlled: 0,
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
      already_public,
      public_id,
      is_running,
      inside_controlled,
      any_controlled,
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
    return {
      ...storageCols,
      controllStatusCounts,
      already_public: Number(already_public) || 0,
      public_id: public_id ?? null,
      is_running: Number(is_running) || 0,
      inside_controlled: Number(inside_controlled) || 0,
      any_controlled: Number(any_controlled) || 0,
    };
  });

  return jsonResponse(
    {
      rows,
      total,
      remainingTotal,
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

/** Außenansichten → mode `correction`, Innenansichten → mode `inside`. */
const CREATE_INTERIOR_VIEWS = ["dashboard", "center_console"] as const;
const CREATE_ALLOWED_VIEWS = new Set<string>([
  "front",
  "rear",
  "left",
  "right",
  "front_left",
  "front_right",
  "rear_left",
  "rear_right",
  ...CREATE_INTERIOR_VIEWS,
]);

/**
 * Generierungs-Reihenfolge für die Sequenz: erst ein guter Anker (`front`),
 * dann Seiten/Heck (die der job-abarbeiter als Referenz bevorzugt), dann
 * Diagonalen, zuletzt Innen. Jede View referenziert die zuvor fertigen.
 */
const CREATE_VIEW_ORDER = [
  "front",
  "left",
  "right",
  "rear",
  "front_left",
  "front_right",
  "rear_left",
  "rear_right",
  "dashboard",
  "center_console",
];

type CreateBody = {
  marke?: unknown;
  modell?: unknown;
  jahr?: unknown;
  jahre?: unknown;
  body?: unknown;
  trim?: unknown;
  farbe?: unknown;
  resolution?: unknown;
  format?: unknown;
  views?: unknown;
  /** `true` → bereits in Controlling vorhandene Jahrgänge überschreiben. */
  overwrite?: unknown;
};

/**
 * POST /api/databases/vehicle-imagery-controlling
 *
 * Legt ein NEUES Fahrzeug im Controlling-Storage an (reine Text-zu-Bild-
 * Generierung, kein Upload):
 *  1. Insert in `vehicleimagery_controlling_storage` (views leer, active=1).
 *  2. Pro gewählter Ansicht ein `controll_status`-Job (status `regen_vertex`,
 *     check 0): Außen → mode `correction`, Innen → mode `inside`.
 * Der Cron-/Worker generiert dann automatisch; das Auto erscheint in der
 * Kontroll-Plattform und geht erst nach „correct/übertragen" live.
 */
export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireVehicleDb(env);
  if (db instanceof Response) return db;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const marke = str(body.marke);
  const modell = str(body.modell);
  const jahrRaw = str(body.jahr);
  const carBody = str(body.body) || "Basis";
  const trimVal = str(body.trim) || "base";
  const farbe = str(body.farbe) || "default";
  const resolution = str(body.resolution) || "default";
  const format = (str(body.format) || "png").toLowerCase();
  const overwrite = body.overwrite === true;

  if (!marke) {
    return jsonResponse({ error: "marke ist erforderlich" }, { status: 400 });
  }
  if (!modell) {
    return jsonResponse({ error: "modell ist erforderlich" }, { status: 400 });
  }
  // Ein oder mehrere Jahrgänge: `jahre` (Array) bevorzugt, sonst `jahr` (einzeln).
  const jahreRaw: string[] = Array.isArray(body.jahre)
    ? (body.jahre as unknown[]).map((v) =>
        typeof v === "number"
          ? String(v)
          : typeof v === "string"
            ? v.trim()
            : "",
      )
    : jahrRaw
      ? [jahrRaw]
      : [];
  const jahreSet = new Set<number>();
  for (const y of jahreRaw) {
    if (!/^\d{4}$/.test(y)) {
      return jsonResponse(
        { error: `Ungültiges Jahr „${y}" — vierstellig erwartet (z. B. 2024).` },
        { status: 400 },
      );
    }
    jahreSet.add(Number(y));
  }
  const jahre = [...jahreSet].sort((a, b) => a - b);
  if (jahre.length === 0) {
    return jsonResponse(
      { error: "Mindestens ein Jahr erforderlich." },
      { status: 400 },
    );
  }
  if (jahre.length > 40) {
    return jsonResponse(
      { error: "Maximal 40 Jahrgänge auf einmal." },
      { status: 400 },
    );
  }

  const views = Array.isArray(body.views)
    ? [
        ...new Set(
          (body.views as unknown[])
            .filter((v): v is string => typeof v === "string")
            .map((v) => v.trim().toLowerCase())
            .filter((v) => CREATE_ALLOWED_VIEWS.has(v)),
        ),
      ]
    : [];
  if (views.length === 0) {
    return jsonResponse(
      { error: "Mindestens eine gültige Ansicht wählen." },
      { status: 400 },
    );
  }

  const created: { id: number; jahr: number }[] = [];
  const blockedLive: { jahr: number; publicId: number }[] = [];
  const needsConfirm: { jahr: number; existingId: number }[] = [];

  // Sequenz-Reihenfolge der gewählten Ansichten (Anker zuerst).
  const orderedViews = [...views].sort((a, b) => {
    const ia = CREATE_VIEW_ORDER.indexOf(a);
    const ib = CREATE_VIEW_ORDER.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

  for (const jahr of jahre) {
    // (A) Bereits LIVE in der öffentlichen API? → blockieren, nicht generieren.
    const live = await db
      .prepare(
        `SELECT id FROM vehicleimagery_public_storage
         WHERE marke = ? AND modell = ? AND jahr = ?
           AND ifnull(body,'') = ? AND ifnull(trim,'') = ?
           AND ifnull(farbe,'') = ? AND ifnull(resolution,'') = ?
           AND ifnull(format,'') = ?`,
      )
      .bind(marke, modell, jahr, carBody, trimVal, farbe, resolution, format)
      .first<{ id: number }>();
    if (live) {
      blockedLive.push({ jahr, publicId: live.id });
      continue;
    }

    // (B) Bereits in Controlling? → ohne overwrite Rückfrage, mit overwrite neu.
    const existing = await db
      .prepare(
        `SELECT id FROM ${STORAGE_TABLE}
         WHERE marke = ? AND modell = ? AND jahr = ?
           AND ifnull(body,'') = ? AND ifnull(trim,'') = ?
           AND ifnull(farbe,'') = ? AND ifnull(resolution,'') = ?
           AND ifnull(format,'') = ?`,
      )
      .bind(marke, modell, jahr, carBody, trimVal, farbe, resolution, format)
      .first<{ id: number }>();

    let vehicleId: number;
    if (existing) {
      if (!overwrite) {
        needsConfirm.push({ jahr, existingId: existing.id });
        continue;
      }
      // Überschreiben: Zeile wiederverwenden, Views leeren, offene Jobs entfernen.
      // Die Generierung überschreibt anschließend die R2-Objekte am selben Key.
      vehicleId = existing.id;
      await db
        .prepare(
          `UPDATE ${STORAGE_TABLE}
             SET views = '', active = 1, last_updated = datetime('now')
           WHERE id = ?`,
        )
        .bind(vehicleId)
        .run();
      await db
        .prepare(`DELETE FROM controll_status WHERE vehicle_id = ?`)
        .bind(vehicleId)
        .run();
    } else {
      const ins = await db
        .prepare(
          `INSERT INTO ${STORAGE_TABLE}
            (marke, modell, jahr, body, trim, farbe, resolution, format, views, active, last_updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 1, datetime('now'))`,
        )
        .bind(marke, modell, jahr, carBody, trimVal, farbe, resolution, format)
        .run();
      vehicleId = Number(
        (ins as { meta?: { last_row_id?: number } }).meta?.last_row_id ?? 0,
      );
      if (!vehicleId) continue;
    }

    const rowForKey = {
      format,
      resolution,
      marke,
      modell,
      jahr,
      body: carBody,
      trim: trimVal,
      farbe,
    };
    // Sequenzielle Generierung mit Referenz-Kette: nur die erste Ansicht ist
    // sofort bereit (check 0), der Rest wartet (check 7) und wird vom
    // job-abarbeiter nach Fertigstellung der jeweils vorigen verkettet
    // (status `regen_vertex_seq`).
    const jobStmts = orderedViews.map((view, idx) => {
      const mode = (CREATE_INTERIOR_VIEWS as readonly string[]).includes(view)
        ? "inside"
        : "correction";
      const key = controllingStorageR2KeyFromViewToken(rowForKey, view);
      const checkVal = idx === 0 ? 0 : 7;
      return db
        .prepare(
          `INSERT OR IGNORE INTO controll_status
            (vehicle_id, view_token, mode, status, key, updated_at, "check")
           VALUES (?, ?, ?, 'regen_vertex_seq', ?, datetime('now'), ?)`,
        )
        .bind(vehicleId, view, mode, key, checkVal);
    });
    await db.batch(jobStmts);
    created.push({ id: vehicleId, jahr });
  }

  return jsonResponse(
    {
      created,
      blockedLive,
      needsConfirm,
      totalJobs: created.length * orderedViews.length,
      views: orderedViews,
    },
    { status: 200 },
  );
};

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

type DeleteRow = {
  id: number;
  marke: string | null;
  modell: string | null;
  jahr: number | null;
  body: string | null;
  trim: string | null;
  farbe: string | null;
  resolution: string | null;
  format: string | null;
};

/**
 * DELETE /api/databases/vehicle-imagery-controlling?id=<id>
 *
 * Entfernt ein „Geister"-Auto aus dem Controlling: R2-Objekte im
 * Controlling-Bucket + alle `controll_status`-Zeilen + die Controlling-Zeile.
 * Die öffentliche Live-Version (andere Tabelle/anderer Bucket) bleibt unberührt.
 *
 * Sicherheit: Nur erlaubt, wenn ein identisches Auto bereits LIVE in der
 * Public-API existiert UND keine Generierung mehr läuft (check IN 0,1,7,8).
 */
export const onRequestDelete: PagesFunction<AuthEnv> = async ({
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
  const id = Number((url.searchParams.get("id") || "").trim());
  if (!Number.isInteger(id) || id < 1) {
    return jsonResponse({ error: "id ungültig" }, { status: 400 });
  }

  const bucket = env.controllbucket;
  if (!bucket) {
    return jsonResponse(
      {
        error:
          "R2-Binding `controllbucket` (vehicleimagery-controlling) fehlt. Im Pages-Projekt → Settings → Functions → R2-Bindings als `controllbucket` ergänzen.",
      },
      { status: 500 },
    );
  }

  const row = await db
    .prepare(
      `SELECT id, marke, modell, jahr, body, trim, farbe, resolution, format
       FROM ${STORAGE_TABLE} WHERE id = ?`,
    )
    .bind(id)
    .first<DeleteRow>();
  if (!row) {
    return jsonResponse(
      { error: "Nicht im Controlling gefunden." },
      { status: 404 },
    );
  }

  // Sicherheit (1): Live-Zwilling muss existieren.
  const live = await db
    .prepare(
      `SELECT id FROM vehicleimagery_public_storage
       WHERE marke = ? AND modell = ? AND jahr = ?
         AND ifnull(body,'') = ? AND ifnull(trim,'') = ?
         AND ifnull(farbe,'') = ? AND ifnull(resolution,'') = ?
         AND ifnull(format,'') = ?`,
    )
    .bind(
      row.marke,
      row.modell,
      row.jahr,
      row.body ?? "",
      row.trim ?? "",
      row.farbe ?? "",
      row.resolution ?? "",
      row.format ?? "",
    )
    .first<{ id: number }>();
  if (!live) {
    return jsonResponse(
      {
        error:
          "Kein Live-Zwilling in der Public-API — als Geist nicht löschbar.",
      },
      { status: 409 },
    );
  }

  // Sicherheit (2): keine laufende Generierung.
  const running = await db
    .prepare(
      `SELECT 1 AS x FROM controll_status WHERE vehicle_id = ? AND "check" IN (0,1,7,8) LIMIT 1`,
    )
    .bind(id)
    .first<{ x: number }>();
  if (running) {
    return jsonResponse(
      { error: "Es läuft noch eine Generierung — nicht löschbar." },
      { status: 409 },
    );
  }

  // Sicherheit (3): „Innen fehlt"-Auto (außen kontrolliert + live, Innenansicht
  // aber noch NICHT kontrolliert) ist kein Geist → nicht löschbar.
  const ctrl = await db
    .prepare(
      `SELECT
         (CASE WHEN EXISTS (SELECT 1 FROM controll_status WHERE vehicle_id = ? AND mode = 'inside' AND status = 'correct') THEN 1 ELSE 0 END) AS inside_ctrl,
         (CASE WHEN EXISTS (SELECT 1 FROM controll_status WHERE vehicle_id = ? AND status = 'correct') THEN 1 ELSE 0 END) AS any_ctrl`,
    )
    .bind(id, id)
    .first<{ inside_ctrl: number; any_ctrl: number }>();
  if (ctrl && ctrl.any_ctrl === 1 && ctrl.inside_ctrl === 0) {
    return jsonResponse(
      {
        error:
          "Innenansicht noch offen (außen live, innen fehlt) — kein Geist, nicht löschbar.",
      },
      { status: 409 },
    );
  }

  // R2-Objekte im Controlling-Bucket löschen.
  const seg = (s: string | number | null | undefined) => String(s ?? "").trim();
  const prefix = `v1/${seg(row.format)}/${seg(row.resolution)}/${seg(row.marke)}/${seg(row.modell)}/${seg(row.jahr)}/${seg(row.body)}/${seg(row.trim)}/${seg(row.farbe)}/`;
  let deletedObjects = 0;
  let cursor: string | undefined;
  try {
    do {
      const listing = await bucket.list({ prefix, cursor, limit: 1000 });
      const keys = listing.objects.map((o) => o.key);
      if (keys.length > 0) {
        await bucket.delete(keys);
        deletedObjects += keys.length;
      }
      cursor = listing.truncated ? listing.cursor : undefined;
    } while (cursor);
  } catch (err) {
    return jsonResponse(
      {
        error: "R2-Löschen (Controlling) fehlgeschlagen.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  // controll_status + Controlling-Zeile löschen.
  await db
    .prepare(`DELETE FROM controll_status WHERE vehicle_id = ?`)
    .bind(id)
    .run();
  await db.prepare(`DELETE FROM ${STORAGE_TABLE} WHERE id = ?`).bind(id).run();

  return jsonResponse(
    { deleted: true, id, deletedObjects, publicId: live.id, prefix },
    { status: 200 },
  );
};
