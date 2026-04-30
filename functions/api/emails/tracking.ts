/**
 * Globale Tracking-Statistik über alle Email-Jobs.
 *
 *   GET /api/emails/tracking?from=&to=
 *     → {
 *         range: { from, to },
 *         totals: {
 *           jobs_total, jobs_sent, jobs_with_open, jobs_with_click,
 *           opens_total, clicks_total,
 *           unique_open_jobs, unique_click_jobs,
 *           unique_ips,
 *           open_rate, click_rate, click_to_open_rate,
 *           first_open_at, last_event_at
 *         },
 *         by_day:        [{ day, opens, clicks }],
 *         by_hour:       [{ hour: 0..23, opens, clicks }],
 *         top_links:     [{ link_url, count }],
 *         top_countries: [{ country, count }],
 *         top_cities:    [{ city, country, count }],
 *         top_jobs:      [{ id, custom_subject, recipient_email, opens, clicks }],
 *         recent_events: [TrackingEventRow]
 *       }
 *
 * READ-ONLY. Schreibende Verben → 405.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

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
  if (/no such table/i.test(msg) && /email_tracking|email_jobs/.test(msg)) {
    return "Tabelle `email_tracking` oder `email_jobs` fehlt. Migration 0009 ausführen: `wrangler d1 execute <DB-NAME> --file=./d1/migrations/0009_email_tracking.sql`.";
  }
  return null;
}

function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.replace("T", " ").replace("Z", "");
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
  const fromDate = normalizeDate(url.searchParams.get("from"));
  const toDate = normalizeDate(url.searchParams.get("to"));

  // Tracking-Filter (auf email_tracking.created_at)
  const trackingWhere: string[] = [];
  const trackingBinds: (string | number)[] = [];
  if (fromDate) {
    trackingWhere.push("datetime(created_at) >= datetime(?)");
    trackingBinds.push(fromDate);
  }
  if (toDate) {
    trackingWhere.push("datetime(created_at) <= datetime(?)");
    trackingBinds.push(toDate);
  }
  const trackingWhereSql = trackingWhere.length
    ? ` WHERE ${trackingWhere.join(" AND ")}`
    : "";

  // Job-Filter (auf email_jobs.created_at)
  const jobWhere: string[] = [];
  const jobBinds: (string | number)[] = [];
  if (fromDate) {
    jobWhere.push("datetime(created_at) >= datetime(?)");
    jobBinds.push(fromDate);
  }
  if (toDate) {
    jobWhere.push("datetime(created_at) <= datetime(?)");
    jobBinds.push(toDate);
  }
  const jobWhereSql = jobWhere.length
    ? ` WHERE ${jobWhere.join(" AND ")}`
    : "";

  try {
    // Jobs gesamt / gesendet
    const jobAgg = await db
      .prepare(
        `SELECT COUNT(*) AS jobs_total,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS jobs_sent
           FROM email_jobs${jobWhereSql}`,
      )
      .bind(...jobBinds)
      .first<{ jobs_total: number; jobs_sent: number }>();

    let trackAgg: {
      opens_total: number;
      clicks_total: number;
      unique_open_jobs: number;
      unique_click_jobs: number;
      unique_ips: number;
      first_open_at: string | null;
      last_event_at: string | null;
    } | null = null;
    let byDayResults: { day: string; opens: number; clicks: number }[] = [];
    let byHourResults: { hour: number; opens: number; clicks: number }[] = [];
    let topLinksResults: { link_url: string; count: number }[] = [];
    let topJobsRaw: {
      id: string;
      custom_subject: string | null;
      recipient_email: string | null;
      template_id: string | null;
      opens: number;
      clicks: number;
    }[] = [];
    let recentRaw: Array<{
      id: string;
      job_id: string;
      event_type: string;
      link_url: string | null;
      user_agent: string | null;
      ip_address: string | null;
      metadata: string | null;
      created_at: string | null;
      custom_subject: string | null;
      recipient_email: string | null;
    }> = [];
    let metaResults: { metadata: string }[] = [];

    try {
      trackAgg = await db
        .prepare(
          `SELECT
              SUM(CASE WHEN event_type = 'open'  THEN 1 ELSE 0 END) AS opens_total,
              SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) AS clicks_total,
              COUNT(DISTINCT CASE WHEN event_type = 'open'  THEN job_id END) AS unique_open_jobs,
              COUNT(DISTINCT CASE WHEN event_type = 'click' THEN job_id END) AS unique_click_jobs,
              COUNT(DISTINCT ip_address) AS unique_ips,
              MIN(CASE WHEN event_type = 'open' THEN created_at END) AS first_open_at,
              MAX(created_at) AS last_event_at
            FROM email_tracking${trackingWhereSql}`,
        )
        .bind(...trackingBinds)
        .first();

      const dayRows = await db
        .prepare(
          `SELECT substr(created_at, 1, 10) AS day,
                  SUM(CASE WHEN event_type = 'open'  THEN 1 ELSE 0 END) AS opens,
                  SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) AS clicks
             FROM email_tracking${trackingWhereSql}
             GROUP BY substr(created_at, 1, 10)
             ORDER BY day ASC`,
        )
        .bind(...trackingBinds)
        .all<{ day: string; opens: number; clicks: number }>();
      byDayResults = (dayRows.results ?? []).map((r) => ({
        day: r.day,
        opens: Number(r.opens) || 0,
        clicks: Number(r.clicks) || 0,
      }));

      const hourRows = await db
        .prepare(
          `SELECT CAST(substr(created_at, 12, 2) AS INTEGER) AS hour,
                  SUM(CASE WHEN event_type = 'open'  THEN 1 ELSE 0 END) AS opens,
                  SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) AS clicks
             FROM email_tracking${trackingWhereSql}
             GROUP BY hour
             ORDER BY hour ASC`,
        )
        .bind(...trackingBinds)
        .all<{ hour: number; opens: number; clicks: number }>();
      byHourResults = (hourRows.results ?? []).map((r) => ({
        hour: Number(r.hour) || 0,
        opens: Number(r.opens) || 0,
        clicks: Number(r.clicks) || 0,
      }));

      const linkRows = await db
        .prepare(
          `SELECT link_url, COUNT(*) AS n
             FROM email_tracking${trackingWhereSql}${
            trackingWhere.length
              ? " AND event_type = 'click' AND link_url IS NOT NULL"
              : " WHERE event_type = 'click' AND link_url IS NOT NULL"
          }
             GROUP BY link_url
             ORDER BY n DESC
             LIMIT 15`,
        )
        .bind(...trackingBinds)
        .all<{ link_url: string; n: number }>();
      topLinksResults = (linkRows.results ?? []).map((r) => ({
        link_url: r.link_url,
        count: Number(r.n) || 0,
      }));

      // Top-Jobs nach Events
      const topJobsRows = await db
        .prepare(
          `SELECT j.id,
                  j.custom_subject,
                  COALESCE(j.recipient_email, '') AS recipient_email,
                  j.template_id,
                  SUM(CASE WHEN t.event_type = 'open'  THEN 1 ELSE 0 END) AS opens,
                  SUM(CASE WHEN t.event_type = 'click' THEN 1 ELSE 0 END) AS clicks
             FROM email_tracking t
             JOIN email_jobs j ON j.id = t.job_id
            ${trackingWhereSql.replace(/created_at/g, "t.created_at")}
             GROUP BY j.id
             ORDER BY (opens + clicks) DESC, j.id DESC
             LIMIT 10`,
        )
        .bind(...trackingBinds)
        .all<{
          id: string;
          custom_subject: string | null;
          recipient_email: string | null;
          template_id: string | null;
          opens: number;
          clicks: number;
        }>();
      topJobsRaw = topJobsRows.results ?? [];

      // Recent Events (für die Timeline rechts unten)
      const recentRows = await db
        .prepare(
          `SELECT t.id,
                  t.job_id,
                  t.event_type,
                  t.link_url,
                  t.user_agent,
                  t.ip_address,
                  t.metadata,
                  t.created_at,
                  j.custom_subject,
                  COALESCE(j.recipient_email, '') AS recipient_email
             FROM email_tracking t
             LEFT JOIN email_jobs j ON j.id = t.job_id
            ${trackingWhereSql.replace(/created_at/g, "t.created_at")}
             ORDER BY datetime(t.created_at) DESC, t.id DESC
             LIMIT 50`,
        )
        .bind(...trackingBinds)
        .all<{
          id: string;
          job_id: string;
          event_type: string;
          link_url: string | null;
          user_agent: string | null;
          ip_address: string | null;
          metadata: string | null;
          created_at: string | null;
          custom_subject: string | null;
          recipient_email: string | null;
        }>();
      recentRaw = recentRows.results ?? [];

      const metaRows = await db
        .prepare(
          `SELECT metadata FROM email_tracking${trackingWhereSql}${
            trackingWhere.length
              ? " AND metadata IS NOT NULL"
              : " WHERE metadata IS NOT NULL"
          }`,
        )
        .bind(...trackingBinds)
        .all<{ metadata: string }>();
      metaResults = metaRows.results ?? [];
    } catch (innerErr) {
      const msg = (innerErr as Error)?.message || String(innerErr);
      if (!/no such table/i.test(msg) || !/email_tracking/.test(msg)) {
        throw innerErr;
      }
      // Tabelle fehlt → leere Zahlen, Hinweis am Ende
    }

    // Top-Länder/Städte aus metadata aggregieren (JSON-parsing client-side
    // hier im Worker, weil SQLite kein json_each in jeder Build-Variante hat).
    const countryCounts = new Map<string, number>();
    const cityCounts = new Map<
      string,
      { city: string; country: string | null; count: number }
    >();
    for (const r of metaResults) {
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
    const topCountries = Array.from(countryCounts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
    const topCities = Array.from(cityCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const opens = Number(trackAgg?.opens_total || 0);
    const clicks = Number(trackAgg?.clicks_total || 0);
    const uniqueOpenJobs = Number(trackAgg?.unique_open_jobs || 0);
    const uniqueClickJobs = Number(trackAgg?.unique_click_jobs || 0);
    const uniqueIps = Number(trackAgg?.unique_ips || 0);
    const jobsSent = Number(jobAgg?.jobs_sent || 0);

    const openRate = jobsSent > 0 ? uniqueOpenJobs / jobsSent : 0;
    const clickRate = jobsSent > 0 ? uniqueClickJobs / jobsSent : 0;
    const clickToOpenRate =
      uniqueOpenJobs > 0 ? uniqueClickJobs / uniqueOpenJobs : 0;

    return jsonResponse({
      range: { from: fromDate, to: toDate },
      totals: {
        jobs_total: Number(jobAgg?.jobs_total || 0),
        jobs_sent: jobsSent,
        jobs_with_open: uniqueOpenJobs,
        jobs_with_click: uniqueClickJobs,
        opens_total: opens,
        clicks_total: clicks,
        unique_open_jobs: uniqueOpenJobs,
        unique_click_jobs: uniqueClickJobs,
        unique_ips: uniqueIps,
        open_rate: openRate,
        click_rate: clickRate,
        click_to_open_rate: clickToOpenRate,
        first_open_at: trackAgg?.first_open_at ?? null,
        last_event_at: trackAgg?.last_event_at ?? null,
      },
      by_day: byDayResults,
      by_hour: byHourResults,
      top_links: topLinksResults,
      top_countries: topCountries,
      top_cities: topCities,
      top_jobs: topJobsRaw.map((r) => ({
        id: r.id,
        custom_subject: r.custom_subject,
        recipient_email: r.recipient_email ?? null,
        template_id: r.template_id ?? null,
        opens: Number(r.opens) || 0,
        clicks: Number(r.clicks) || 0,
      })),
      recent_events: recentRaw,
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
    error: "Tracking-Statistiken sind read-only.",
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
