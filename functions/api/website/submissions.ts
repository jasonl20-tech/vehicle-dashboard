/**
 * GET /api/website/submissions
 *
 * D1 `website` → Tabelle `submissions` (nur SELECT).
 * Query: q, limit, offset, spam=all|0|1, ansicht=offen|alle (Standard: nur offene, erledigt=0)
 * PATCH Body: { id: string, erledigt: 0 | 1 }
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const MAX_LIMIT = 150;
const DEFAULT_LIMIT = 35;

type SubmissionRowDb = {
  id: string;
  created_at: string;
  form_tag: string;
  payload: string;
  metadata: string;
  spam: number;
  erledigt: number;
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
  OR ifnull(form_tag, '') LIKE ?
  OR ifnull(payload, '') LIKE ?
  OR ifnull(metadata, '') LIKE ?
)`;
const BINDS_PER_TOKEN = 4;

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return s;
  }
}

function mapRow(
  r: SubmissionRowDb,
): {
  id: string;
  created_at: string;
  form_tag: string;
  payload: unknown;
  metadata: unknown;
  spam: boolean;
  erledigt: boolean;
} {
  return {
    id: r.id,
    created_at: r.created_at,
    form_tag: r.form_tag,
    payload: tryParseJson(r.payload),
    metadata: tryParseJson(r.metadata),
    spam: Number(r.spam) === 1,
    erledigt: Number(r.erledigt) === 1,
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
  const spamRaw = (url.searchParams.get("spam") || "all").trim().toLowerCase();
  if (!["all", "0", "1", ""].includes(spamRaw)) {
    return jsonResponse(
      { error: "spam muss leer, all, 0 oder 1 sein" },
      { status: 400 },
    );
  }

  const ansichtRaw = (url.searchParams.get("ansicht") || "offen").trim().toLowerCase();
  if (!["offen", "alle"].includes(ansichtRaw)) {
    return jsonResponse(
      { error: "ansicht muss offen oder alle sein" },
      { status: 400 },
    );
  }

  const where: string[] = ["1=1"];
  const binds: (string | number)[] = [];

  if (ansichtRaw === "offen") {
    where.push("(ifnull(erledigt, 0) = 0)");
  }

  if (spamRaw === "0" || spamRaw === "1") {
    where.push("spam = ?");
    binds.push(spamRaw === "1" ? 1 : 0);
  }

  for (const pat of tokens) {
    where.push(OR_FIELDS);
    for (let i = 0; i < BINDS_PER_TOKEN; i++) binds.push(pat);
  }

  const whereSql = ` WHERE ${where.join(" AND ")}`;

  const countRow = await db
    .prepare(`SELECT COUNT(*) as n FROM submissions${whereSql}`)
    .bind(...binds)
    .first<{ n: number }>();
  const total = countRow?.n ?? 0;

  const listSql = `SELECT
  id, created_at, form_tag, payload, metadata, spam, erledigt
FROM submissions
${whereSql}
ORDER BY created_at DESC
LIMIT ? OFFSET ?`;
  const { results } = await db
    .prepare(listSql)
    .bind(...binds, limit, offset)
    .all<SubmissionRowDb>();

  const rows = (results ?? []).map(mapRow);
  return jsonResponse({ rows, total, offset, limit }, { status: 200 });
};

export const onRequestPatch: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireWebsiteDb(env);
  if (db instanceof Response) return db;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "JSON erwartet" }, { status: 400 });
  }

  const b = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};

  const id = typeof b.id === "string" ? b.id.trim() : "";
  if (!id) {
    return jsonResponse({ error: "id fehlt" }, { status: 400 });
  }

  const erRaw = b.erledigt;
  const erNum =
    erRaw === true || erRaw === 1
      ? 1
      : erRaw === false || erRaw === 0
        ? 0
        : null;

  if (erNum === null) {
    return jsonResponse(
      { error: "erledigt muss boolean oder 0 bzw. 1 sein" },
      { status: 400 },
    );
  }

  const res = await db
    .prepare("UPDATE submissions SET erledigt = ? WHERE id = ?")
    .bind(erNum, id)
    .run();

  const changed = res.meta?.changes ?? 0;
  if (changed === 0) {
    return jsonResponse(
      { error: "Keine Zeile aktualisiert (ID unbekannt?)" },
      { status: 404 },
    );
  }

  return jsonResponse({ ok: true }, { status: 200 });
};
