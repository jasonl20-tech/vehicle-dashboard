/**
 * CRM-Kunden — Tabelle `customers` in derselben D1-DB wie `submissions` (Binding `website`).
 *
 *   GET  /api/crm/customers?q=&limit=&offset=&status=&location=
 *   POST /api/crm/customers  { id?, email, company?, status?, location? }
 *   PUT  /api/crm/customers  { id, email?, company?, status?, location? }
 *
 * Landeskürzel liegt in der Spalte **`location`** (ISO-3166-Alpha-2). Für ältere
 * Installationen wird **`standort`** noch als DB-Spalte und Body-Alias unterstützt.
 *
 * JSON-Antwort nutzt immer **`location`** (leerer String = nicht gesetzt).
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const ISO2_RE = /^[A-Z]{2}$/;

type GeoCol = "location" | "standort";

type CustomerRowDb = {
  id: string;
  created_at: string;
  email: string;
  company: string | null;
  status: string | null;
  location?: string | null;
  standort?: string | null;
};

function parseLocationIso2(v: unknown): string | null | Error {
  if (v === undefined) return new Error("undefined");
  if (v === null) return null;
  if (typeof v !== "string") return new Error("location muss string sein");
  const t = v.trim().toUpperCase();
  if (!t) return null;
  if (!ISO2_RE.test(t)) {
    return new Error(
      "location muss ein ISO-3166-Alpha-2-Code sein (z. B. DE)",
    );
  }
  return t;
}

/** Body: `location` bevorzugt, `standort` nur noch Alias. */
function bodyLocationInput(body: {
  location?: unknown;
  standort?: unknown;
}): unknown {
  if (body.location !== undefined) return body.location;
  return body.standort;
}

function requireWebsiteDb(env: AuthEnv): D1Database | Response {
  if (!env.website) {
    return jsonResponse(
      {
        error:
          "D1-Binding `website` fehlt. Im Cloudflare-Dashboard → Functions → D1, Variable `website` (env.website) setzen.",
      },
      { status: 503 },
    );
  }
  return env.website;
}

/**
 * Welche Spalte enthält das ISO-2-Land? Bevorzugt `location`, sonst Legacy `standort`.
 */
async function getGeoColumn(db: D1Database): Promise<GeoCol | null> {
  try {
    const r = await db
      .prepare(`PRAGMA table_info(customers)`)
      .all<{ name: string }>();
    const cols = (r.results ?? []).map((c) => String(c.name).toLowerCase());
    if (cols.includes("location")) return "location";
    if (cols.includes("standort")) return "standort";
    return null;
  } catch {
    return null;
  }
}

