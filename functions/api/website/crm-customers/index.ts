/**
 * GET /api/website/crm-customers
 *
 * D1 `website` → Tabelle `crm_customers` (nur SELECT).
 * Query: q, limit, offset
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../../_lib/auth";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

type CrmRowDb = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  status: string;
  email_status: number;
  business_name: string | null;
  kv_key: string | null;
  additional_emails: string;
  notes: string | null;
};

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

function likeForToken(t: string): string {
  const x = t.replace(/[%_]/g, "").trim();
  if (!x) return "";
  return `%${x}%`;
}

function searchTokens(q: string): string[] {
  const words = q.trim().split(/\s+/);
  const out: string[] = [];
  for (const w of words) {
    const pat = likeForToken(w);
    if (pat) out.push(pat);
    if (out.length >= 20) break;
  }
  return out;
}

const OR_FIELDS = `(
  ifnull(id, '') LIKE ?
  OR ifnull(email, '') LIKE ?
  OR ifnull(business_name, '') LIKE ?
  OR ifnull(kv_key, '') LIKE ?
  OR ifnull(notes, '') LIKE ?
  OR ifnull(status, '') LIKE ?
  OR ifnull(additional_emails, '') LIKE ?
)`;
const BINDS_PER_TOKEN = 7;

function mapRow(r: CrmRowDb) {
  return { ...r };
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
  const tokens = searchTokens(q);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      Number(url.searchParams.get("limit") || DEFAULT_LIMIT) || DEFAULT_LIMIT,
    ),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);

  const where: string[] = ["1=1"];
  const binds: (string | number)[] = [];

  for (const pat of tokens) {
    where.push(OR_FIELDS);
    for (let i = 0; i < BINDS_PER_TOKEN; i++) binds.push(pat);
  }

  const whereSql = ` WHERE ${where.join(" AND ")}`;

  const countRow = await db
    .prepare(`SELECT COUNT(*) as n FROM crm_customers${whereSql}`)
    .bind(...binds)
    .first<{ n: number }>();
  const total = countRow?.n ?? 0;

  const listSql = `SELECT
  id, created_at, updated_at, email, status, email_status, business_name, kv_key, additional_emails, notes
FROM crm_customers
${whereSql}
ORDER BY updated_at DESC, created_at DESC
LIMIT ? OFFSET ?`;
  const { results } = await db
    .prepare(listSql)
    .bind(...binds, limit, offset)
    .all<CrmRowDb>();

  const rows = (results ?? []).map(mapRow);
  return jsonResponse({ rows, total, offset, limit }, { status: 200 });
};
