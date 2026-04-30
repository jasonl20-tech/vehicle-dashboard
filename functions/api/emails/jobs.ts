/**
 * Email-Jobs (Versand-Queue / -Log).
 *
 *   GET  /api/emails/jobs?q=&status=&template_id=&from=&to=&limit=&offset=
 *     → { rows: EmailJobRow[], total, limit, offset, statusCounts, hint? }
 *     Listenzeilen enthalten Tracking-Aggregate (opens / clicks / first_open_at).
 *
 *   POST /api/emails/jobs                                   (Email manuell)
 *     Body: { recipient_email, recipient_data?, template_id?, custom_subject?,
 *             custom_body_html?, scheduled_at?, from_email? }
 *     → 201 mit voller Zeile
 *     Schreibt einen `pending`-Job in die Tabelle. Den Versand übernimmt
 *     der externe Mail-Worker (cron / queue).
 *
 * Schema (siehe d1/migrations/0008_email_jobs.sql + 0009_email_tracking.sql):
 *   id, recipient_email, tracking_id, recipient_data, template_id,
 *   custom_subject, custom_body_html, status, error_message, retries,
 *   scheduled_at, sent_at, created_at, from_email
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;
const MAX_BODY_LEN = 2_000_000;
const MAX_SUBJECT_LEN = 998;
const MAX_RECIPIENT_DATA_LEN = 200_000;

const ALLOWED_STATUS = new Set([
  "pending",
  "processing",
  "sent",
  "failed",
]);

type Row = {
  id: string;
  recipient_email: string;
  tracking_id: string;
  recipient_data: string;
  template_id: string | null;
  custom_subject: string | null;
  custom_body_html_length: number;
  status: string;
  error_message: string | null;
  retries: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  from_email: string;
  open_count: number;
  click_count: number;
  unique_open_count: number;
  unique_click_count: number;
  first_open_at: string | null;
  last_event_at: string | null;
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
  if (/no such table/i.test(msg) && /email_jobs|email_tracking/.test(msg)) {
    return "Tabelle `email_jobs` oder `email_tracking` fehlt. Migrationen ausführen: `wrangler d1 execute <DB-NAME> --file=./d1/migrations/0008_email_jobs.sql` und `… --file=./d1/migrations/0009_email_tracking.sql`.";
  }
  return null;
}

/** Akzeptiert ISO-Strings (mit oder ohne `T`) bzw. `YYYY-MM-DD`. */
function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.replace("T", " ").replace("Z", "");
  return null;
}

