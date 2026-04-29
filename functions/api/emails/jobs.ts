/**
 * Email-Jobs (Versand-Log) — READ-ONLY.
 *
 *   GET  /api/emails/jobs?q=&status=&template_id=&from=&to=&limit=&offset=
 *     → { rows: EmailJobRow[], total, limit, offset, hint? }
 *
 * Die Tabelle `email_jobs` wird vom externen Mail-Worker geschrieben.
 * Im Dashboard ist sie strikt nur einsehbar — das Backend exponiert
 * KEINE schreibenden Methoden (POST/PUT/PATCH/DELETE) für diesen
 * Endpoint. Wer auf einen schreibenden Verb zugreift, bekommt 405.
 *
 * Schema (siehe d1/migrations/0008_email_jobs.sql):
 *   id, recipient_data, template_id, custom_subject, custom_body_html,
 *   status, error_message, retries, scheduled_at, sent_at, created_at,
 *   from_email
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

const ALLOWED_STATUS = new Set([
  "pending",
  "processing",
  "sent",
  "failed",
]);

type Row = {
  id: string;
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
  if (/no such table/i.test(msg) || /email_jobs/.test(msg)) {
    return "Tabelle `email_jobs` fehlt. Migration ausführen: `wrangler d1 execute <DB-NAME> --file=./d1/migrations/0008_email_jobs.sql`.";
  }
  return null;
}

/** Parsed Datum für SQLite — akzeptiert ISO-Strings (mit oder ohne `T`). */
function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  // Akzeptiere `YYYY-MM-DD`, `YYYY-MM-DD HH:MM:SS`, `YYYY-MM-DDTHH:MM:SSZ`
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.replace("T", " ").replace("Z", "");
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
    // Wir suchen in id, custom_subject, recipient_data (JSON-Volltext),
    // error_message und from_email — robust für free-text Suche.
    where.push(
      "(id LIKE ? OR custom_subject LIKE ? OR recipient_data LIKE ? OR error_message LIKE ? OR from_email LIKE ?)",
    );
    binds.push(pat, pat, pat, pat, pat);
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
    where.push("status = ?");
    binds.push(statusParam);
  }
  if (templateId) {
    where.push("template_id = ?");
    binds.push(templateId);
  }
  if (fromDate) {
    where.push("datetime(created_at) >= datetime(?)");
    binds.push(fromDate);
  }
  if (toDate) {
    where.push("datetime(created_at) <= datetime(?)");
    binds.push(toDate);
  }

  const whereSql = ` WHERE ${where.join(" AND ")}`;

  try {
    const total =
      (
        await db
          .prepare(`SELECT COUNT(*) AS n FROM email_jobs${whereSql}`)
          .bind(...binds)
          .first<{ n: number }>()
      )?.n ?? 0;

    const counts = await db
      .prepare(
        `SELECT status, COUNT(*) AS n FROM email_jobs${whereSql} GROUP BY status`,
      )
      .bind(...binds)
      .all<{ status: string; n: number }>();

    const statusCounts: Record<string, number> = {};
    for (const r of counts.results ?? []) {
      if (r?.status) statusCounts[r.status] = Number(r.n) || 0;
    }

    const { results } = await db
      .prepare(
        `SELECT id,
                recipient_data,
                template_id,
                custom_subject,
                COALESCE(length(custom_body_html), 0) AS custom_body_html_length,
                status,
                error_message,
                COALESCE(retries, 0) AS retries,
                scheduled_at,
                sent_at,
                created_at,
                from_email
           FROM email_jobs${whereSql}
           ORDER BY datetime(COALESCE(sent_at, scheduled_at, created_at)) DESC,
                    id DESC
           LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, offset)
      .all<Row>();

    return jsonResponse({
      rows: results ?? [],
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

const NOT_ALLOWED: Response = jsonResponse(
  {
    error:
      "Email-Jobs sind im Dashboard nur lesend einsehbar. Schreibende Operationen erfolgen ausschließlich über den externen Mail-Worker.",
  },
  { status: 405, headers: { Allow: "GET" } },
);

export const onRequestPost: PagesFunction<AuthEnv> = async () =>
  NOT_ALLOWED.clone();
export const onRequestPut: PagesFunction<AuthEnv> = async () =>
  NOT_ALLOWED.clone();
export const onRequestPatch: PagesFunction<AuthEnv> = async () =>
  NOT_ALLOWED.clone();
export const onRequestDelete: PagesFunction<AuthEnv> = async () =>
  NOT_ALLOWED.clone();