function likeToken(q: string): string {
  const x = q.replace(/[%_]/g, "").trim();
  if (!x) return "";
  return `%${x}%`;
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireWebsiteDb(env);
  if (db instanceof Response) return db;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const statusF = (url.searchParams.get("status") || "").trim();
  const locationF = (url.searchParams.get("location") || "").trim().toUpperCase();
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit") || DEFAULT_LIMIT) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);
  const pat = likeToken(q);

  const geoCol = await getGeoColumn(db);

  const where: string[] = ["1=1"];
  const binds: (string | number)[] = [];
  if (pat) {
    where.push("(email LIKE ? OR IFNULL(company,'') LIKE ?)");
    binds.push(pat, pat);
  }
  if (statusF) {
    where.push("IFNULL(status,'') = ?");
    binds.push(statusF);
  }
  if (locationF && ISO2_RE.test(locationF) && geoCol) {
    where.push(`${geoCol} = ?`);
    binds.push(locationF);
  }
  const whereSql = ` WHERE ${where.join(" AND ")}`;

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM customers${whereSql}`)
    .bind(...binds)
    .first<{ n: number }>();
  const total = countRow?.n ?? 0;
  const cols =
    geoCol != null
      ? `id, created_at, email, company, status, ${geoCol} AS location`
      : "id, created_at, email, company, status";

  const { results } = await db
    .prepare(
      `SELECT ${cols} FROM customers${whereSql} ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`,
    )
    .bind(...binds, limit, offset)
    .all<CustomerRowDb>();

  const rows = (results ?? []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    email: r.email,
    company: r.company ?? "",
    status: r.status ?? "Neu",
    location: geoCol != null ? (r.location ?? "") : "",
  }));

  return jsonResponse(
    {
      rows,
      total,
      offset,
      limit,
      ...(geoCol == null
        ? {
            schemaWarning:
              "Keine Spalte `location` (oder Legacy `standort`) in `customers`. Optional: `ALTER TABLE customers ADD COLUMN location TEXT;` oder Migration `d1/migrations/0005_customers_location.sql`.",
          }
        : null),
    },
    { status: 200 },
  );
};

type PostBody = {
  id?: string;
  email?: string;
  company?: string | null;
  status?: string | null;
  location?: string | null;
  standort?: string | null;
};

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireWebsiteDb(env);
  if (db instanceof Response) return db;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return jsonResponse(
      { error: "email ist Pflicht und muss @ enthalten" },
      { status: 400 },
    );
  }
  const id =
    typeof body.id === "string" && body.id.trim()
      ? body.id.trim()
      : crypto.randomUUID();
  if (id.length > 200) {
    return jsonResponse({ error: "id zu lang" }, { status: 400 });
  }
  const company =
    typeof body.company === "string" ? body.company.trim() : null;
  const status =
    typeof body.status === "string" && body.status.trim()
      ? body.status.trim()
      : "Neu";

  let locationVal: string | null;
  if (bodyLocationInput(body) === undefined) {
    locationVal = null;
  } else {
    const parsed = parseLocationIso2(bodyLocationInput(body));
    if (parsed instanceof Error) {
      return jsonResponse({ error: parsed.message }, { status: 400 });
    }
    locationVal = parsed;
  }

  const geoCol = await getGeoColumn(db);

  try {
    if (geoCol != null) {
      await db
        .prepare(
          `INSERT INTO customers (id, email, company, status, ${geoCol}) VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(id, email, company, status, locationVal)
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO customers (id, email, company, status) VALUES (?, ?, ?, ?)`,
        )
        .bind(id, email, company, status)
        .run();
    }
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return jsonResponse(
        { error: "E-Mail oder ID existiert bereits" },
        { status: 409 },
      );
    }
    return jsonResponse({ error: msg }, { status: 500 });
  }

  return jsonResponse(
    {
      ok: true,
      id,
      email,
      company: company ?? "",
      status,
      location: geoCol != null ? (locationVal ?? "") : "",
      ...(geoCol == null
        ? {
            schemaWarning:
              "Keine Spalte `location` / `standort` – Land wurde nicht gespeichert. `ALTER TABLE customers ADD COLUMN location TEXT;` ausführen.",
          }
        : null),
    },
    { status: 201 },
  );
};

type PutBody = {
  id?: string;
  email?: string;
  company?: string | null;
  status?: string | null;
  location?: string | null;
  standort?: string | null;
};

export const onRequestPut: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireWebsiteDb(env);
  if (db instanceof Response) return db;

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return jsonResponse({ error: "id ist Pflicht" }, { status: 400 });
  }

  const geoCol = await getGeoColumn(db);
  const selectCols =
    geoCol != null
      ? `id, created_at, email, company, status, ${geoCol} AS location`
      : "id, created_at, email, company, status";
  const cur = await db
    .prepare(`SELECT ${selectCols} FROM customers WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<CustomerRowDb>();
  if (!cur) {
    return jsonResponse({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }

  const nextEmail =
    typeof body.email === "string" ? body.email.trim() : cur.email;
  if (!nextEmail.includes("@")) {
    return jsonResponse({ error: "email ungültig" }, { status: 400 });
  }
  const nextCompany =
    body.company === undefined
      ? cur.company
      : body.company == null
        ? null
        : String(body.company).trim() || null;
  const nextStatus =
    body.status === undefined
      ? cur.status
      : body.status == null
        ? null
        : String(body.status).trim() || "Neu";

  let nextLocation: string | null;
  if (bodyLocationInput(body) === undefined) {
    nextLocation = (cur.location ?? null) as string | null;
  } else {
    const parsed = parseLocationIso2(bodyLocationInput(body));
    if (parsed instanceof Error) {
      return jsonResponse({ error: parsed.message }, { status: 400 });
    }
    nextLocation = parsed;
  }

  try {
    if (geoCol != null) {
      await db
        .prepare(
          `UPDATE customers SET email = ?, company = ?, status = ?, ${geoCol} = ? WHERE id = ?`,
        )
        .bind(nextEmail, nextCompany, nextStatus, nextLocation, id)
        .run();
    } else {
      await db
        .prepare(
          `UPDATE customers SET email = ?, company = ?, status = ? WHERE id = ?`,
        )
        .bind(nextEmail, nextCompany, nextStatus, id)
        .run();
    }
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return jsonResponse(
        { error: "E-Mail wird bereits von einem anderen Datensatz genutzt" },
        { status: 409 },
      );
    }
    return jsonResponse({ error: msg }, { status: 500 });
  }

  return jsonResponse(
    {
      ok: true,
      id,
      created_at: cur.created_at,
      email: nextEmail,
      company: nextCompany ?? "",
      status: nextStatus ?? "Neu",
      location: geoCol != null ? (nextLocation ?? "") : "",
      ...(geoCol == null
        ? {
            schemaWarning:
              "Keine Spalte `location` / `standort` – Land wurde nicht gespeichert. `ALTER TABLE customers ADD COLUMN location TEXT;` ausführen.",
          }
        : null),
    },
    { status: 200 },
  );
};
