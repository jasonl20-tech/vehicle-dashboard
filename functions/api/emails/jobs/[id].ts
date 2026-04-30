/**
 * Email-Jobs — Einzelner Job + Tracking-Zusammenfassung.
 *
 *   GET /api/emails/jobs/<id>
 *     → EmailJobFull (inkl. raw `custom_body_html`, voller `recipient_data`,
 *        Tracking-Aggregate sowie Top-Click-URLs / Top-Länder)
 *
 * Schreibende Verben: 405. Bearbeitung erfolgt ausschließlich durch den
 * externen Mail-Worker.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../../_lib/auth";

type FullRow = {
  id: string;
  recipient_email: string;
  tracking_id: string;
  recipient_data: string;
  template_id: string | null;
  custom_subject: string | null;
  custom_body_html: string | null;
  status: string;
  error_message: string | null;
  retries: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  from_email: string;
};

type TrackingSummary = {
  open_count: number;
  click_count: number;
  unique_open_count: number;
  unique_click_count: number;
  unique_ip_count: number;
  first_open_at: string | null;
  last_open_at: string | null;
  first_click_at: string | null;
  last_click_at: string | null;
  last_event_at: string | null;
  top_links: { link_url: string; count: number }[];
  top_countries: { country: string; count: number }[];
  top_cities: { city: string; country: string | null; count: number }[];
  events_by_day: { day: string; opens: number; clicks: number }[];
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
    return "Tabelle `email_jobs` oder `email_tracking` fehlt. Migrationen ausführen.";
  }
  return null;
}

function pickMetaString(raw: string | null, key: string): string | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const v = (obj as Record<string, unknown>)[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

async function loadTrackingSummary(
  db: D1Database,
  jobId: string,
): Promise<TrackingSummary> {
  const empty: TrackingSummary = {
    open_count: 0,
    click_count: 0,
    unique_open_count: 0,
    unique_click_count: 0,
    unique_ip_count: 0,
    first_open_at: null,
    last_open_at: null,
    first_click_at: null,
    last_click_at: null,
    last_event_at: null,
    top_links: [],
    top_countries: [],
    top_cities: [],
    events_by_day: [],
  };

  let agg: {
    opens: number;
    clicks: number;
    unique_opens: number;
    unique_clicks: number;
    unique_ips: number;
    first_open_at: string | null;
    last_open_at: string | null;
    first_click_at: string | null;
    last_click_at: string | null;
    last_event_at: string | null;
  } | null = null;
  try {
    agg = await db
      .prepare(
        `SELECT
            SUM(CASE WHEN event_type = 'open'  THEN 1 ELSE 0 END) AS opens,
            SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) AS clicks,
            COUNT(DISTINCT CASE WHEN event_type = 'open'  THEN COALESCE(ip_address, id) END) AS unique_opens,
            COUNT(DISTINCT CASE WHEN event_type = 'click' THEN COALESCE(ip_address, id) END) AS unique_clicks,
            COUNT(DISTINCT ip_address) AS unique_ips,
            MIN(CASE WHEN event_type = 'open'  THEN created_at END) AS first_open_at,
            MAX(CASE WHEN event_type = 'open'  THEN created_at END) AS last_open_at,
            MIN(CASE WHEN event_type = 'click' THEN created_at END) AS first_click_at,
            MAX(CASE WHEN event_type = 'click' THEN created_at END) AS last_click_at,
            MAX(created_at) AS last_event_at
          FROM email_tracking
         WHERE job_id = ?`,
      )
      .bind(jobId)
      .first();
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    if (/no such table/i.test(msg)) return empty;
    throw e;
  }

  const out: TrackingSummary = {
    ...empty,
    open_count: Number(agg?.opens || 0),
    click_count: Number(agg?.clicks || 0),
    unique_open_count: Number(agg?.unique_opens || 0),
    unique_click_count: Number(agg?.unique_clicks || 0),
    unique_ip_count: Number(agg?.unique_ips || 0),
    first_open_at: agg?.first_open_at ?? null,
    last_open_at: agg?.last_open_at ?? null,
    first_click_at: agg?.first_click_at ?? null,
    last_click_at: agg?.last_click_at ?? null,
    last_event_at: agg?.last_event_at ?? null,
  };

  if (out.click_count > 0 || out.open_count > 0) {
    const links = await db
      .prepare(
        `SELECT link_url, COUNT(*) AS n
           FROM email_tracking
          WHERE job_id = ? AND event_type = 'click' AND link_url IS NOT NULL
          GROUP BY link_url
          ORDER BY n DESC
          LIMIT 10`,
      )
      .bind(jobId)
      .all<{ link_url: string; n: number }>();
    out.top_links = (links.results ?? []).map((r) => ({
      link_url: r.link_url,
      count: Number(r.n) || 0,
    }));

    const meta = await db
      .prepare(
        `SELECT metadata FROM email_tracking WHERE job_id = ? AND metadata IS NOT NULL`,
      )
      .bind(jobId)
      .all<{ metadata: string }>();

    const countryCounts = new Map<string, number>();
    const cityCounts = new Map<string, { city: string; country: string | null; count: number }>();
    for (const r of meta.results ?? []) {
      const country = pickMetaString(r.metadata, "country");
      const city = pickMetaString(r.metadata, "city");
      if (country) {
        countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
      }
      if (city) {
        const key = `${city}__${country || ""}`;
        const ex = cityCounts.get(key);
        if (ex) ex.count += 1;
        else cityCounts.set(key, { city, country, count: 1 });
      }
    }
    out.top_countries = Array.from(countryCounts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    out.top_cities = Array.from(cityCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const days = await db
      .prepare(
        `SELECT substr(created_at, 1, 10) AS day,
                SUM(CASE WHEN event_type = 'open'  THEN 1 ELSE 0 END) AS opens,
                SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) AS clicks
           FROM email_tracking
          WHERE job_id = ?
          GROUP BY substr(created_at, 1, 10)
          ORDER BY day ASC`,
      )
      .bind(jobId)
      .all<{ day: string; opens: number; clicks: number }>();
    out.events_by_day = (days.results ?? []).map((r) => ({
      day: r.day,
      opens: Number(r.opens) || 0,
      clicks: Number(r.clicks) || 0,
    }));
  }

  return out;
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

  try {
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
      .first<FullRow>();

    if (!row) {
      return jsonResponse(
        { error: `Job \`${id}\` nicht gefunden` },
        { status: 404 },
      );
    }

    const tracking = await loadTrackingSummary(db, id);

    return jsonResponse({ ...row, tracking });
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
