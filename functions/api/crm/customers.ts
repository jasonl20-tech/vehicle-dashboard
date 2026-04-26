/**
 * CRM-Kunden — Tabelle `customers` in derselben D1-DB wie `submissions` (Binding `website`).
 *
 *   GET  /api/crm/customers?q=&limit=&offset=
 *   POST /api/crm/customers  { id?, email, company?, status?, standort? }
 *   PUT  /api/crm/customers  { id, email?, company?, status?, standort? }  (email-Wechsel nur ohne Konflikt)
 *
 * `standort` ist ISO-3166-Alpha-2 (z. B. "DE", "AT"). Leerstring oder `null`
 * räumt das Feld; serverseitig wird ein Regex auf 2 Buchstaben geprüft.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const ISO2_RE = /^[A-Z]{2}$/;

type CustomerRowDb = {
  id: string;
  created_at: string;
  email: string;
  company: string | null;
  status: string | null;
  standort: string | null;
};

/**
 * Akzeptiert ISO-2 case-insensitiv. Leerstring/`null`/`undefined` → `null`
 * (löschen). Ungültiges Token → `Error`. Wird per `parseStandort()` aus dem
 * Body-Wert erzeugt (POST/PUT).
 */
function parseStandort(v: unknown): string | null | Error {
  if (v === undefined) return new Error("undefined");
  if (v === null) return null;
  if (typeof v !== "string") return new Error("standort muss string sein");
  const t = v.trim().toUpperCase();
  if (!t) return null;
  if (!ISO2_RE.test(t)) {
    return new Error("standort muss ein ISO-3166-Alpha-2-Code sein (z. B. DE)");
  }
  return t;
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
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit") || DEFAULT_LIMIT) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);
  const pat = likeToken(q);

  const where: string[] = ["1=1"];
  const binds: (string | number)[] = [];
  if (pat) {
    where.push("(email LIKE ? OR IFNULL(company,'') LIKE ?)");
    binds.push(pat, pat);
  }
  const whereSql = ` WHERE ${where.join(" AND ")}`;

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM customers${whereSql}`)
    .bind(...binds)
    .first<{ n: number }>();
  const total = countRow?.n ?? 0;

  const { results } = await db
    .prepare(
      `SELECT id, created_at, email, company, status, standort FROM customers${whereSql} ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`,
    )
    .bind(...binds, limit, offset)
    .all<CustomerRowDb>();

  const rows = (results ?? []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    email: r.email,
    company: r.company ?? "",
    status: r.status ?? "Neu",
    standort: r.standort ?? "",
  }));

  return jsonResponse({ rows, total, offset, limit }, { status: 200 });
};

type PostBody = {
  id?: string;
  email?: string;
  company?: string | null;
  status?: string | null;
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

  let standort: string | null;
  if (body.standort === undefined) {
    standort = null;
  } else {
    const parsed = parseStandort(body.standort);
    if (parsed instanceof Error) {
      return jsonResponse({ error: parsed.message }, { status: 400 });
    }
    standort = parsed;
  }

  try {
    await db
      .prepare(
        `INSERT INTO customers (id, email, company, status, standort) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, email, company, status, standort)
      .run();
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
      standort: standort ?? "",
    },
    { status: 201 },
  );
};

type PutBody = {
  id?: string;
  email?: string;
  company?: string | null;
  status?: string | null;
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

  const cur = await db
    .prepare(
      `SELECT id, created_at, email, company, status, standort FROM customers WHERE id = ? LIMIT 1`,
    )
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

  let nextStandort: string | null;
  if (body.standort === undefined) {
    nextStandort = cur.standort ?? null;
  } else {
    const parsed = parseStandort(body.standort);
    if (parsed instanceof Error) {
      return jsonResponse({ error: parsed.message }, { status: 400 });
    }
    nextStandort = parsed;
  }

  try {
    await db
      .prepare(
        `UPDATE customers SET email = ?, company = ?, status = ?, standort = ? WHERE id = ?`,
      )
      .bind(nextEmail, nextCompany, nextStatus, nextStandort, id)
      .run();
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
      standort: nextStandort ?? "",
    },
    { status: 200 },
  );
};
