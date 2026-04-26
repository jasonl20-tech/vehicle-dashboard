/**
 * GET /api/intern-analytics/image-url-requests-geo
 *
 * Analytics Engine: Stream `image_url_requests` (oder dedizierte Tabelle gleichen Namens).
 * Länder: `blob3` (ISO-2, z. B. GB). Domains: `index1` (Kunden-Hosts).
 * Zählung: SUM(_sample_interval) wie in den anderen AE-Auswertungen.
 *
 * Query: from, to (YYYY-MM-DD HH:MM:SS, UTC), optional wie bei anderen.
 */
import {
  aeNumber,
  getMergedAnalyticsSources,
  resolveAnalyticsBinding,
  runAeSql,
  sqlDateTime,
  sqlString,
  type AeAccountBinding,
} from "../../_lib/analytics";
import {
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
} from "../../_lib/auth";

const DEFAULT_DAYS = 30;
const MAX_DOMAINS = 500;

type CountryRow = { iso2: string; c: number };
type DomainRow = { d: string; c: number };

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(
    to.getTime() - DEFAULT_DAYS * 24 * 60 * 60 * 1000,
  );
  const fmt = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);
  return { from: fmt(from), to: fmt(new Date(to.getTime() + 60_000)) };
}

function isDedicatedTableMode(env: AuthEnv): boolean {
  const v = env.IMAGE_URL_REQUESTS_DEDICATED?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  return false;
}

function getDatasetName(env: AuthEnv): string {
  const raw = (env.IMAGE_URL_REQUESTS_DATASET ?? "image_url_requests").trim();
  if (!/^[a-zA-Z0-9_]+$/.test(raw)) return "image_url_requests";
  return raw;
}

function imageUrlAeBinding(env: AuthEnv): AeAccountBinding {
  return env.IMAGE_URL_AE_ACCOUNT?.trim().toLowerCase() === "secondary"
    ? "secondary"
    : "primary";
}

/**
 * Tatsächliches fromTable für Filter-Mode (key_analytics vs api_analytics pro Binding).
 */
function fromKeyAnalyticsForBinding(
  env: AuthEnv,
  binding: AeAccountBinding,
): string {
  const p = resolveAnalyticsBinding(env, binding);
  return p.error ? (binding === "secondary" ? "api_analytics" : "key_analytics") : p.dataset;
}

function buildTimeWhere(fromIso: string, toIso: string): string {
  return `timestamp >= ${sqlDateTime(fromIso)} AND timestamp < ${sqlDateTime(toIso)}`;
}

function buildCountrySql(
  fromIso: string,
  toIso: string,
  fromDataset: string,
  dedicated: boolean,
  name: string,
): string {
  const tw = buildTimeWhere(fromIso, toIso);
  if (dedicated) {
    return `SELECT
  UPPER(TRIM(blob3)) AS iso2,
  SUM(_sample_interval) AS c
FROM ${name}
WHERE ${tw}
  AND length(TRIM(ifNull(blob3, ''))) = 2
GROUP BY iso2
FORMAT JSON`;
  }
  return `SELECT
  UPPER(TRIM(blob3)) AS iso2,
  SUM(_sample_interval) AS c
FROM ${fromDataset}
WHERE ${tw} AND dataset = ${sqlString(name)}
  AND length(TRIM(ifNull(blob3, ''))) = 2
GROUP BY iso2
FORMAT JSON`;
}

function buildDomainSql(
  fromIso: string,
  toIso: string,
  fromDataset: string,
  dedicated: boolean,
  name: string,
): string {
  const tw = buildTimeWhere(fromIso, toIso);
  const notEmpty = `index1 != ${sqlString("")} AND index1 != ${sqlString("NA")} AND lower(index1) != ${sqlString("na")}`;
  if (dedicated) {
    return `SELECT
  index1 AS d,
  SUM(_sample_interval) AS c
FROM ${name}
WHERE ${tw} AND ${notEmpty}
GROUP BY index1
ORDER BY c DESC
LIMIT ${MAX_DOMAINS}
FORMAT JSON`;
  }
  return `SELECT
  index1 AS d,
  SUM(_sample_interval) AS c
FROM ${fromDataset}
WHERE ${tw} AND dataset = ${sqlString(name)} AND ${notEmpty}
GROUP BY index1
ORDER BY c DESC
LIMIT ${MAX_DOMAINS}
FORMAT JSON`;
}

