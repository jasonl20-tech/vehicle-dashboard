/**
 * Tracking-Events eines einzelnen Email-Jobs (READ-ONLY).
 *
 *   GET /api/emails/jobs/<id>/events?q=&event_type=&limit=&offset=
 *     → { rows: TrackingEventRow[], total, limit, offset, eventCounts }
 *
 * Wird vom Detail-Panel der Email-Logs-Seite benutzt: dort steht eine
 * suchbare, paginierte Tabelle aller Pixel-Opens und Click-Events des
 * gewählten Jobs.
 */
import {
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
} from "../../../../_lib/auth";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;
const ALLOWED_EVENT_TYPES = new Set(["open", "click"]);

type Row = {
  id: string;
  job_id: string;
  event_type: string;
  link_url: string | null;
  user_agent: string | null;
  ip_address: string | null;
  metadata: string | null;
  created_at: string | null;
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
  if (/no such table/i.test(msg) && /email_tracking/.test(msg)) {
    return "Tabelle `email_tracking` fehlt. Migration ausführen: `wrangler d1 execute <DB-NAME> --file=./d1/migrations/0009_email_tracking.sql`.";
  }
  return null;
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

  const id = typeof params?.id === "string" ? params.id : "";
  if (!id) {
    return jsonResponse({ error: "id fehlt" }, { status: 400 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const eventType = (url.searchParams.get("event_type") || "").trim();
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

  const where: string[] = ["job_id = ?"];
  const binds: (string | number)[] = [id];

  if (eventType) {
    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return jsonResponse(
        { error: `event_type muss 'open' oder 'click' sein` },
        { status: 400 },
      );
    }
    where.push("event_type = ?");
    binds.push(eventType);
  }
  if (q) {
    const pat = `%${q.replace(/[%_]/g, "")}%`;
    where.push(
      "(link_url LIKE ? OR user_agent LIKE ? OR ip_address LIKE ? OR metadata LIKE ? OR id LIKE ?)",
    );
    binds.push(pat, pat, pat, pat, pat);
  }
  const whereSql = ` WHERE ${where.join(" AND ")}`;

  try {
    const total =
      (
        await db
          .prepare(`SELECT COUNT(*) AS n FROM email_tracking${whereSql}`)
          .bind(...binds)
          .first<{ n: number }>()
      )?.n ?? 0;

    const counts = await db
      .prepare(
        `SELECT event_type, COUNT(*) AS n
           FROM email_tracking
          WHERE job_id = ?
          GROUP BY event_type`,
      )
      .bind(id)
      .all<{ event_type: string; n: number }>();
    const eventCounts: Record<string, number> = {};
    for (const r of counts.results ?? []) {
      if (r?.event_type) eventCounts[r.event_type] = Number(r.n) || 0;
    }

    const { results } = await db
      .prepare(
        `SELECT id,
                job_id,
                event_type,
                link_url,
                user_agent,
                ip_address,
                metadata,
                created_at
           FROM email_tracking${whereSql}
          ORDER BY datetime(created_at) DESC, id DESC
          LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, offset)
      .all<Row>();

    return jsonResponse({
      rows: results ?? [],
      total,
      limit,
      offset,
      eventCounts,
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
      "Tracking-Events sind read-only. Geschrieben werden sie ausschließlich vom externen Mail-Worker / Tracking-Worker.",
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
