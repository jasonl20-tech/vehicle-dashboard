/**
 * Email-Templates — Liste & Anlegen.
 *
 *   GET  /api/emails/templates?q=&limit=&offset=
 *     → { rows: { id, subject, updated_at, length }[], total, limit, offset }
 *   POST /api/emails/templates  { id, subject?, body_html?, copy_from_id? }
 *     → 201 mit voller Zeile
 *
 * Tabelle `email_templates` liegt in derselben D1 (`env.website`) wie
 * `customers` und `submissions`. Migration: d1/migrations/0007_email_templates.sql.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;
const MAX_ID_LEN = 200;
const MAX_SUBJECT_LEN = 998; // RFC 5322 line length
const MAX_BODY_LEN = 1_000_000; // 1 MB Schutz; D1 verkraftet mehr

const ID_RE = /^[a-zA-Z0-9_.\-:]+$/;

const DEFAULT_BODY_MJML = `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Helvetica, Arial, sans-serif" />
      <mj-text color="#3a3a3d" font-size="14px" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f6f6f6">
    <mj-section background-color="#ffffff" padding="32px" border-radius="8px">
      <mj-column>
        <mj-text font-size="22px" color="#0f0f10" font-weight="600">Hallo {{name}},</mj-text>
        <mj-text>
          Schreibe hier deinen Text. Du kannst Variablen wie
          <strong>{{name}}</strong> oder <strong>{{company}}</strong>
          verwenden.
        </mj-text>
        <mj-button background-color="#0f0f10" color="#ffffff" border-radius="6px" href="https://vehicleimagery.com">
          Aktion ausführen
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

/**
 * Fallback-HTML, wenn beim Anlegen kein body_html (und kein body_mjml zum
 * Rendern) übergeben wurde. Wird vom Frontend in der Regel überschrieben,
 * sobald der MJML-Editor das erste Mal speichert.
 */
const DEFAULT_BODY_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:32px;font-family:Helvetica,Arial,sans-serif;color:#3a3a3d;">Bitte im Editor MJML einf&uuml;gen oder HTML-Modus nutzen.</td></tr></table>`;

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

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireDb(env);
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
  const binds: (string | number)[] = [];
  if (q) {
    const pat = `%${q.replace(/[%_]/g, "")}%`;
    where.push("(id LIKE ? OR subject LIKE ?)");
    binds.push(pat, pat);
  }
  const whereSql = ` WHERE ${where.join(" AND ")}`;

  try {
    const total =
      (
        await db
          .prepare(`SELECT COUNT(*) AS n FROM email_templates${whereSql}`)
          .bind(...binds)
          .first<{ n: number }>()
      )?.n ?? 0;

    const { results } = await db
      .prepare(
        `SELECT id, subject, updated_at, length(body_html) AS length
           FROM email_templates${whereSql}
           ORDER BY datetime(updated_at) DESC
           LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, offset)
      .all<{
        id: string;
        subject: string;
        updated_at: string;
        length: number;
      }>();

    return jsonResponse({
      rows: results ?? [],
      total,
      limit,
      offset,
    });
  } catch (e) {
    const hint = tableMissingHint(e);
    return jsonResponse(
      {
        error: (e as Error).message || String(e),
        ...(hint ? { hint } : null),
      },
      { status: hint ? 503 : 500 },
    );
  }
};

type PostBody = {
  id?: string;
  subject?: string;
  body_html?: string;
  body_mjml?: string;
  /** Optional: ID einer existierenden Vorlage zum Duplizieren. */
  copy_from_id?: string;
};

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireDb(env);
  if (db instanceof Response) return db;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return jsonResponse({ error: "id ist Pflicht" }, { status: 400 });
  }
  if (id.length > MAX_ID_LEN) {
    return jsonResponse({ error: "id zu lang" }, { status: 400 });
  }
  if (!ID_RE.test(id)) {
    return jsonResponse(
      {
        error:
          "id darf nur Buchstaben, Ziffern und . _ - : enthalten (z. B. `trial_followup_1`)",
      },
      { status: 400 },
    );
  }

  let subject = typeof body.subject === "string" ? body.subject.trim() : "";
  let bodyHtml = typeof body.body_html === "string" ? body.body_html : "";
  let bodyMjml: string | null =
    typeof body.body_mjml === "string" ? body.body_mjml : "";

  const copyFrom =
    typeof body.copy_from_id === "string" ? body.copy_from_id.trim() : "";

  try {
    if (copyFrom) {
      const src = await db
        .prepare(
          "SELECT subject, body_html, body_mjml FROM email_templates WHERE id = ? LIMIT 1",
        )
        .bind(copyFrom)
        .first<{
          subject: string;
          body_html: string;
          body_mjml: string | null;
        }>();
      if (!src) {
        return jsonResponse(
          { error: `Quelle \`${copyFrom}\` nicht gefunden` },
          { status: 404 },
        );
      }
      if (!subject) subject = src.subject;
      if (!bodyHtml) bodyHtml = src.body_html;
      if (!bodyMjml && src.body_mjml) bodyMjml = src.body_mjml;
    }

    if (!subject) subject = id;
    if (!bodyMjml) bodyMjml = DEFAULT_BODY_MJML;
    if (!bodyHtml) bodyHtml = DEFAULT_BODY_HTML;

    if (subject.length > MAX_SUBJECT_LEN) {
      return jsonResponse({ error: "subject zu lang" }, { status: 400 });
    }
    if (bodyHtml.length > MAX_BODY_LEN) {
      return jsonResponse({ error: "body_html zu groß" }, { status: 400 });
    }
    if (bodyMjml && bodyMjml.length > MAX_BODY_LEN) {
      return jsonResponse({ error: "body_mjml zu groß" }, { status: 400 });
    }

    await db
      .prepare(
        "INSERT INTO email_templates (id, subject, body_html, body_mjml, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
      )
      .bind(id, subject, bodyHtml, bodyMjml || null)
      .run();

    const row = await db
      .prepare(
        "SELECT id, subject, body_html, body_mjml, updated_at FROM email_templates WHERE id = ? LIMIT 1",
      )
      .bind(id)
      .first<Row>();

    return jsonResponse(row, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return jsonResponse(
        { error: `id \`${id}\` existiert bereits` },
        { status: 409 },
      );
    }
    const hint = tableMissingHint(e);
    return jsonResponse(
      { error: msg, ...(hint ? { hint } : null) },
      { status: hint ? 503 : 500 },
    );
  }
};
