/**
 * Email-Timeline — vermischter Live-Feed aller Events.
 *
 *   GET /api/emails/timeline
 *     ?q=…&kind=created|sent|failed|open|click&status=…
 *     &from=ISO&to=ISO&limit=&offset=
 *
 * Setzt zusammen:
 *   - Job-Lebenszyklus aus `email_jobs`:
 *       * `created`           — Job angelegt (created_at)
 *       * `sent`              — Job vom Mail-Worker versendet (sent_at)
 *       * `failed`            — Job mit Status='failed' (created_at als
 *                                Best-Guess, kein dedizierter `failed_at`)
 *   - Tracking aus `email_tracking`:
 *       * `open` / `click`    — pro Event ein Eintrag
 *
 * Ergebnis ist nach Datum absteigend sortiert (neueste zuerst).
 *
 * Defensiv: Falls `email_tracking` (Migration 0009) noch nicht existiert,
 * fallen wir auf nur Job-Lifecycle zurück.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

const ALLOWED_KINDS = new Set([
  "created",
  "sent",
  "failed",
  "open",
  "click",
]);

const ALLOWED_STATUS = new Set([
  "pending",
  "processing",
  "sent",
  "failed",
]);

type EventRow = {
  id: string;
  kind: "created" | "sent" | "failed" | "open" | "click";
  at: string | null;
  job_id: string;
  recipient_email: string | null;
  custom_subject: string | null;
  template_id: string | null;
  status: string;
  link_url: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | null;
  error_message: string | null;
  retries: number | null;
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

function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date(t.replace(" ", "T"));
    if (Number.isNaN(fallback.getTime())) return null;
    return fallback.toISOString().replace("T", " ").slice(0, 19);
  }
  return d.toISOString().replace("T", " ").slice(0, 19);
}

async function trackingTableExists(db: D1Database): Promise<boolean> {
  try {
    const r = await db
      .prepare(
        `SELECT 1 AS one FROM sqlite_master WHERE type='table' AND name='email_tracking' LIMIT 1`,
      )
      .first<{ one: number }>();
    return !!r;
  } catch {
    return false;
  }
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

  const u = new URL(request.url);
  const limit = Math.min(
    Math.max(1, Number(u.searchParams.get("limit") ?? DEFAULT_LIMIT) | 0),
    MAX_LIMIT,
  );
  const offset = Math.max(0, Number(u.searchParams.get("offset") ?? 0) | 0);
  const q = (u.searchParams.get("q") ?? "").trim();
  const kindRaw = (u.searchParams.get("kind") ?? "").trim();
  const kind = ALLOWED_KINDS.has(kindRaw) ? kindRaw : "";
  const statusRaw = (u.searchParams.get("status") ?? "").trim();
  const status = ALLOWED_STATUS.has(statusRaw) ? statusRaw : "";
  const from = normalizeDate(u.searchParams.get("from"));
  const to = normalizeDate(u.searchParams.get("to"));

  const hasTracking = await trackingTableExists(db);

  // Wir bauen Sub-Queries für jeden Event-Typ. Jede SELECT-Liste hat
  // exakt dieselben Spalten in derselben Reihenfolge — Voraussetzung
  // für UNION ALL.
  //
  // Schema-Reihenfolge:
  //   id, kind, at, job_id, recipient_email, custom_subject,
  //   template_id, status, link_url, ip_address, user_agent,
  //   metadata, error_message, retries

  const subQueries: string[] = [];
  const subBinds: unknown[] = [];

  function pushSub(sql: string, binds: unknown[]) {
    subQueries.push(`(${sql})`);
    subBinds.push(...binds);
  }

  // Filter-Bausteine, die in jeder Sub-Query gleich angewendet werden.
  // Sie referenzieren entweder `j.…` (Jobs) oder `t.…`+`j.…` (Tracking).
  const baseJobFilter: string[] = [];
  const baseJobBinds: unknown[] = [];
  if (status) {
    baseJobFilter.push("j.status = ?");
    baseJobBinds.push(status);
  }
  if (q) {
    baseJobFilter.push(
      "(j.id LIKE ? OR j.recipient_email LIKE ? OR COALESCE(j.custom_subject,'') LIKE ? OR COALESCE(j.template_id,'') LIKE ? OR COALESCE(j.error_message,'') LIKE ?)",
    );
    const like = `%${q}%`;
    baseJobBinds.push(like, like, like, like, like);
  }
  function jobFilterSql(extra: string): string {
    const parts = [extra, ...baseJobFilter].filter(Boolean);
    return parts.length ? ` WHERE ${parts.join(" AND ")}` : "";
  }

  // ── created ─────────────────────────────────────────────────────────
  if (!kind || kind === "created") {
    const dateFilter: string[] = [];
    const dateBinds: unknown[] = [];
    if (from) {
      dateFilter.push("datetime(j.created_at) >= datetime(?)");
      dateBinds.push(from);
    }
    if (to) {
      dateFilter.push("datetime(j.created_at) <= datetime(?)");
      dateBinds.push(to);
    }
    const whereSql = jobFilterSql(
      ["j.created_at IS NOT NULL", ...dateFilter].join(" AND "),
    );
    pushSub(
      `SELECT
         'job:' || j.id || ':created' AS id,
         'created' AS kind,
         j.created_at AS at,
         j.id AS job_id,
         j.recipient_email,
         j.custom_subject,
         j.template_id,
         j.status,
         NULL AS link_url,
         NULL AS ip_address,
         NULL AS user_agent,
         NULL AS metadata,
         j.error_message,
         j.retries
       FROM email_jobs j
       ${whereSql}`,
      [...dateBinds, ...baseJobBinds],
    );
  }

  // ── sent ────────────────────────────────────────────────────────────
  if (!kind || kind === "sent") {
    const dateFilter: string[] = [];
    const dateBinds: unknown[] = [];
    if (from) {
      dateFilter.push("datetime(j.sent_at) >= datetime(?)");
      dateBinds.push(from);
    }
    if (to) {
      dateFilter.push("datetime(j.sent_at) <= datetime(?)");
      dateBinds.push(to);
    }
    const whereSql = jobFilterSql(
      ["j.sent_at IS NOT NULL", ...dateFilter].join(" AND "),
    );
    pushSub(
      `SELECT
         'job:' || j.id || ':sent' AS id,
         'sent' AS kind,
         j.sent_at AS at,
         j.id AS job_id,
         j.recipient_email,
         j.custom_subject,
         j.template_id,
         j.status,
         NULL AS link_url,
         NULL AS ip_address,
         NULL AS user_agent,
         NULL AS metadata,
         j.error_message,
         j.retries
       FROM email_jobs j
       ${whereSql}`,
      [...dateBinds, ...baseJobBinds],
    );
  }

  // ── failed ──────────────────────────────────────────────────────────
  // Es gibt keinen dedizierten `failed_at`-Timestamp, daher nehmen wir
  // pragmatisch den jüngsten verfügbaren Job-Timestamp.
  if (!kind || kind === "failed") {
    const dateFilter: string[] = [];
    const dateBinds: unknown[] = [];
    if (from) {
      dateFilter.push(
        "datetime(COALESCE(j.sent_at, j.scheduled_at, j.created_at)) >= datetime(?)",
      );
      dateBinds.push(from);
    }
    if (to) {
      dateFilter.push(
        "datetime(COALESCE(j.sent_at, j.scheduled_at, j.created_at)) <= datetime(?)",
      );
      dateBinds.push(to);
    }
    const whereSql = jobFilterSql(
      ["j.status = 'failed'", ...dateFilter].join(" AND "),
    );
    pushSub(
      `SELECT
         'job:' || j.id || ':failed' AS id,
         'failed' AS kind,
         COALESCE(j.sent_at, j.scheduled_at, j.created_at) AS at,
         j.id AS job_id,
         j.recipient_email,
         j.custom_subject,
         j.template_id,
         j.status,
         NULL AS link_url,
         NULL AS ip_address,
         NULL AS user_agent,
         NULL AS metadata,
         j.error_message,
         j.retries
       FROM email_jobs j
       ${whereSql}`,
      [...dateBinds, ...baseJobBinds],
    );
  }

  // ── open / click (Tracking-Events) ─────────────────────────────────
  if (hasTracking && (!kind || kind === "open" || kind === "click")) {
    const dateFilter: string[] = [];
    const dateBinds: unknown[] = [];
    if (from) {
      dateFilter.push("datetime(t.created_at) >= datetime(?)");
      dateBinds.push(from);
    }
    if (to) {
      dateFilter.push("datetime(t.created_at) <= datetime(?)");
      dateBinds.push(to);
    }
    const eventTypeFilter: string[] = [];
    const eventTypeBinds: unknown[] = [];
    if (kind === "open") {
      eventTypeFilter.push("t.event_type = 'open'");
    } else if (kind === "click") {
      eventTypeFilter.push("t.event_type = 'click'");
    } else {
      eventTypeFilter.push("t.event_type IN ('open','click')");
    }

    // q matched gegen Tracking-Felder ODER zugehörigen Job
    const qFilter: string[] = [];
    const qBinds: unknown[] = [];
    if (q) {
      const like = `%${q}%`;
      qFilter.push(
        `(t.ip_address LIKE ? OR COALESCE(t.link_url,'') LIKE ? OR COALESCE(t.user_agent,'') LIKE ? OR j.id LIKE ? OR COALESCE(j.recipient_email,'') LIKE ? OR COALESCE(j.custom_subject,'') LIKE ?)`,
      );
      qBinds.push(like, like, like, like, like, like);
    }

    const filterParts: string[] = [...eventTypeFilter, ...dateFilter];
    if (status) filterParts.push("j.status = ?");
    if (q) filterParts.push(...qFilter);
    const whereSql = filterParts.length
      ? ` WHERE ${filterParts.join(" AND ")}`
      : "";

    const allBinds: unknown[] = [
      ...eventTypeBinds,
      ...dateBinds,
      ...(status ? [status] : []),
      ...qBinds,
    ];

    pushSub(
      `SELECT
         t.id AS id,
         t.event_type AS kind,
         t.created_at AS at,
         t.job_id AS job_id,
         j.recipient_email,
         j.custom_subject,
         j.template_id,
         j.status,
         t.link_url,
         t.ip_address,
         t.user_agent,
         t.metadata,
         NULL AS error_message,
         NULL AS retries
       FROM email_tracking t
       LEFT JOIN email_jobs j ON j.id = t.job_id
       ${whereSql}`,
      allBinds,
    );
  }

  if (subQueries.length === 0) {
    return jsonResponse({ rows: [], total: 0, limit, offset });
  }

  const unionSql = subQueries.join("\nUNION ALL\n");

  try {
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS n FROM (${unionSql}) AS u`)
      .bind(...subBinds)
      .first<{ n: number }>();
    const total = totalRow?.n ?? 0;

    const rowsRes = await db
      .prepare(
        `SELECT * FROM (${unionSql}) AS u
         ORDER BY datetime(at) DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...subBinds, limit, offset)
      .all<EventRow>();

    return jsonResponse({
      rows: rowsRes.results ?? [],
      total,
      limit,
      offset,
      tracking_available: hasTracking,
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

// ─── Schreibende Verben: 405 ─────────────────────────────────────────

function notAllowed(): Response {
  return jsonResponse(
    {
      error: "Diese Methode ist auf /api/emails/timeline nicht erlaubt.",
    },
    { status: 405, headers: { Allow: "GET" } },
  );
}

export const onRequestPost: PagesFunction<AuthEnv> = async () => notAllowed();
export const onRequestPut: PagesFunction<AuthEnv> = async () => notAllowed();
export const onRequestPatch: PagesFunction<AuthEnv> = async () => notAllowed();
export const onRequestDelete: PagesFunction<AuthEnv> = async () => notAllowed();
