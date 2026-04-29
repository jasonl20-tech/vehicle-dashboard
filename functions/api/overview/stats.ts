/**
 * GET /api/overview/stats
 *
 * Aggregiert Kennzahlen für die Dashboard-Übersicht (D1 website, D1
 * controll_status, optional KV `customer_keys`).
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import { fetchAllSummaries, type CustomerKeySummary } from "../customers/keys";

type Dwm = { day: number; week: number; month: number };

function requireWebsiteDb(env: AuthEnv): D1Database | Response {
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

function requireVehicleDb(env: AuthEnv): D1Database | Response {
  if (!env.vehicledatabase) {
    return jsonResponse(
      {
        error:
          "D1-Binding `vehicledatabase` fehlt. Im Cloudflare-Dashboard → Functions → D1, Variable `vehicledatabase` (env.vehicledatabase) setzen.",
      },
      { status: 503 },
    );
  }
  return env.vehicledatabase;
}

/** Tag = heute (UTC), Woche = rollierend 7 Tage, Monat = laufender Kalendermonat (UTC). */
const DWH_SQL = `
  SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) AS dayN,
  SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS weekN,
  SUM(CASE WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') THEN 1 ELSE 0 END) AS monthN
`;

function mapDwm(r: { dayN: number; weekN: number; monthN: number } | null): Dwm {
  if (!r) return { day: 0, week: 0, month: 0 };
  return {
    day: Number(r.dayN) || 0,
    week: Number(r.weekN) || 0,
    month: Number(r.monthN) || 0,
  };
}

/**
 * Liefert eine 30-Tage-Tageszeitreihe (UTC) inkl. Lückenfüllung.
 * Tabellen ohne `created_at` schlagen mit leerer Liste zurück.
 */
async function fetchDailySeries(
  db: D1Database,
  table: string,
  days = 30,
): Promise<Array<{ date: string; n: number }>> {
  const sql = `SELECT strftime('%Y-%m-%d', created_at) AS d, COUNT(*) AS n
               FROM ${table}
               WHERE created_at >= datetime('now', ?)
               GROUP BY d
               ORDER BY d ASC`;
  const off = `-${days - 1} days`;
  let rows: Array<{ d: string; n: number }> = [];
  try {
    const res = await db.prepare(sql).bind(off).all<{ d: string; n: number }>();
    rows = res?.results ?? [];
  } catch {
    return [];
  }
  // Lücken füllen: für jeden der letzten `days` Tage (UTC) einen Eintrag.
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.d) map.set(r.d, Number(r.n) || 0);
  }
  const out: Array<{ date: string; n: number }> = [];
  const today = new Date();
  // Today midnight UTC
  const baseUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  for (let i = days - 1; i >= 0; i--) {
    const t = baseUtc - i * 24 * 60 * 60 * 1000;
    const d = new Date(t);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;
    out.push({ date: key, n: map.get(key) ?? 0 });
  }
  return out;
}

function countActiveKeySplit(summaries: CustomerKeySummary[]): {
  productive: number;
  test: number;
} {
  const now = Date.now();
  const active = (k: CustomerKeySummary) => {
    if (!k.expires_at) return true;
    const t = Date.parse(k.expires_at);
    return !Number.isNaN(t) && t > now;
  };
  let productive = 0;
  let test = 0;
  for (const k of summaries) {
    if (!active(k)) continue;
    if (k.is_test_key) test += 1;
    else productive += 1;
  }
  return { productive, test };
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const website = requireWebsiteDb(env);
  if (website instanceof Response) return website;

  const vdb = requireVehicleDb(env);
  if (vdb instanceof Response) return vdb;

  const [
    subRow,
    trialRow,
    newsRow,
    openJobsRow,
    keySplit,
    subDaily,
    trialDaily,
    newsDaily,
  ] = await Promise.all([
    website
      .prepare(`SELECT ${DWH_SQL} FROM submissions`)
      .first<{ dayN: number; weekN: number; monthN: number }>(),
    website
      .prepare(`SELECT ${DWH_SQL} FROM trial_submissions`)
      .first<{ dayN: number; weekN: number; monthN: number }>(),
    website
      .prepare(`SELECT ${DWH_SQL} FROM newsletter`)
      .first<{ dayN: number; weekN: number; monthN: number }>(),
    vdb
      .prepare(`SELECT COUNT(*) as n FROM controll_status WHERE "check" = 0`)
      .first<{ n: number }>(),
    (async () => {
      if (!env.customer_keys) {
        return null as { productive: number; test: number } | null;
      }
      const summaries = await fetchAllSummaries(env.customer_keys);
      return countActiveKeySplit(summaries);
    })(),
    fetchDailySeries(website, "submissions"),
    fetchDailySeries(website, "trial_submissions"),
    fetchDailySeries(website, "newsletter"),
  ]);

  return jsonResponse(
    {
      website: {
        submissions: mapDwm(subRow),
        trialSubmissions: mapDwm(trialRow),
        newsletter: mapDwm(newsRow),
      },
      openControllingJobs: Number(openJobsRow?.n) || 0,
      activeKeys: keySplit
        ? { productive: keySplit.productive, test: keySplit.test }
        : null,
      daily: {
        submissions: subDaily,
        trialSubmissions: trialDaily,
        newsletter: newsDaily,
      },
    },
    { status: 200 },
  );
};
