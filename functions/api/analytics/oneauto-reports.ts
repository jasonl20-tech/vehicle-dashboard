/**
 * Monatliche Abrechnung für den Oneauto-Key.
 *
 *   GET /api/analytics/oneauto-reports?months=12
 *
 * Liefert pro Monat (UTC, beginnend am 1.) die Anzahl der echten
 * Bild-Views (blob5 ist View-Name, kein list_*/check_views), den
 * GBP-Betrag (views * 0.02) und den EUR-Gegenwert anhand des
 * Monatsend-Wechselkurses von frankfurter.app (ECB-Daten).
 *
 * Wenn der Wechselkurs nicht abrufbar ist, wird `eur` auf `null`
 * gesetzt und der Grund mitgeschickt – der Monat wird trotzdem
 * angezeigt.
 */

import {
  KEY_ANALYTICS_DATASET,
  ONEAUTO_KEY,
  runAeSql,
  sqlDateTime,
  sqlString,
} from "../../_lib/analytics";
import {
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
} from "../../_lib/auth";

/** Preis pro Bild-View in GBP. */
const PRICE_GBP_PER_VIEW = 0.02;

const VIEW_FILTER_SQL =
  "blob5 != 'NA' AND blob5 != '' AND blob5 NOT LIKE 'list_%' AND blob5 != 'check_views'";

interface MonthBucket {
  /** YYYY-MM-01 (UTC), Monatsanfang. */
  month: string;
  /** ISO-Anfang (inkl.). */
  fromIso: string;
  /** ISO-Ende (exkl., = Anfang Folgemonat). */
  toIso: string;
  /** Hilfs-Datum für Wechselkurs (letzter Tag des Monats oder heute, falls Monat unfertig). */
  fxDate: string;
  /** Ist der Monat schon abgeschlossen? */
  closed: boolean;
}

function buildMonths(count: number, includeCurrent = true): MonthBucket[] {
  const now = new Date();
  const result: MonthBucket[] = [];
  // Wir starten beim aktuellen Monat (oder dem letzten abgeschlossenen) und
  // gehen `count` Monate zurück.
  const cur = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const total = count;
  for (let i = 0; i < total; i++) {
    const start = new Date(
      Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() - i, 1),
    );
    const end = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
    );
    const isCurrent =
      start.getUTCFullYear() === now.getUTCFullYear() &&
      start.getUTCMonth() === now.getUTCMonth();
    if (isCurrent && !includeCurrent) continue;
    const fromIso = isoUtc(start);
    const toIso = isoUtc(end);
    const fxDate = isCurrent
      ? isoDate(now)
      : isoDate(new Date(end.getTime() - 24 * 60 * 60 * 1000));
    result.push({
      month: isoDate(start),
      fromIso,
      toIso,
      fxDate,
      closed: !isCurrent,
    });
  }
  return result;
}

