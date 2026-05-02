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
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

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

const SEARCH_OR_SQL = `(
  CAST(id AS TEXT) LIKE ?
  OR ifnull(marke, '') LIKE ?
  OR ifnull(modell, '') LIKE ?
  OR CAST(jahr AS TEXT) LIKE ?
  OR ifnull(body, '') LIKE ?
  OR ifnull(trim, '') LIKE ?
  OR ifnull(farbe, '') LIKE ?
  OR ifnull(resolution, '') LIKE ?
  OR ifnull(format, '') LIKE ?
  OR ifnull(views, '') LIKE ?
  OR ifnull(sonstiges, '') LIKE ?
  OR ifnull(last_updated, '') LIKE ?
)`;
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

const SELECT_LIST = `SELECT
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

function viewsModeWhereSql(mode: ViewsMode): { clause: string; binds: string[] } {
  const v = "lower(ifnull(views, ''))";

  if (mode === "transparenz") {
    return { clause: `${v} LIKE ?`, binds: ["%#trp%"] };
  }
  if (mode === "skalierung") {
    return { clause: `${v} LIKE ?`, binds: ["%#skaliert%"] };
  }
  if (mode === "schatten") {
    return { clause: `${v} LIKE ?`, binds: ["%#shadow%"] };
  }
  return {
    clause: `(${v} NOT LIKE ? AND ${v} NOT LIKE ? AND ${v} NOT LIKE ?)`,
    binds: ["%#trp%", "%#shadow%", "%#skaliert%"],
  };
}

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
      .prepare(`${SELECT_LIST} WHERE id = ?`)
      .bind(oneId)
      .first<VehicleImageryControllingRow>();
    if (!row) {
      return jsonResponse({ error: "Nicht gefunden" }, { status: 404 });
    }
    const cdnBase = controllingCdnBaseFromEnv(env);
    const imageUrlQuery = imageUrlQueryFromEnv(env);
    return jsonResponse(
      { row, cdnBase, imageUrlQuery },
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

  const where: string[] = ["1=1"];
  const binds: (string | number)[] = [];

  if (activeRaw === "0" || activeRaw === "1") {
    where.push("active = ?");
    binds.push(activeRaw === "1" ? 1 : 0);
  }

  if (updatedFrom) {
    where.push("date(last_updated) >= date(?)");
    binds.push(updatedFrom);
  }
  if (updatedTo) {
    where.push("date(last_updated) <= date(?)");
    binds.push(updatedTo);
  }

  if (filterId) {
    where.push("id = ?");
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
      where.push(`ifnull(${col}, '') LIKE ?`);
      binds.push(pat);
    }
  }

  if (filterJahr) {
    where.push("jahr = ?");
    binds.push(Number(filterJahr));
  }

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
  if (viewsModeRaw) {
    const ex = viewsModeWhereSql(viewsModeRaw);
    where.push(`(${ex.clause})`);
    binds.push(...ex.binds);
  }

  for (const pat of searchTokens) {
    where.push(SEARCH_OR_SQL);
    for (let i = 0; i < BINDS_PER_TOKEN; i++) binds.push(pat);
  }

  const whereSql = ` WHERE ${where.join(" AND ")}`;

  const countRow = await db
    .prepare(`SELECT COUNT(*) as n FROM ${STORAGE_TABLE}${whereSql}`)
    .bind(...binds)
    .first<{ n: number }>();
  const total = countRow?.n ?? 0;

  const listSql = `${SELECT_LIST}
${whereSql}
ORDER BY last_updated DESC, id DESC
LIMIT ? OFFSET ?`;
  const { results } = await db
    .prepare(listSql)
    .bind(...binds, limit, offset)
    .all<VehicleImageryControllingRow>();

  const cdnBase = controllingCdnBaseFromEnv(env);
  const imageUrlQuery = imageUrlQueryFromEnv(env);

  return jsonResponse(
    {
      rows: results ?? [],
      total,
      offset,
      limit,
      cdnBase,
      imageUrlQuery,
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
    .prepare(`${SELECT_LIST} WHERE id = ?`)
    .bind(id)
    .first<VehicleImageryControllingRow>();
  if (!row) {
    return jsonResponse({ error: "Nicht gefunden" }, { status: 404 });
  }
  const cdnBase = controllingCdnBaseFromEnv(env);
  const imageUrlQuery = imageUrlQueryFromEnv(env);
  return jsonResponse({ row, cdnBase, imageUrlQuery }, { status: 200 });
};