function mergeByIso2(parts: CountryRow[][]): {
  byIso2: Record<string, number>;
  max: number;
  total: number;
  countryCount: number;
} {
  const byIso2: Record<string, number> = {};
  for (const part of parts) {
    for (const r of part) {
      const k = (r.iso2 || "").toUpperCase().trim();
      if (!/^[A-Z]{2}$/.test(k)) continue;
      byIso2[k] = (byIso2[k] ?? 0) + aeNumber(r.c);
    }
  }
  let max = 0;
  for (const v of Object.values(byIso2)) {
    if (v > max) max = v;
  }
  const total = Object.values(byIso2).reduce((a, b) => a + b, 0);
  return {
    byIso2,
    max,
    total,
    countryCount: Object.keys(byIso2).length,
  };
}

function mergeDomains(parts: DomainRow[][]): { domains: { domain: string; count: number }[] } {
  const m = new Map<string, { display: string; n: number }>();
  for (const part of parts) {
    for (const r of part) {
      const raw = String(r.d ?? "").trim();
      if (!raw) continue;
      const k = raw.toLowerCase();
      const n = aeNumber(r.c);
      const cur = m.get(k);
      if (cur) cur.n += n;
      else m.set(k, { display: raw, n });
    }
  }
  const domains = Array.from(m.values())
    .map(({ display, n }) => ({ domain: display, count: n }))
    .sort((a, b) => b.count - a.count);
  return { domains };
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
  const def = defaultRange();
  const from = (url.searchParams.get("from") || def.from).trim();
  const to = (url.searchParams.get("to") || def.to).trim();
  const name = getDatasetName(env);
  const dedicated = isDedicatedTableMode(env);

  const { sources, error: srcErr } = getMergedAnalyticsSources(env);
  if (srcErr) {
    return jsonResponse({ error: srcErr }, { status: 400 });
  }
  if (sources.length === 0) {
    return jsonResponse(
      { error: "Keine Analytics-Quelle (CF_ACCOUNT_ID / CF_API_TOKEN) konfiguriert" },
      { status: 400 },
    );
  }

  // Optional: ein Account wie Controlling (nur primary oder secondary)
  const oneBinding = imageUrlAeBinding(env);
  const chosen =
    oneBinding === "secondary"
      ? sources.filter((s) => s.binding === "secondary")
      : sources.filter((s) => s.binding === "primary");
  const runSources = chosen.length > 0 ? chosen : sources;

  const countryRows: CountryRow[][] = [];
  const domainRows: DomainRow[][] = [];
  const errors: string[] = [];
  let hadCountryOk = false;
  let hadDomainOk = false;

  for (const s of runSources) {
    const fromDataset = fromKeyAnalyticsForBinding(env, s.binding);
    const csql = buildCountrySql(from, to, fromDataset, dedicated, name);
    const dsql = buildDomainSql(from, to, fromDataset, dedicated, name);
    try {
      const c = await runAeSql<CountryRow>(env, csql, { binding: s.binding });
      countryRows.push(c.data);
      hadCountryOk = true;
    } catch (e) {
      errors.push(
        (e as Error).message || String(e),
      );
    }
    try {
      const d = await runAeSql<DomainRow>(env, dsql, { binding: s.binding });
      domainRows.push(d.data);
      hadDomainOk = true;
    } catch (e) {
      errors.push(
        (e as Error).message || String(e),
      );
    }
  }

  if (!hadCountryOk && !hadDomainOk && errors.length > 0) {
    return jsonResponse(
      {
        error: "image_url_requests: Analytics Engine Abfrage fehlgeschlagen",
        details: errors.slice(0, 2),
        hint: dedicated
          ? "Prüfe, ob die Tabelle existiert, oder setze IMAGE_URL_REQUESTS_DEDICATED=0 und schreibe in key_analytics mit Spalte dataset."
          : "Prüfe, ob `dataset` = " +
            name +
            " in key_analytics existiert, oder setze IMAGE_URL_REQUESTS_DEDICATED=1 und eine eigene Tabelle.",
      },
      { status: 502 },
    );
  }

  const merged = mergeByIso2(
    countryRows.length > 0
      ? countryRows
      : [[] as CountryRow[]],
  );
  const { domains } = mergeDomains(
    domainRows.length > 0 ? domainRows : [[] as DomainRow[]],
  );

  return jsonResponse(
    {
      byIso2: merged.byIso2,
      max: merged.max,
      total: merged.total,
      countryCount: merged.countryCount,
      domains,
      range: { from, to },
      engine: {
        name,
        mode: dedicated ? "dedicated" as const : "filter" as const,
        binding: oneBinding,
      },
      queryWarnings: errors.length > 0 ? errors : undefined,
    },
    { status: 200 },
  );
};
