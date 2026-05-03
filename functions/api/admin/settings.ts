/**
 * GET /api/admin/settings
 * Listet alle Zeilen aus `settings` im D1-Binding `configs`.
 *
 * PUT /api/admin/settings
 * Body: `{ "id": "controll_buttons", "config": <JSON>, "description"?: string | null }`
 * — Upsert per `ON CONFLICT(id)`.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import { parseSettingsConfigColumn } from "../../_lib/controllButtonsConfig";

const SETTING_ID_RE = /^[a-zA-Z0-9_-]{1,100}$/;
const MAX_DESCRIPTION_LEN = 4000;
const MAX_CONFIG_JSON_BYTES = 512 * 1024;

function requireConfigsDb(
  env: AuthEnv,
): D1Database | Response {
  if (!env.configs) {
    return jsonResponse(
      {
        error:
          "D1-Binding `configs` fehlt. Im Cloudflare-Dashboard unter Pages → Functions → Bindings ein D1 mit Variable `configs` einbinden.",
      },
      { status: 503 },
    );
  }
  return env.configs;
}

function normalizeStoredConfig(raw: unknown): unknown {
  return parseSettingsConfigColumn(raw ?? null);
}

type SettingsRow = {
  id: string;
  config: unknown;
  description: string | null;
};

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const db = requireConfigsDb(env);
  if (db instanceof Response) return db;

  try {
    const { results } = await db
      .prepare("SELECT id, config, description FROM settings ORDER BY id ASC")
      .all<{ id: string; config: unknown; description: string | null }>();

    const rows: SettingsRow[] = (results ?? []).map((r) => ({
      id: typeof r.id === "string" ? r.id : String(r.id),
      config: normalizeStoredConfig(r.config),
      description:
        r.description == null || typeof r.description !== "string"
          ? null
          : r.description,
    }));

    return jsonResponse(
      { rows, configsBound: true },
      { status: 200 },
    );
  } catch (e) {
    console.error("[admin/settings GET]", e);
    return jsonResponse(
      { error: "Konnte settings nicht lesen" },
      { status: 500 },
    );
  }
};

type PutBody = {
  id?: string;
  config?: unknown;
  description?: string | null;
};

export const onRequestPut: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const db = requireConfigsDb(env);
  if (db instanceof Response) return db;

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || !SETTING_ID_RE.test(id)) {
    return jsonResponse(
      {
        error:
          "id muss 1–100 Zeichen sein und nur Buchstaben, Ziffern, _ und - enthalten",
      },
      { status: 400 },
    );
  }

  if (body.config === undefined) {
    return jsonResponse({ error: "config fehlt" }, { status: 400 });
  }

  let configJson: string;
  try {
    configJson = JSON.stringify(body.config);
  } catch {
    return jsonResponse(
      { error: "config ist nicht als JSON serialisierbar" },
      { status: 400 },
    );
  }

  if (configJson.length > MAX_CONFIG_JSON_BYTES) {
    return jsonResponse({ error: "config-JSON zu groß" }, { status: 400 });
  }

  let description: string | null;
  if ("description" in body) {
    if (body.description !== undefined && body.description !== null) {
      if (typeof body.description !== "string") {
        return jsonResponse(
          { error: "description muss ein String oder null sein" },
          { status: 400 },
        );
      }
      if (body.description.length > MAX_DESCRIPTION_LEN) {
        return jsonResponse({ error: "description zu lang" }, { status: 400 });
      }
      description = body.description;
    } else {
      description = null;
    }
  } else {
    try {
      const prev = await db
        .prepare("SELECT description FROM settings WHERE id = ?")
        .bind(id)
        .first<{ description: string | null }>();
      description =
        prev && typeof prev.description === "string" ? prev.description : null;
    } catch {
      description = null;
    }
  }

  try {
    await db
      .prepare(
        `INSERT INTO settings (id, config, description)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           config = excluded.config,
           description = excluded.description`,
      )
      .bind(id, configJson, description)
      .run();

    const row = await db
      .prepare("SELECT id, config, description FROM settings WHERE id = ?")
      .bind(id)
      .first<{ id: string; config: unknown; description: string | null }>();

    return jsonResponse(
      {
        ok: true,
        row: row
          ? {
              id: row.id,
              config: normalizeStoredConfig(row.config),
              description:
                row.description == null ||
                typeof row.description !== "string"
                  ? null
                  : row.description,
            }
          : { id, config: body.config, description },
      },
      { status: 200 },
    );
  } catch (e) {
    console.error("[admin/settings PUT]", e);
    return jsonResponse(
      { error: "Konnte Einstellung nicht speichern" },
      { status: 500 },
    );
  }
};
