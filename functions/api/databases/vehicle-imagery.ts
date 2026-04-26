/**
 * GET /api/databases/vehicle-imagery
 * PUT /api/databases/vehicle-imagery
 *
 * D1 `vehicledatabase` → `vehicleimagery_public_storage`
 *
 * GET: Query `id=` → ein Datensatz { row, cdnBase, imageUrlQuery }
 * GET: sonst Liste: q, limit, offset, active=all|1|0
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

function likePattern(q: string): string {
  const t = q.replace(/[%_]/g, "").trim();
  if (!t) return "";
  return `%${t}%`;
}

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
  id, marke, modell, jahr, body, trim, farbe, resolution, format, views, sonstiges, active, last_updated
FROM vehicleimagery_public_storage`;

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
  const pat = likePattern(q);
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

  const where: string[] = ["1=1"];
  const binds: (string | number)[] = [];

  if (activeRaw === "0" || activeRaw === "1") {
    where.push("active = ?");
    binds.push(activeRaw === "1" ? 1 : 0);
  }

  if (pat) {
    where.push(
      `(
  ifnull(marke, '') LIKE ?
  OR ifnull(modell, '') LIKE ?
  OR CAST(jahr AS TEXT) LIKE ?
  OR ifnull(body, '') LIKE ?
  OR ifnull(trim, '') LIKE ?
  OR ifnull(farbe, '') LIKE ?
  OR ifnull(resolution, '') LIKE ?
  OR ifnull(format, '') LIKE ?
  OR ifnull(views, '') LIKE ?
  OR ifnull(sonstiges, '') LIKE ?
)`,
    );
    for (let i = 0; i < 10; i++) binds.push(pat);
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
