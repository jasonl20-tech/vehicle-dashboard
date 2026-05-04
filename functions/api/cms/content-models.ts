/**
 * CMS — Content-Modelle (D1 `website` → `cms_content_models`).
 *
 *   GET  /api/cms/content-models?q=&limit=&offset=
 *   POST /api/cms/content-models  { id?, key, description?, schema_json }
 *
 * Migration: d1/migrations/0013_cms_content.sql
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import { requireWebsiteDb } from "../../_lib/websiteDb";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;
const MAX_KEY_LEN = 128;
const MAX_SCHEMA_LEN = 400_000;
const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

type ModelRow = {
  id: string;
  key: string;
  description: string | null;
  schema_json: string;
  created_at: string;
  updated_at: string;
};

function tableHint(e: unknown): string | null {
  const msg = (e as Error)?.message || String(e);
  if (/no such table/i.test(msg) || /cms_content_models/.test(msg)) {
    return "Tabelle `cms_content_models` fehlt. Migration: `d1/migrations/0013_cms_content.sql`.";
  }
  return null;
}

function normalizeJsonField(
  raw: unknown,
  field: string,
  maxLen: number,
): string | Response {
  let s: string;
  if (raw === undefined || raw === null) {
    return jsonResponse({ error: `${field} fehlt` }, { status: 400 });
  }
  if (typeof raw === "string") {
    try {
      JSON.parse(raw);
      s = raw;
    } catch {
      return jsonResponse(
        { error: `${field} muss gültiges JSON sein` },
        { status: 400 },
      );
    }
  } else if (typeof raw === "object") {
    s = JSON.stringify(raw);
  } else {
    return jsonResponse({ error: `${field} ungültig` }, { status: 400 });
  }
  if (s.length > maxLen) {
    return jsonResponse({ error: `${field} zu groß` }, { status: 400 });
  }
  return s;
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });

  const db = requireWebsiteDb(env);
  if (db instanceof Response) return db;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      Number(url.searchParams.get("limit") || DEFAULT_LIMIT) || DEFAULT_LIMIT,
    ),
  );
  const offset = Math.max(
    0,
    Number(url.searchParams.get("offset") || 0) || 0,
  );

  const where: string[] = ["1=1"];
  const binds: string[] = [];
  if (q) {
    const pat = `%${q.replace(/[%_]/g, "")}%`;
    where.push("(id LIKE ? OR key LIKE ? OR description LIKE ?)");
    binds.push(pat, pat, pat);
  }
  const whereSql = ` WHERE ${where.join(" AND ")}`;

  try {
    const total =
      (
        await db
          .prepare(`SELECT COUNT(*) AS n FROM cms_content_models${whereSql}`)
          .bind(...binds)
          .first<{ n: number }>()
      )?.n ?? 0;

    const { results } = await db
      .prepare(
        `SELECT id, key, description, schema_json, created_at, updated_at
           FROM cms_content_models${whereSql}
           ORDER BY datetime(updated_at) DESC
           LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, offset)
      .all<ModelRow>();

    return jsonResponse({
      rows: results ?? [],
      total,
      limit,
      offset,
    });
  } catch (e) {
    const hint = tableHint(e);
    return jsonResponse(
      { error: (e as Error).message, ...(hint ? { hint } : {}) },
      { status: hint ? 503 : 500 },
    );
  }
};

type PostBody = {
  id?: string;
  key?: string;
  description?: string | null;
  schema_json?: unknown;
};

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });

  const db = requireWebsiteDb(env);
  if (db instanceof Response) return db;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return jsonResponse({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key || key.length > MAX_KEY_LEN || !KEY_RE.test(key)) {
    return jsonResponse(
      { error: "key fehlt oder ungültig (Buchstabe/Zahl/ _ -)" },
      { status: 400 },
    );
  }

  const schemaJson = normalizeJsonField(
    body.schema_json,
    "schema_json",
    MAX_SCHEMA_LEN,
  );
  if (schemaJson instanceof Response) return schemaJson;

  const id =
    typeof body.id === "string" && body.id.trim()
      ? body.id.trim()
      : crypto.randomUUID();

  if (id.length > 200 || !/^[a-zA-Z0-9_.\-:]+$/.test(id)) {
    return jsonResponse({ error: "id ungültig" }, { status: 400 });
  }

  const description =
    body.description === undefined || body.description === null
      ? null
      : String(body.description).slice(0, 2000);

  try {
    await db
      .prepare(
        `INSERT INTO cms_content_models (id, key, description, schema_json)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(id, key, description, schemaJson)
      .run();

    const row = await db
      .prepare(
        `SELECT id, key, description, schema_json, created_at, updated_at
           FROM cms_content_models WHERE id = ?`,
      )
      .bind(id)
      .first<ModelRow>();

    return jsonResponse(row, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (/UNIQUE|unique/i.test(msg)) {
      return jsonResponse(
        { error: "key oder id bereits vergeben" },
        { status: 409 },
      );
    }
    const hint = tableHint(e);
    return jsonResponse(
      { error: msg, ...(hint ? { hint } : {}) },
      { status: hint ? 503 : 500 },
    );
  }
};
