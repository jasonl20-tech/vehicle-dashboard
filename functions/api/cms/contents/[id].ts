/**
 * CMS — ein Content-Eintrag.
 *
 *   GET    /api/cms/contents/:id
 *   PUT    /api/cms/contents/:id  { content_model_id?, payload_json?, status?, locale?, scheduled_publish_at? }
 *   DELETE /api/cms/contents/:id
 */
import {
  assertCmsDestroyAllowed,
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
  type SessionUser,
} from "../../../_lib/auth";
import { requireWebsiteDb } from "../../../_lib/websiteDb";

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
  scheduled_publish_at: string | null;
};

function paramId(params: Record<string, string | string[] | undefined>): string {
  const v = params.id;
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length > 0) return v[0] ?? "";
  return "";
}

function tableHint(e: unknown): string | null {
  const msg = (e as Error)?.message || String(e);
  if (/no such table/i.test(msg)) {
    return "Migration: `d1/migrations/0013_cms_content.sql`.";
  }
  if (/scheduled_publish_at/i.test(msg)) {
    return "Migration: `d1/migrations/0014_cms_scheduled_publish.sql`.";
  }
  return null;
}

function lastUpdater(user: SessionUser): string {
  const n = user.benutzername?.trim();
  if (n) return n.slice(0, 256);
  return String(user.id);
}

function normalizeScheduledPublishAt(
  raw: unknown,
): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

function normalizePayload(raw: unknown): string | Response {
  let s: string;
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
  } else if (typeof raw === "object" && raw !== null) {
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
  params,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });

  const db = requireWebsiteDb(env);
  if (db instanceof Response) return db;

  const id = paramId(params).trim();
  if (!id) return jsonResponse({ error: "id fehlt" }, { status: 400 });

  try {
    const row = await db
      .prepare(
        `SELECT id, content_model_id, payload_json, status, locale,
                created_at, updated_at, last_updated_by, scheduled_publish_at
           FROM cms_contents WHERE id = ? LIMIT 1`,
      )
      .bind(id)
      .first<ContentRow>();
    if (!row) {
      return jsonResponse({ error: "Eintrag nicht gefunden" }, { status: 404 });
    }
    return jsonResponse(row);
  } catch (e) {
    const hint = tableHint(e);
    return jsonResponse(
      { error: (e as Error).message, ...(hint ? { hint } : {}) },
      { status: hint ? 503 : 500 },
    );
  }
};

type PutBody = {
  content_model_id?: string;
  payload_json?: unknown;
  status?: string;
  locale?: string;
  scheduled_publish_at?: unknown;
};

export const onRequestPut: PagesFunction<AuthEnv> = async ({
  request,
  env,
  params,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });

  const db = requireWebsiteDb(env);
  if (db instanceof Response) return db;

  const id = paramId(params).trim();
  if (!id) return jsonResponse({ error: "id fehlt" }, { status: 400 });

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return jsonResponse({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const cur = await db
    .prepare(
      `SELECT id, content_model_id, payload_json, status, locale, scheduled_publish_at
         FROM cms_contents WHERE id = ?`,
    )
    .bind(id)
    .first<ContentRow>();
  if (!cur) {
    return jsonResponse({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }

  let nextModel = cur.content_model_id;
  if (body.content_model_id !== undefined) {
    const mid = String(body.content_model_id).trim();
    if (!mid) {
      return jsonResponse({ error: "content_model_id leer" }, { status: 400 });
    }
    const exists = await db
      .prepare("SELECT id FROM cms_content_models WHERE id = ? LIMIT 1")
      .bind(mid)
      .first<{ id: string }>();
    if (!exists) {
      return jsonResponse({ error: "content_model_id unbekannt" }, { status: 400 });
    }
    nextModel = mid;
  }

  let nextPayload = cur.payload_json;
  if (body.payload_json !== undefined) {
    const p = normalizePayload(body.payload_json);
    if (p instanceof Response) return p;
    nextPayload = p;
  }

  let nextStatus = cur.status;
  if (body.status !== undefined) {
    nextStatus = String(body.status).trim().slice(0, 64) || cur.status;
  }

  let nextLocale = cur.locale;
  if (body.locale !== undefined) {
    nextLocale = String(body.locale).trim().slice(0, 32) || cur.locale;
  }

  let nextScheduled = cur.scheduled_publish_at;
  if (body.scheduled_publish_at !== undefined) {
    const s = normalizeScheduledPublishAt(body.scheduled_publish_at);
    if (s === undefined) {
      nextScheduled = cur.scheduled_publish_at;
    } else {
      nextScheduled = s;
    }
  }

  const updater = lastUpdater(user);

  try {
    await db
      .prepare(
        `UPDATE cms_contents SET
           content_model_id = ?,
           payload_json = ?,
           status = ?,
           locale = ?,
           scheduled_publish_at = ?,
           last_updated_by = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(
        nextModel,
        nextPayload,
        nextStatus,
        nextLocale,
        nextScheduled,
        updater,
        id,
      )
      .run();

    const row = await db
      .prepare(
        `SELECT id, content_model_id, payload_json, status, locale,
                created_at, updated_at, last_updated_by, scheduled_publish_at
           FROM cms_contents WHERE id = ?`,
      )
      .bind(id)
      .first<ContentRow>();
    return jsonResponse(row);
  } catch (e) {
    const hint = tableHint(e);
    return jsonResponse(
      { error: (e as Error).message, ...(hint ? { hint } : {}) },
      { status: hint ? 503 : 500 },
    );
  }
};

export const onRequestDelete: PagesFunction<AuthEnv> = async ({
  request,
  env,
  params,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  const denied = assertCmsDestroyAllowed(user);
  if (denied) return denied;

  const db = requireWebsiteDb(env);
  if (db instanceof Response) return db;

  const id = paramId(params).trim();
  if (!id) return jsonResponse({ error: "id fehlt" }, { status: 400 });

  try {
    const res = await db
      .prepare("DELETE FROM cms_contents WHERE id = ?")
      .bind(id)
      .run();
    if ((res.meta?.changes ?? 0) < 1) {
      return jsonResponse({ error: "Eintrag nicht gefunden" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (e) {
    const hint = tableHint(e);
    return jsonResponse(
      { error: (e as Error).message, ...(hint ? { hint } : {}) },
      { status: hint ? 503 : 500 },
    );
  }
};
