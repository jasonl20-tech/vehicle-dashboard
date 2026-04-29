/**
 * Email-Templates — Einzelne Vorlage.
 *
 *   GET    /api/emails/templates/:id  → volle Zeile
 *   PUT    /api/emails/templates/:id  { subject?, body_html?, new_id? } → 200
 *   DELETE /api/emails/templates/:id  → 204
 *
 * Tabelle `email_templates` (siehe d1/migrations/0007_email_templates.sql) liegt
 * im D1-Binding `website` (zusammen mit `customers`/`submissions`).
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../../_lib/auth";

const MAX_ID_LEN = 200;
const MAX_SUBJECT_LEN = 998;
const MAX_BODY_LEN = 1_000_000;
const ID_RE = /^[a-zA-Z0-9_.\-:]+$/;

type Row = {
  id: string;
  subject: string;
  body_html: string;
  body_mjml: string | null;
  updated_at: string;
};

function requireDb(env: AuthEnv): D1Database | Response {
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

function tableMissingHint(e: unknown): string | null {
  const msg = (e as Error)?.message || String(e);
  if (/no such column.*body_mjml/i.test(msg)) {
    return "Spalte `body_mjml` fehlt. Migration ausführen: `wrangler d1 execute <DB-NAME> --file=./d1/migrations/0008_email_templates_mjml.sql`.";
  }
  if (/no such table/i.test(msg) || /email_templates/.test(msg)) {
    return "Tabelle `email_templates` fehlt. Migrationen ausführen: `wrangler d1 execute <DB-NAME> --file=./d1/migrations/0007_email_templates.sql && --file=./d1/migrations/0008_email_templates_mjml.sql`.";
  }
  return null;
}

function paramId(params: Record<string, string | string[] | undefined>): string {
  const v = params.id;
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length > 0) return v[0] ?? "";
  return "";
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
  params,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireDb(env);
  if (db instanceof Response) return db;

  const id = paramId(params).trim();
  if (!id) {
    return jsonResponse({ error: "id fehlt" }, { status: 400 });
  }

  try {
    const row = await db
      .prepare(
        "SELECT id, subject, body_html, body_mjml, updated_at FROM email_templates WHERE id = ? LIMIT 1",
      )
      .bind(id)
      .first<Row>();
    if (!row) {
      return jsonResponse({ error: "Vorlage nicht gefunden" }, { status: 404 });
    }
    return jsonResponse(row);
  } catch (e) {
    const hint = tableMissingHint(e);
    return jsonResponse(
      { error: (e as Error).message, ...(hint ? { hint } : null) },
      { status: hint ? 503 : 500 },
    );
  }
};

type PutBody = {
  subject?: string;
  body_html?: string;
  body_mjml?: string | null;
  /** Optional: id rename. Wenn gesetzt und != alte id, wird umbenannt. */
  new_id?: string;
};

export const onRequestPut: PagesFunction<AuthEnv> = async ({
  request,
  env,
  params,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireDb(env);
  if (db instanceof Response) return db;

  const id = paramId(params).trim();
  if (!id) {
    return jsonResponse({ error: "id fehlt" }, { status: 400 });
  }

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  try {
    const cur = await db
      .prepare(
        "SELECT id, subject, body_html, body_mjml, updated_at FROM email_templates WHERE id = ? LIMIT 1",
      )
      .bind(id)
      .first<Row>();
    if (!cur) {
      return jsonResponse({ error: "Vorlage nicht gefunden" }, { status: 404 });
    }

    const subject =
      body.subject === undefined
        ? cur.subject
        : typeof body.subject === "string"
          ? body.subject.trim()
          : cur.subject;
    const bodyHtml =
      body.body_html === undefined
        ? cur.body_html
        : typeof body.body_html === "string"
          ? body.body_html
          : cur.body_html;
    // body_mjml: explizit `null` löscht den Source, `undefined` lässt unverändert,
    // String setzt ihn neu.
    const bodyMjml: string | null =
      body.body_mjml === undefined
        ? cur.body_mjml
        : body.body_mjml === null
          ? null
          : typeof body.body_mjml === "string"
            ? body.body_mjml
            : cur.body_mjml;

    if (!subject) {
      return jsonResponse(
        { error: "subject darf nicht leer sein" },
        { status: 400 },
      );
    }
    if (subject.length > MAX_SUBJECT_LEN) {
      return jsonResponse({ error: "subject zu lang" }, { status: 400 });
    }
    if (bodyHtml.length > MAX_BODY_LEN) {
      return jsonResponse({ error: "body_html zu groß" }, { status: 400 });
    }
    if (bodyMjml && bodyMjml.length > MAX_BODY_LEN) {
      return jsonResponse({ error: "body_mjml zu groß" }, { status: 400 });
    }

    let newId = id;
    if (typeof body.new_id === "string") {
      const candidate = body.new_id.trim();
      if (candidate && candidate !== id) {
        if (candidate.length > MAX_ID_LEN || !ID_RE.test(candidate)) {
          return jsonResponse(
            {
              error:
                "new_id ungültig. Erlaubt: a–z, A–Z, 0–9 und . _ - : (max. 200 Zeichen)",
            },
            { status: 400 },
          );
        }
        const exists = await db
          .prepare("SELECT 1 AS x FROM email_templates WHERE id = ? LIMIT 1")
          .bind(candidate)
          .first<{ x: number }>();
        if (exists) {
          return jsonResponse(
            { error: `id \`${candidate}\` existiert bereits` },
            { status: 409 },
          );
        }
        newId = candidate;
      }
    }

    if (newId === id) {
      await db
        .prepare(
          "UPDATE email_templates SET subject = ?, body_html = ?, body_mjml = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(subject, bodyHtml, bodyMjml, id)
        .run();
    } else {
      await db
        .prepare(
          "UPDATE email_templates SET id = ?, subject = ?, body_html = ?, body_mjml = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(newId, subject, bodyHtml, bodyMjml, id)
        .run();
    }

    const row = await db
      .prepare(
        "SELECT id, subject, body_html, body_mjml, updated_at FROM email_templates WHERE id = ? LIMIT 1",
      )
      .bind(newId)
      .first<Row>();

    return jsonResponse(row);
  } catch (e) {
    const msg = (e as Error).message || String(e);
    const hint = tableMissingHint(e);
    return jsonResponse(
      { error: msg, ...(hint ? { hint } : null) },
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
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireDb(env);
  if (db instanceof Response) return db;

  const id = paramId(params).trim();
  if (!id) {
    return jsonResponse({ error: "id fehlt" }, { status: 400 });
  }

  try {
    const r = await db
      .prepare("DELETE FROM email_templates WHERE id = ?")
      .bind(id)
      .run();
    const changes =
      typeof r.meta?.changes === "number" ? r.meta.changes : 0;
    if (changes < 1) {
      return jsonResponse({ error: "Vorlage nicht gefunden" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (e) {
    const hint = tableMissingHint(e);
    return jsonResponse(
      { error: (e as Error).message, ...(hint ? { hint } : null) },
      { status: hint ? 503 : 500 },
    );
  }
};
