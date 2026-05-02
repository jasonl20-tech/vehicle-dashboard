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
 *
 * Schema (unverändert, ohne MJML-Spalte): id, subject, body_html, updated_at.
 * Der Bearbeitungs-State des visuellen Editors (Unlayer-Design-JSON) wird
 * vom Frontend als HTML-Kommentar **innerhalb** von body_html mitgepflegt.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;
const MAX_ID_LEN = 200;
const MAX_SUBJECT_LEN = 998; // RFC 5322 line length
const MAX_BODY_LEN = 2_000_000; // 2 MB Schutz; D1 verkraftet mehr

const ID_RE = /^[a-zA-Z0-9_.\-:]+$/;

const DEFAULT_BODY_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f6f6f6;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:8px;">
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px 0;font-size:22px;color:#0f0f10;">Hallo {{name}},</h1>
          <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#3a3a3d;">
            Schreibe hier deinen Text. Du kannst Variablen wie
            <code>{{name}}</code> oder <code>{{company}}</code> verwenden.
          </p>
          <p style="margin:24px 0 0 0;">
            <a href="https://vehicleimagery.com" style="display:inline-block;background:#0f0f10;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;">Aktion ausf&uuml;hren</a>
          </p>
        </td></tr>
      </table>
    </td>
  </tr>
</table>`;

type Row = {
  id: string;
  subject: string;
  body_html: string;
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
  if (/no such table/i.test(msg) || /email_templates/.test(msg)) {
    return "Tabelle `email_templates` fehlt. Migration ausführen: `wrangler d1 execute <DB-NAME> --file=./d1/migrations/0007_email_templates.sql`.";
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

  const copyFrom =
    typeof body.copy_from_id === "string" ? body.copy_from_id.trim() : "";

  try {
    if (copyFrom) {
      const src = await db
        .prepare(
          "SELECT subject, body_html FROM email_templates WHERE id = ? LIMIT 1",
        )
        .bind(copyFrom)
        .first<{ subject: string; body_html: string }>();
      if (!src) {
        return jsonResponse(
          { error: `Quelle \`${copyFrom}\` nicht gefunden` },
          { status: 404 },
        );
      }
      if (!subject) subject = src.subject;
      if (!bodyHtml) bodyHtml = src.body_html;
    }

    if (!subject) subject = id;
    if (!bodyHtml) bodyHtml = DEFAULT_BODY_HTML;

    if (subject.length > MAX_SUBJECT_LEN) {
      return jsonResponse({ error: "subject zu lang" }, { status: 400 });
    }
    if (bodyHtml.length > MAX_BODY_LEN) {
      return jsonResponse({ error: "body_html zu groß" }, { status: 400 });
    }

    await db
      .prepare(
        "INSERT INTO email_templates (id, subject, body_html, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
      )
      .bind(id, subject, bodyHtml)
      .run();

    const row = await db
      .prepare(
        "SELECT id, subject, body_html, updated_at FROM email_templates WHERE id = ? LIMIT 1",
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
