/**
 * CRM-Kunden (D1 `customers`).
 *
 *   GET  /api/crm/customers?q=&limit=&offset=
 *   POST /api/crm/customers  { id?, email, company?, status? }
 *   PUT  /api/crm/customers  { id, email?, company?, status? }  (email-Wechsel nur ohne Konflikt)
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

type CustomerRowDb = {
  id: string;
  created_at: string;
  email: string;
  company: string | null;
  status: string | null;
};

function requireCustomersDb(env: AuthEnv): D1Database | Response {
  if (!env.customers) {
    return jsonResponse(
      {
        error:
          "D1-Binding `customers` fehlt. Im Cloudflare-Dashboard → Functions → D1, Variable `customers` (env.customers) auf die Datenbank mit Tabelle `customers` setzen.",
      },
      { status: 503 },
    );
  }
  return env.customers;
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
  const db = requireCustomersDb(env);
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
      `SELECT id, created_at, email, company, status FROM customers${whereSql} ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`,
    )
    .bind(...binds, limit, offset)
    .all<CustomerRowDb>();

  const rows = (results ?? []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    email: r.email,
    company: r.company ?? "",
    status: r.status ?? "Neu",
  }));

  return jsonResponse({ rows, total, offset, limit }, { status: 200 });
};

type PostBody = {
  id?: string;
  email?: string;
  company?: string | null;
  status?: string | null;
};

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireCustomersDb(env);
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

  try {
    await db
      .prepare(
        `INSERT INTO customers (id, email, company, status) VALUES (?, ?, ?, ?)`,
      )
      .bind(id, email, company, status)
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
    { ok: true, id, email, company: company ?? "", status },
    { status: 201 },
  );
};

type PutBody = {
  id?: string;
  email?: string;
  company?: string | null;
  status?: string | null;
};

export const onRequestPut: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireCustomersDb(env);
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
      `SELECT id, email, company, status FROM customers WHERE id = ? LIMIT 1`,
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

  try {
    await db
      .prepare(
        `UPDATE customers SET email = ?, company = ?, status = ? WHERE id = ?`,
      )
      .bind(nextEmail, nextCompany, nextStatus, id)
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
    },
    { status: 200 },
  );
};
