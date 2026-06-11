/**
 * GET /api/databases/vehicle-imagery
 * PUT /api/databases/vehicle-imagery
 *
 * D1 `vehicledatabase` → `vehicleimagery_public_storage`
 *
 * GET: Query `id=` → ein Datensatz { row, cdnBase, imageUrlQuery }
 * GET: sonst Liste: q, limit, offset, active=all|1|0, genehmigt=all|1|0 (optional),
 *      views_mode=korrektur|transparenz|skalierung|schatten (optional, filtert Feld `views`):
 *      transparenz: enthält `#trp`, skalierung: enthält `#skaliert` (inkl. `#skaliert_weiß` usw.),
 *      schatten: `#shadow`, korrektur: keines dieser Muster,
 *      strukturierte Filter: id, marke, modell, jahr, body, trim, farbe, resolution, format,
 *      updated_from, updated_to (YYYY-MM-DD, bezieht sich auf date(last_updated))
 * PUT: Body { id, active: 0|1 }
 *
 * Response: `imageUrlQuery` = `?key=` + encodiertes `env.image_url_secret`.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const MAX_LIMIT = 150;
const DEFAULT_LIMIT = 40;
const DEFAULT_CDN_BASE = "https://bildurl.vehicleimagery.com";

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

/** Eine Eingabe zu LIKE-%mehrere_Wörter% — einzelne Zeichen % und _ in der Suche entfernen. */
function likePatternForToken(t: string): string {
  const x = t.replace(/[%_]/g, "").trim();
  if (!x) return "";
  return `%${x}%`;
}

/**
 * Freitext in Wörter (Whitespace) splitten, für jedes Wort ein Muster bauen.
 * Leere Tokens fallen weg, max. 24 Wörter.
 */
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
  OR CAST(ifnull(genehmigt, 0) AS TEXT) LIKE ?
)`;
const BINDS_PER_TOKEN = 13;

export type VehicleImageryPublicRow = {
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
  genehmigt: number | null;
};

function cdnBaseFromEnv(env: AuthEnv): string {
  const raw = (env.IMAGE_CDN_BASE || "").trim();
  if (raw) return raw.replace(/\/$/, "");
  return DEFAULT_CDN_BASE;
}

/**
 * An jede Bild-URL: `?key=<image_url_secret>` (Secret URL-encodiert).
 */
function imageUrlQueryFromEnv(env: AuthEnv): string {
  const s = (env.image_url_secret ?? "").trim();
  if (!s) return "";
  return `?key=${encodeURIComponent(s)}`;
}

const SELECT_LIST = `SELECT
  id, marke, modell, jahr, body, trim, farbe, resolution, format, views, sonstiges, active, last_updated, genehmigt
FROM vehicleimagery_public_storage`;

/** LIKE-Muster mit entfernten Wildcards; leer = kein Filter */
function likeContainsUserInput(raw: string): string | null {
  const esc = raw.replace(/[%_]/g, "").trim();
  if (!esc) return null;
  return `%${esc}%`;
}

function isYyyyMmDd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

/** Filter auf `vehicleimagery_public_storage.views` für die Control Platform. */
const VIEWS_MODES = ["korrektur", "transparenz", "skalierung", "schatten"] as const;
type ViewsMode = (typeof VIEWS_MODES)[number];

function isViewsMode(s: string): s is ViewsMode {
  return (VIEWS_MODES as readonly string[]).includes(s);
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
      .first<VehicleImageryPublicRow>();
    if (!row) {
      return jsonResponse({ error: "Nicht gefunden" }, { status: 404 });
    }
    const cdnBase = cdnBaseFromEnv(env);
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

  const genehmigtRaw = (url.searchParams.get("genehmigt") || "all")
    .trim()
    .toLowerCase();
  if (!["all", "0", "1", ""].includes(genehmigtRaw)) {
    return jsonResponse(
      { error: "genehmigt muss leer, all, 0 oder 1 sein" },
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

  // Mehrfach-Farben: `farben=blue,black` → `lower(farbe) IN (...)`.
  const farbenList = (url.searchParams.get("farben") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);

  // Jahr-Bereich (zusätzlich zum exakten `jahr`).
  const jahrFrom = (url.searchParams.get("jahr_from") || "").trim();
  const jahrTo = (url.searchParams.get("jahr_to") || "").trim();
  if (jahrFrom && !/^-?\d+$/.test(jahrFrom)) {
    return jsonResponse({ error: "jahr_from ungültig" }, { status: 400 });
  }
  if (jahrTo && !/^-?\d+$/.test(jahrTo)) {
    return jsonResponse({ error: "jahr_to ungültig" }, { status: 400 });
  }

  // Anzahl Ansichten (;-Tokens) Bereich.
  const viewsMin = (url.searchParams.get("views_min") || "").trim();
  const viewsMax = (url.searchParams.get("views_max") || "").trim();
  if (viewsMin && !/^\d+$/.test(viewsMin)) {
    return jsonResponse({ error: "views_min ungültig" }, { status: 400 });
  }
  if (viewsMax && !/^\d+$/.test(viewsMax)) {
    return jsonResponse({ error: "views_max ungültig" }, { status: 400 });
  }

  const where: string[] = ["1=1"];
  const binds: (string | number)[] = [];

  if (activeRaw === "0" || activeRaw === "1") {
    where.push("active = ?");
    binds.push(activeRaw === "1" ? 1 : 0);
  }

  if (genehmigtRaw === "0" || genehmigtRaw === "1") {
    where.push("ifnull(genehmigt, 0) = ?");
    binds.push(genehmigtRaw === "1" ? 1 : 0);
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

  if (farbenList.length > 0) {
    const placeholders = farbenList.map(() => "?").join(", ");
    where.push(`lower(ifnull(farbe, '')) IN (${placeholders})`);
    for (const f of farbenList) binds.push(f);
  }

  if (jahrFrom) {
    where.push("jahr >= ?");
    binds.push(Number(jahrFrom));
  }
  if (jahrTo) {
    where.push("jahr <= ?");
    binds.push(Number(jahrTo));
  }

  // Anzahl Ansichten = Anzahl `;`-getrennter Tokens (leere views = 0).
  const VIEWS_COUNT_EXPR =
    "(CASE WHEN ifnull(views, '') = '' THEN 0 ELSE (length(views) - length(replace(views, ';', '')) + 1) END)";
  if (viewsMin) {
    where.push(`${VIEWS_COUNT_EXPR} >= ?`);
    binds.push(Number(viewsMin));
  }
  if (viewsMax) {
    where.push(`${VIEWS_COUNT_EXPR} <= ?`);
    binds.push(Number(viewsMax));
  }

  /*
   * `views_mode` wird derzeit nicht mehr serverseitig gefiltert (alle Zeilen pro Modus).
   * Validierung bleibt aus API-Kompatibilitätsgründen.
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

  /* Pro Suchwort: irgendein passendes Feld; alle Wörter müssen (AND) erfüllt sein. */
  for (const pat of searchTokens) {
    where.push(SEARCH_OR_SQL);
    for (let i = 0; i < BINDS_PER_TOKEN; i++) binds.push(pat);
  }

  const whereSql = ` WHERE ${where.join(" AND ")}`;

  const countRow = await db
    .prepare(`SELECT COUNT(*) as n FROM vehicleimagery_public_storage${whereSql}`)
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
    .all<VehicleImageryPublicRow>();

  const cdnBase = cdnBaseFromEnv(env);
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
      `UPDATE vehicleimagery_public_storage
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
    .first<VehicleImageryPublicRow>();
  if (!row) {
    return jsonResponse({ error: "Nicht gefunden" }, { status: 404 });
  }
  const cdnBase = cdnBaseFromEnv(env);
  const imageUrlQuery = imageUrlQueryFromEnv(env);
  return jsonResponse({ row, cdnBase, imageUrlQuery }, { status: 200 });
};