const EMAIL_RE =
  /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// ─── GET /api/emails/jobs ─────────────────────────────────────────────

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
  const statusParam = (url.searchParams.get("status") || "").trim();
  const templateId = (url.searchParams.get("template_id") || "").trim();
  const fromDate = normalizeDate(url.searchParams.get("from"));
  const toDate = normalizeDate(url.searchParams.get("to"));
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
    where.push(
      "(j.id LIKE ? OR j.custom_subject LIKE ? OR j.recipient_email LIKE ? OR j.recipient_data LIKE ? OR j.error_message LIKE ? OR j.from_email LIKE ?)",
    );
    binds.push(pat, pat, pat, pat, pat, pat);
  }
  if (statusParam) {
    if (!ALLOWED_STATUS.has(statusParam)) {
      return jsonResponse(
        {
          error: `status muss einer von ${[...ALLOWED_STATUS].join(", ")} sein`,
        },
        { status: 400 },
      );
    }
    where.push("j.status = ?");
    binds.push(statusParam);
  }
  if (templateId) {
    where.push("j.template_id = ?");
    binds.push(templateId);
  }
  if (fromDate) {
    where.push("datetime(j.created_at) >= datetime(?)");
    binds.push(fromDate);
  }
  if (toDate) {
    where.push("datetime(j.created_at) <= datetime(?)");
    binds.push(toDate);
  }

  const whereSql = ` WHERE ${where.join(" AND ")}`;

  try {
    const total =
      (
        await db
          .prepare(`SELECT COUNT(*) AS n FROM email_jobs j${whereSql}`)
          .bind(...binds)
          .first<{ n: number }>()
      )?.n ?? 0;

    const counts = await db
      .prepare(
        `SELECT j.status AS status, COUNT(*) AS n FROM email_jobs j${whereSql} GROUP BY j.status`,
      )
      .bind(...binds)
      .all<{ status: string; n: number }>();

    const statusCounts: Record<string, number> = {};
    for (const r of counts.results ?? []) {
      if (r?.status) statusCounts[r.status] = Number(r.n) || 0;
    }

    // Tracking-Aggregate per LEFT JOIN. `email_tracking` darf optional
    // fehlen (frühe Setups) — in dem Fall wird die Query mit Fallback
    // erneut ohne Tracking ausgeführt.
    let results: Row[] = [];
    try {
      const r = await db
        .prepare(
          `SELECT j.id,
                  COALESCE(j.recipient_email, '') AS recipient_email,
                  COALESCE(j.tracking_id, '') AS tracking_id,
                  j.recipient_data,
                  j.template_id,
                  j.custom_subject,
                  COALESCE(length(j.custom_body_html), 0) AS custom_body_html_length,
                  j.status,
                  j.error_message,
                  COALESCE(j.retries, 0) AS retries,
                  j.scheduled_at,
                  j.sent_at,
                  j.created_at,
                  j.from_email,
                  COALESCE(t.opens, 0)         AS open_count,
                  COALESCE(t.clicks, 0)        AS click_count,
                  COALESCE(t.unique_opens, 0)  AS unique_open_count,
                  COALESCE(t.unique_clicks, 0) AS unique_click_count,
                  t.first_open_at              AS first_open_at,
                  t.last_event_at              AS last_event_at
             FROM email_jobs j
             LEFT JOIN (
                 SELECT job_id,
                        SUM(CASE WHEN event_type = 'open'  THEN 1 ELSE 0 END) AS opens,
                        SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) AS clicks,
                        COUNT(DISTINCT CASE WHEN event_type = 'open'  THEN COALESCE(ip_address, id) END) AS unique_opens,
                        COUNT(DISTINCT CASE WHEN event_type = 'click' THEN COALESCE(ip_address, id) END) AS unique_clicks,
                        MIN(CASE WHEN event_type = 'open' THEN created_at END) AS first_open_at,
                        MAX(created_at) AS last_event_at
                   FROM email_tracking
                   GROUP BY job_id
             ) t ON t.job_id = j.id
            ${whereSql}
            ORDER BY datetime(COALESCE(j.sent_at, j.scheduled_at, j.created_at)) DESC,
                     j.id DESC
            LIMIT ? OFFSET ?`,
        )
        .bind(...binds, limit, offset)
        .all<Row>();
      results = r.results ?? [];
    } catch (joinErr) {
      const msg = (joinErr as Error)?.message || String(joinErr);
      if (/email_tracking/i.test(msg) && /no such table/i.test(msg)) {
        const r = await db
          .prepare(
            `SELECT j.id,
                    COALESCE(j.recipient_email, '') AS recipient_email,
                    COALESCE(j.tracking_id, '') AS tracking_id,
                    j.recipient_data,
                    j.template_id,
                    j.custom_subject,
                    COALESCE(length(j.custom_body_html), 0) AS custom_body_html_length,
                    j.status,
                    j.error_message,
                    COALESCE(j.retries, 0) AS retries,
                    j.scheduled_at,
                    j.sent_at,
                    j.created_at,
                    j.from_email,
                    0 AS open_count,
                    0 AS click_count,
                    0 AS unique_open_count,
                    0 AS unique_click_count,
                    NULL AS first_open_at,
                    NULL AS last_event_at
               FROM email_jobs j
              ${whereSql}
              ORDER BY datetime(COALESCE(j.sent_at, j.scheduled_at, j.created_at)) DESC,
                       j.id DESC
              LIMIT ? OFFSET ?`,
          )
          .bind(...binds, limit, offset)
          .all<Row>();
        results = r.results ?? [];
      } else {
        throw joinErr;
      }
    }

    return jsonResponse({
      rows: results,
      total,
      limit,
      offset,
      statusCounts,
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

// ─── POST /api/emails/jobs (Email manuell) ────────────────────────────

type PostBody = {
  recipient_email?: string;
  recipient_data?: unknown;
  template_id?: string | null;
  custom_subject?: string;
  custom_body_html?: string;
  scheduled_at?: string;
  from_email?: string;
};

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback (sollte auf Workers nicht nötig sein):
  const r = () => Math.random().toString(16).slice(2, 10);
  return `${r()}-${r().slice(0, 4)}-${r().slice(0, 4)}-${r().slice(0, 4)}-${r()}${r().slice(0, 4)}`;
}

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

  const recipientEmail = (body.recipient_email || "").trim();
  if (!recipientEmail) {
    return jsonResponse(
      { error: "recipient_email ist Pflicht" },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(recipientEmail)) {
    return jsonResponse(
      { error: `recipient_email \`${recipientEmail}\` sieht ungültig aus` },
      { status: 400 },
    );
  }

  // Entweder Template ODER custom_body_html — sonst nichts zum Versenden.
  const templateId =
    typeof body.template_id === "string" && body.template_id.trim()
      ? body.template_id.trim()
      : null;
  const customSubject =
    typeof body.custom_subject === "string" && body.custom_subject.trim()
      ? body.custom_subject.trim()
      : null;
  const customBodyHtml =
    typeof body.custom_body_html === "string" && body.custom_body_html.trim()
      ? body.custom_body_html
      : null;

  if (!templateId && !customBodyHtml) {
    return jsonResponse(
      {
        error:
          "Entweder `template_id` ODER `custom_body_html` muss gesetzt sein.",
      },
      { status: 400 },
    );
  }
  if (customSubject && customSubject.length > MAX_SUBJECT_LEN) {
    return jsonResponse(
      { error: `custom_subject zu lang (max. ${MAX_SUBJECT_LEN} Zeichen)` },
      { status: 400 },
    );
  }
  if (customBodyHtml && customBodyHtml.length > MAX_BODY_LEN) {
    return jsonResponse(
      { error: `custom_body_html zu groß (max. ${MAX_BODY_LEN} Zeichen)` },
      { status: 400 },
    );
  }

  // recipient_data: erlaubt Objekt oder String — wir speichern als JSON-String.
  let recipientDataStr = "";
  if (body.recipient_data == null) {
    recipientDataStr = JSON.stringify({ email: recipientEmail });
  } else if (typeof body.recipient_data === "string") {
    const t = body.recipient_data.trim();
    if (!t) {
      recipientDataStr = JSON.stringify({ email: recipientEmail });
    } else {
      // Wenn JSON parsebar → durchreichen, sonst als-rein-Text speichern.
      try {
        const parsed = JSON.parse(t);
        recipientDataStr = JSON.stringify(parsed);
      } catch {
        recipientDataStr = t;
      }
    }
  } else if (
    typeof body.recipient_data === "object" &&
    !Array.isArray(body.recipient_data)
  ) {
    const obj = body.recipient_data as Record<string, unknown>;
    if (typeof obj.email !== "string" || !obj.email.trim()) {
      obj.email = recipientEmail;
    }
    recipientDataStr = JSON.stringify(obj);
  } else {
    recipientDataStr = JSON.stringify(body.recipient_data);
  }
  if (recipientDataStr.length > MAX_RECIPIENT_DATA_LEN) {
    return jsonResponse(
      { error: "recipient_data zu groß" },
      { status: 400 },
    );
  }

  // Template-Existenz prüfen (Fremdschlüssel ist optional, hilft aber).
  if (templateId) {
    try {
      const t = await db
        .prepare("SELECT id FROM email_templates WHERE id = ? LIMIT 1")
        .bind(templateId)
        .first<{ id: string }>();
      if (!t) {
        return jsonResponse(
          { error: `Template \`${templateId}\` existiert nicht` },
          { status: 404 },
        );
      }
    } catch {
      // wenn email_templates fehlt, Fehler unten freundlicher fangen
    }
  }

  const fromEmail =
    typeof body.from_email === "string" && body.from_email.trim()
      ? body.from_email.trim()
      : "no-reply@vehicleimagery.com";

  const scheduledAt = normalizeDate(body.scheduled_at ?? null);

  const id = uuid();
  // tracking_id bewusst leer (''), Versand + tracking_id-Vergabe macht
  // der externe Mail-Worker. Wir schreiben hier nur den `pending`-Job.
  // Empty-String statt NULL, damit der INSERT auch ohne DEFAULT-Klausel
  // an der Spalte (NOT NULL) durchgeht.
  const trackingId = "";

  try {
    if (scheduledAt) {
      await db
        .prepare(
          `INSERT INTO email_jobs
             (id, recipient_email, tracking_id, recipient_data,
              template_id, custom_subject, custom_body_html,
              status, retries, scheduled_at, created_at, from_email)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, CURRENT_TIMESTAMP, ?)`,
        )
        .bind(
          id,
          recipientEmail,
          trackingId,
          recipientDataStr,
          templateId,
          customSubject,
          customBodyHtml,
          scheduledAt,
          fromEmail,
        )
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO email_jobs
             (id, recipient_email, tracking_id, recipient_data,
              template_id, custom_subject, custom_body_html,
              status, retries, scheduled_at, created_at, from_email)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
        )
        .bind(
          id,
          recipientEmail,
          trackingId,
          recipientDataStr,
          templateId,
          customSubject,
          customBodyHtml,
          fromEmail,
        )
        .run();
    }

    const row = await db
      .prepare(
        `SELECT id,
                COALESCE(recipient_email, '') AS recipient_email,
                COALESCE(tracking_id, '') AS tracking_id,
                recipient_data,
                template_id,
                custom_subject,
                custom_body_html,
                status,
                error_message,
                COALESCE(retries, 0) AS retries,
                scheduled_at,
                sent_at,
                created_at,
                from_email
           FROM email_jobs
          WHERE id = ?
          LIMIT 1`,
      )
      .bind(id)
      .first();

    return jsonResponse(row, { status: 201 });
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    const hint = tableMissingHint(e);
    if (/no column/i.test(msg) && /(recipient_email|tracking_id)/i.test(msg)) {
      return jsonResponse(
        {
          error: msg,
          hint: "Spalten `recipient_email` / `tracking_id` fehlen. Migration 0009 ausführen: `wrangler d1 execute <DB-NAME> --file=./d1/migrations/0009_email_tracking.sql`.",
        },
        { status: 503 },
      );
    }
    return jsonResponse(
      { error: msg, ...(hint ? { hint } : null) },
      { status: hint ? 503 : 500 },
    );
  }
};

// ─── Schreibende Verben außer POST: 405 ───────────────────────────────

const NOT_ALLOWED: Response = jsonResponse(
  {
    error:
      "Diese Methode ist auf /api/emails/jobs nicht erlaubt. Bearbeitung & Status-Änderungen erfolgen ausschließlich über den externen Mail-Worker.",
  },
  { status: 405, headers: { Allow: "GET, POST" } },
);

export const onRequestPut: PagesFunction<AuthEnv> = async () =>
  NOT_ALLOWED.clone();
export const onRequestPatch: PagesFunction<AuthEnv> = async () =>
  NOT_ALLOWED.clone();
export const onRequestDelete: PagesFunction<AuthEnv> = async () =>
  NOT_ALLOWED.clone();
