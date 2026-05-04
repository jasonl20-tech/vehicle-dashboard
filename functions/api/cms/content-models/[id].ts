/**
 * CMS — ein Content-Modell.
 *
 *   GET    /api/cms/content-models/:id
 *   PUT    /api/cms/content-models/:id  { key?, description?, schema_json? }
 *          (nur ab Sicherheitsstufe 8)
 *   DELETE /api/cms/content-models/:id (ab Sicherheitsstufe 9)
import {
  assertCmsDestroyAllowed,
  assertCmsModelWriteAllowed,
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
} from "../../../_lib/auth";
import { requireWebsiteDb } from "../../../_lib/websiteDb";

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
  return null;
}

function normalizeJsonField(
  raw: unknown,
  field: string,
  maxLen: number,
): string | Response {
  let s: string;
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
  } else if (typeof raw === "object" && raw !== null) {
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
        `SELECT id, key, description, schema_json, created_at, updated_at
           FROM cms_content_models WHERE id = ? LIMIT 1`,
      )
      .bind(id)
      .first<ModelRow>();
    if (!row) {
      return jsonResponse({ error: "Modell nicht gefunden" }, { status: 404 });
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
  key?: string;
  description?: string | null;
  schema_json?: unknown;
};

export const onRequestPut: PagesFunction<AuthEnv> = async ({
  request,
  env,
  params,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  const deniedModel = assertCmsModelWriteAllowed(user);
  if (deniedModel) return deniedModel;

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
      `SELECT id, key, description, schema_json FROM cms_content_models WHERE id = ?`,
    )
    .bind(id)
    .first<ModelRow>();
  if (!cur) {
    return jsonResponse({ error: "Modell nicht gefunden" }, { status: 404 });
  }

  let nextKey = cur.key;
  if (body.key !== undefined) {
    const k = String(body.key).trim();
    if (!k || k.length > MAX_KEY_LEN || !KEY_RE.test(k)) {
      return jsonResponse({ error: "key ungültig" }, { status: 400 });
    }
    nextKey = k;
  }

  let nextDesc = cur.description;
  if (body.description !== undefined) {
    nextDesc =
      body.description === null ? null : String(body.description).slice(0, 2000);
  }

  let nextSchema = cur.schema_json;
  if (body.schema_json !== undefined) {
    const s = normalizeJsonField(body.schema_json, "schema_json", MAX_SCHEMA_LEN);
    if (s instanceof Response) return s;
    nextSchema = s;
  }

  try {
    await db
      .prepare(
        `UPDATE cms_content_models
           SET key = ?, description = ?, schema_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(nextKey, nextDesc, nextSchema, id)
      .run();

    const row = await db
      .prepare(
        `SELECT id, key, description, schema_json, created_at, updated_at
           FROM cms_content_models WHERE id = ?`,
      )
      .bind(id)
      .first<ModelRow>();
    return jsonResponse(row);
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (/UNIQUE|unique/i.test(msg)) {
      return jsonResponse({ error: "key bereits vergeben" }, { status: 409 });
    }
    const hint = tableHint(e);
    return jsonResponse(
      { error: msg, ...(hint ? { hint } : {}) },
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
      .prepare("DELETE FROM cms_content_models WHERE id = ?")
      .bind(id)
      .run();
    if ((res.meta?.changes ?? 0) < 1) {
      return jsonResponse({ error: "Modell nicht gefunden" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (/FOREIGN KEY|constraint/i.test(msg)) {
      return jsonResponse(
        { error: "Modell wird noch von Content-Einträgen genutzt" },
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
