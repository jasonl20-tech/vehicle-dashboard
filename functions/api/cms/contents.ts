/**
 * CMS — Content-Einträge (D1 `website` → `cms_contents`).
 *
 *   GET  /api/cms/contents?content_model_id=&status=&locale=&q=&limit=&offset=
 *   POST /api/cms/contents
 *        { id?, content_model_id, payload_json, status?, locale? }
 *
 * `last_updated_by` setzt die API aus der Session (User-ID).
 */
import {
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
  type SessionUser,
} from "../../_lib/auth";
import { requireWebsiteDb } from "../../_lib/websiteDb";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;
const MAX_PAYLOAD_LEN = 2_000_000;

type ContentRow = {
  id: string;
  content_model_id: string;
  payload_json: string;
  status: string;
  locale: string;
  created_at: string;
  updated_at: string;
  last_updated_by: string | null;
};

function tableHint(e: unknown): string | null {
  const msg = (e as Error)?.message || String(e);
  if (/no such table/i.test(msg) || /cms_contents/.test(msg)) {
    return "Migration: `d1/migrations/0013_cms_content.sql`.";
  }
  return null;
}

function lastUpdater(user: SessionUser): string {
  return String(user.id);
}

function normalizePayload(raw: unknown): string | Response {
  let s: string;
  if (raw === undefined || raw === null) {
    return jsonResponse({ error: "payload_json fehlt" }, { status: 400 });
  }
  if (typeof raw === "string") {
    try {
      JSON.parse(raw);
      s = raw;
    } catch {
      return jsonResponse(
        { error: "payload_json muss gültiges JSON sein" },
        { status: 400 },
      );
    }
  } else if (typeof raw === "object") {
    s = JSON.stringify(raw);
  } else {
    return jsonResponse({ error: "payload_json ungültig" }, { status: 400 });
  }
  if (s.length > MAX_PAYLOAD_LEN) {
    return jsonResponse({ error: "payload_json zu groß" }, { status: 400 });
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
  const modelId = (url.searchParams.get("content_model_id") || "").trim();
  const status = (url.searchParams.get("status") || "").trim();
  const locale = (url.searchParams.get("locale") || "").trim();
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

  if (modelId) {
    where.push("content_model_id = ?");
    binds.push(modelId);
  }
  if (status) {
    where.push("status = ?");
    binds.push(status);
  }
  if (locale) {
    where.push("locale = ?");
    binds.push(locale);
  }
  if (q) {
    const pat = `%${q.replace(/[%_]/g, "")}%`;
    where.push(
      "(id LIKE ? OR payload_json LIKE ? OR ifnull(last_updated_by,'') LIKE ?)",
    );
    binds.push(pat, pat, pat);
  }

  const whereSql = ` WHERE ${where.join(" AND ")}`;

  try {
    const total =
      (
        await db
          .prepare(`SELECT COUNT(*) AS n FROM cms_contents${whereSql}`)
          .bind(...binds)
          .first<{ n: number }>()
      )?.n ?? 0;

    const { results } = await db
      .prepare(
        `SELECT id, content_model_id, payload_json, status, locale,
                created_at, updated_at, last_updated_by
           FROM cms_contents${whereSql}
           ORDER BY datetime(updated_at) DESC
           LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, offset)
      .all<ContentRow>();

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
  content_model_id?: string;
  payload_json?: unknown;
  status?: string;
  locale?: string;
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

  const contentModelId =
    typeof body.content_model_id === "string"
      ? body.content_model_id.trim()
      : "";
  if (!contentModelId) {
    return jsonResponse({ error: "content_model_id fehlt" }, { status: 400 });
  }

  const payload = normalizePayload(body.payload_json);
  if (payload instanceof Response) return payload;

  const status =
    typeof body.status === "string" && body.status.trim()
      ? body.status.trim().slice(0, 64)
      : "draft";
  const locale =
    typeof body.locale === "string" && body.locale.trim()
      ? body.locale.trim().slice(0, 32)
      : "de-DE";

  const id =
    typeof body.id === "string" && body.id.trim()
      ? body.id.trim()
      : crypto.randomUUID();

  if (id.length > 200 || !/^[a-zA-Z0-9_.\-:]+$/.test(id)) {
    return jsonResponse({ error: "id ungültig" }, { status: 400 });
  }

  const exists = await db
    .prepare("SELECT id FROM cms_content_models WHERE id = ? LIMIT 1")
    .bind(contentModelId)
    .first<{ id: string }>();
  if (!exists) {
    return jsonResponse({ error: "content_model_id unbekannt" }, { status: 400 });
  }

  const updater = lastUpdater(user);

  try {
    await db
      .prepare(
        `INSERT INTO cms_contents (
           id, content_model_id, payload_json, status, locale, last_updated_by
         ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, contentModelId, payload, status, locale, updater)
      .run();

    const row = await db
      .prepare(
        `SELECT id, content_model_id, payload_json, status, locale,
                created_at, updated_at, last_updated_by
           FROM cms_contents WHERE id = ?`,
      )
      .bind(id)
      .first<ContentRow>();

    return jsonResponse(row, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (/UNIQUE|unique/i.test(msg)) {
      return jsonResponse({ error: "id bereits vergeben" }, { status: 409 });
    }
    const hint = tableHint(e);
    return jsonResponse(
      { error: msg, ...(hint ? { hint } : {}) },
      { status: hint ? 503 : 500 },
    );
  }
};