function isoUtc(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface FxRate {
  rate: number;
  date: string;
  source: "frankfurter" | "fallback";
}

const FX_FALLBACK = 1.16; // grober Notnagel, falls API nicht erreichbar

/**
 * Holt einen GBP→EUR-Wechselkurs zu einem Datum. frankfurter.app
 * verwendet automatisch den letzten Werktag, falls das Datum auf
 * Wochenende/Feiertag fällt.
 */
async function getFxRate(
  date: string,
): Promise<{ rate: number | null; date: string; source: "frankfurter" | "fallback"; error?: string }> {
  try {
    const url = `https://api.frankfurter.app/${date}?from=GBP&to=EUR`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 60 * 60 * 24, cacheEverything: true },
    });
    if (!res.ok) {
      return {
        rate: FX_FALLBACK,
        date,
        source: "fallback",
        error: `frankfurter.app HTTP ${res.status}`,
      };
    }
    const j = (await res.json()) as { rates?: { EUR?: number }; date?: string };
    const r = j.rates?.EUR;
    if (typeof r !== "number" || !Number.isFinite(r)) {
      return {
        rate: FX_FALLBACK,
        date,
        source: "fallback",
        error: "Kein EUR-Kurs im Response",
      };
    }
    return { rate: r, date: j.date ?? date, source: "frankfurter" };
  } catch (e) {
    return {
      rate: FX_FALLBACK,
      date,
      source: "fallback",
      error: (e as Error).message,
    };
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

  const url = new URL(request.url);
  const monthsParam = Math.max(
    1,
    Math.min(36, Number(url.searchParams.get("months") || 12)),
  );
  const includeCurrent =
    (url.searchParams.get("includeCurrent") || "true").toLowerCase() !==
    "false";

  const buckets = buildMonths(monthsParam, includeCurrent);

  // Eine einzige Query holt alle Monate auf einmal: Gruppierung nach
  // toStartOfMonth(timestamp).
  const minFrom = buckets[buckets.length - 1].fromIso;
  const maxTo = buckets[0].toIso;

  const sql = `
    SELECT
      toStartOfMonth(timestamp) AS month,
      SUM(_sample_interval) AS requests,
      SUM(_sample_interval * if(${VIEW_FILTER_SQL}, 1, 0)) AS views,
      SUM(_sample_interval * if(${VIEW_FILTER_SQL} AND double1 < 400, 1, 0)) AS viewsOk,
      SUM(_sample_interval * if(${VIEW_FILTER_SQL} AND double1 >= 400, 1, 0)) AS viewsErr
    FROM ${KEY_ANALYTICS_DATASET}
    WHERE timestamp >= ${sqlDateTime(minFrom)}
      AND timestamp <  ${sqlDateTime(maxTo)}
      AND index1 = ${sqlString(ONEAUTO_KEY)}
    GROUP BY month
    ORDER BY month DESC
    LIMIT 100
  `;

  let aeRows: Array<{
    month: string;
    requests: number;
    views: number;
    viewsOk: number;
    viewsErr: number;
  }> = [];
  try {
    const r = await runAeSql<{
      month: string;
      requests: number;
      views: number;
      viewsOk: number;
      viewsErr: number;
    }>(env, sql);
    aeRows = r.data;
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // FX-Rates parallel ziehen.
  const fxResults = await Promise.all(buckets.map((b) => getFxRate(b.fxDate)));

  // AE liefert month z. B. als '2026-04-01' oder '2026-04-01 00:00:00';
  // wir matchen über den YYYY-MM-Prefix.
  const monthMap = new Map<string, (typeof aeRows)[number]>();
  for (const row of aeRows) {
    const key = String(row.month).slice(0, 7); // YYYY-MM
    monthMap.set(key, row);
  }

  let totalViews = 0;
  let totalGbp = 0;
  let totalEur = 0;
  let totalEurMissing = false;

  const months = buckets.map((b, i) => {
    const ym = b.month.slice(0, 7);
    const data = monthMap.get(ym) ?? {
      month: b.month,
      requests: 0,
      views: 0,
      viewsOk: 0,
      viewsErr: 0,
    };
    const fx = fxResults[i];
    const gbp = Math.round(data.views * PRICE_GBP_PER_VIEW * 100) / 100;
    const eur =
      fx.rate != null ? Math.round(gbp * fx.rate * 100) / 100 : null;

    totalViews += data.views;
    totalGbp += gbp;
    if (eur != null) totalEur += eur;
    else totalEurMissing = true;

    return {
      month: b.month,
      fromIso: b.fromIso,
      toIso: b.toIso,
      closed: b.closed,
      requests: data.requests,
      views: data.views,
      viewsOk: data.viewsOk,
      viewsErr: data.viewsErr,
      gbp,
      eur,
      fx: {
        rate: fx.rate,
        date: fx.date,
        source: fx.source,
        error: fx.error ?? null,
      },
    };
  });

  return jsonResponse({
    pricePerViewGbp: PRICE_GBP_PER_VIEW,
    key: ONEAUTO_KEY,
    months,
    totals: {
      views: totalViews,
      gbp: Math.round(totalGbp * 100) / 100,
      eur: totalEurMissing ? null : Math.round(totalEur * 100) / 100,
    },
    generatedAt: new Date().toISOString(),
  });
};
