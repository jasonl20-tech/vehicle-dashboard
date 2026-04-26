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

  const [subRow, trialRow, newsRow, openJobsRow, keySplit] = await Promise.all([
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
      .prepare(
        `SELECT COUNT(*) as n FROM controll_status WHERE "check" = 0`,
      )
      .first<{ n: number }>(),
    (async () => {
      if (!env.customer_keys) {
        return null as { productive: number; test: number } | null;
      }
      const summaries = await fetchAllSummaries(env.customer_keys);
      return countActiveKeySplit(summaries);
    })(),
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
    },
    { status: 200 },
  );
};