/**
 * DELETE /api/databases/vehicle-imagery?id=…
 *
 * Löscht ein Fahrzeug vollständig:
 *  1. Listet alle R2-Objekte unter dem Prefix `v1/{format}/…/{farbe}/` im
 *     Bucket `vehicleimagery-public` (Binding `env.publicbucket`) und löscht sie.
 *     Die DeleteObject-Events triggern den Sync-Worker `snyc-r2-buckets`, der
 *     die Ansichten aus `views` entfernt.
 *  2. Löscht zusätzlich die DB-Zeile direkt (sofortiges Feedback; der Worker
 *     macht für die bereits gelöschte Zeile dann nur noch No-op).
 *
 * Hinweis: Public-Bucket-Keys sind dekodiert abgelegt → Roh-Felder als Prefix.
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

  const bucket = env.publicbucket;
  if (!bucket) {
    return jsonResponse(
      {
        error:
          "R2-Binding `publicbucket` (vehicleimagery-public) fehlt. Im Pages-Projekt → Settings → Functions → R2-Bindings als `publicbucket` (env.publicbucket) ergänzen.",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const id = Number((url.searchParams.get("id") || "").trim());
  if (!Number.isInteger(id) || id < 1) {
    return jsonResponse({ error: "id ungültig" }, { status: 400 });
  }

  const row = await db
    .prepare(
      `SELECT id, marke, modell, jahr, body, trim, farbe, resolution, format
       FROM vehicleimagery_public_storage WHERE id = ?`,
    )
    .bind(id)
    .first<{
      id: number;
      marke: string | null;
      modell: string | null;
      jahr: number | null;
      body: string | null;
      trim: string | null;
      farbe: string | null;
      resolution: string | null;
      format: string | null;
    }>();
  if (!row) {
    return jsonResponse({ error: "Nicht gefunden" }, { status: 404 });
  }

  const seg = (s: string | number | null | undefined) =>
    String(s ?? "").trim();
  const prefix = `v1/${seg(row.format)}/${seg(row.resolution)}/${seg(row.marke)}/${seg(row.modell)}/${seg(row.jahr)}/${seg(row.body)}/${seg(row.trim)}/${seg(row.farbe)}/`;

  let deleted = 0;
  let cursor: string | undefined;
  try {
    do {
      const listing = await bucket.list({ prefix, cursor, limit: 1000 });
      const keys = listing.objects.map((o) => o.key);
      if (keys.length > 0) {
        await bucket.delete(keys);
        deleted += keys.length;
      }
      cursor = listing.truncated ? listing.cursor : undefined;
    } while (cursor);
  } catch (err) {
    return jsonResponse(
      {
        error: "R2-Löschen fehlgeschlagen.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  await db
    .prepare(`DELETE FROM vehicleimagery_public_storage WHERE id = ?`)
    .bind(id)
    .run();

  return jsonResponse({ deleted, id, prefix }, { status: 200 });
};
