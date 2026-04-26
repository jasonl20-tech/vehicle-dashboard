/**
 * GET /api/intern-analytics/image-url-requests-customer-arcs
 *
 * Sammelt Customer-Datensätze (D1: `customers`), bei denen sowohl `company`
 * als auch `standort` (ISO-2) gesetzt sind, und holt aus der Analytics
 * Engine das Country-Breakdown pro `index1`-Domain – damit auf der
 * Bildaustrahlungs-Karte ein Bogen vom Firmensitz zu jedem Viewer-Land
 * gezeichnet werden kann.
 *
 * Query: from, to, days (wie geo-Endpoint).
 * Response:
 * ```
 * {
 *   from, to, days, modesTried,
 *   customers: [{
 *     id, email, company, standort,                       // CRM
 *     domain,                                             // gematchte index1-Domain
 *     viewers: { DE: 12, US: 5, ... },                    // ISO-2 → SUM(_sample_interval)
 *     viewersTotal, viewersCountryCount, viewerMax        // Aggregate
 *   }]
 * }
 * ```
 *
 * Beachtet wie `image-url-requests-geo`:
 *  - immer beide Modi (filter + dedicated)
 *  - Mehrere Konten (primary + secondary)
 *  - kein TRIM/UPPER um Spalten (AE-422)
 */
import {
  aeNumber,
  getMergedAnalyticsSources,
  resolveAnalyticsBinding,
  runAeSql,
  sqlDateTime,
  sqlString,
  type AeAccountBinding,
  type AnalyticsSource,
} from "../../_lib/analytics";
import {
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
} from "../../_lib/auth";

const DEFAULT_DAYS = 90;
const MAX_DAYS = 400;
const MAX_DOMAINS_PER_QUERY = 200;
const MAX_TOTAL_DOMAINS = 1000;
const MAX_GROUP_ROWS = 50_000;

type Mode = "filter" | "dedicated";
type DomainCountryRow = { d: string; iso2: string; c: number };

type CustomerDb = {
  id: string;
  email: string;
  company: string | null;
  status: string | null;
  standort: string | null;
};

function defaultRange(days: number): { from: string; to: string } {
  const d = Math.min(MAX_DAYS, Math.max(1, days));
  const to = new Date();
  const from = new Date(to.getTime() - d * 24 * 60 * 60 * 1000);
  const fmt = (x: Date) => x.toISOString().replace("T", " ").slice(0, 19);
  return { from: fmt(from), to: fmt(new Date(to.getTime() + 60_000)) };
}

function envFlag(v: string | undefined): boolean {
  const x = v?.trim().toLowerCase();
  return x === "1" || x === "true" || x === "yes" || x === "on";
}

function envFlagFalse(v: string | undefined): boolean {
  const x = v?.trim().toLowerCase();
  return x === "0" || x === "false" || x === "no" || x === "off";
}

function getDatasetName(env: AuthEnv): string {
  const raw = (env.IMAGE_URL_REQUESTS_DATASET ?? "image_url_requests").trim();
  if (!/^[a-zA-Z0-9_]+$/.test(raw)) return "image_url_requests";
  return raw;
}

function sourcesToRun(
  env: AuthEnv,
  all: AnalyticsSource[],
): AnalyticsSource[] {
  const r = env.IMAGE_URL_AE_ACCOUNT?.trim().toLowerCase();
  if (r === "secondary") {
    const list = all.filter((s) => s.binding === "secondary");
    return list.length ? list : all;
  }
  if (r === "primary") {
    const list = all.filter((s) => s.binding === "primary");
    return list.length ? list : all;
  }
  return all;
}

function fromKeyAnalyticsForBinding(
  env: AuthEnv,
  binding: AeAccountBinding,
): string {
  const p = resolveAnalyticsBinding(env, binding);
  return p.error
    ? binding === "secondary"
      ? "api_analytics"
      : "key_analytics"
    : p.dataset;
}

function buildTimeWhere(fromIso: string, toIso: string): string {
  return `timestamp >= ${sqlDateTime(fromIso)} AND timestamp < ${sqlDateTime(
    toIso,
  )}`;
}

/**
 * Domain-x-Land Breakdown für eine konkrete Liste an `index1`-Werten.
 * `domains` muss bereits SQL-escaped/lowergecast sein – wir machen das hier.
 */
function buildDomainCountrySql(
  fromIso: string,
  toIso: string,
  fromTable: string,
  mode: Mode,
  name: string,
  domains: string[],
): string {
  const tw = buildTimeWhere(fromIso, toIso);
  const list = domains.map((d) => sqlString(d)).join(", ");
  const blob3NotEmpty = `blob3 != ${sqlString("")} AND blob3 != ${sqlString(
    "NA",
  )}`;
  if (mode === "dedicated") {
    return `SELECT
  index1 AS d,
  blob3 AS iso2,
  SUM(_sample_interval) AS c
FROM ${name}
WHERE ${tw}
  AND index1 IN (${list})
  AND ${blob3NotEmpty}
GROUP BY index1, blob3
LIMIT ${MAX_GROUP_ROWS}
FORMAT JSON`;
  }
  return `SELECT
  index1 AS d,
  blob3 AS iso2,
  SUM(_sample_interval) AS c
FROM ${fromTable}
WHERE ${tw} AND dataset = ${sqlString(name)}
  AND index1 IN (${list})
  AND ${blob3NotEmpty}
GROUP BY index1, blob3
LIMIT ${MAX_GROUP_ROWS}
FORMAT JSON`;
}

/**
 * Liefert die Domain-Kandidaten für `customers.company`.
 *
 * Wir akzeptieren mehrere Schreibweisen, falls der CRM-Wert leichte
 * Abweichungen zur in `index1` geloggten Domain hat (z. B. Schreibweise mit
 * `www.`, oder voller URL `https://lohre.com/`). Zusätzlich `lower(trim)`,
 * weil AE in `customer-keys`-Pattern nackte Vergleiche macht (kein TRIM in SQL).
 */
function buildDomainCandidates(company: string): string[] {
  const raw = company.trim();
  if (!raw) return [];

  let host = raw.toLowerCase();
  // URL? → host
  try {
    if (/^https?:\/\//i.test(host)) {
      host = new URL(host).host;
    }
  } catch {
    /* ignore */
  }
  host = host.replace(/^\/+|\/+$/g, "");
  // erstes "Token" (vor Slash, Whitespace, Komma)
  host = host.split(/[\/\s,]/, 1)[0] ?? host;
  if (!host) return [];

  const variants = new Set<string>();
  variants.add(host);
  if (host.startsWith("www.")) variants.add(host.slice(4));
  else variants.add(`www.${host}`);

  // index1 wird im Bildaustrahlungs-Worker meist als reiner Host gespeichert,
  // gelegentlich aber auch mit `:port` oder Subdomain. Wir liefern Host-Liste.
  return Array.from(variants);
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const db = env.website;
  if (!db) {
    return jsonResponse(
      {
        error:
          "D1-Binding `website` fehlt. Im Cloudflare-Dashboard → Functions → D1 setzen (env.website).",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const daysRaw = Number(url.searchParams.get("days") || DEFAULT_DAYS);
  const days =
    Number.isFinite(daysRaw) && daysRaw > 0
      ? Math.min(MAX_DAYS, Math.max(1, daysRaw))
      : DEFAULT_DAYS;
  const def = defaultRange(days);
  const from = (url.searchParams.get("from") || def.from).trim();
  const to = (url.searchParams.get("to") || def.to).trim();
  const name = getDatasetName(env);

  const dedicatedEnv = env.IMAGE_URL_REQUESTS_DEDICATED?.trim().toLowerCase();
  const tryFilter = !envFlag(env.IMAGE_URL_REQUESTS_FILTER_DISABLE);
  const tryDedicated = !envFlagFalse(dedicatedEnv);
  const modes: Mode[] = [];
  if (tryFilter) modes.push("filter");
  if (tryDedicated) modes.push("dedicated");

  // 1) Kunden mit Company + Standort holen.
  // Vorab prüfen, ob `standort` schon existiert – sonst liefern wir eine
  // sanfte Warnung und keine Bögen (statt 500).
  let hasStandortCol = false;
  try {
    const info = await db
      .prepare(`PRAGMA table_info(customers)`)
      .all<{ name: string }>();
    hasStandortCol = (info.results ?? [])
      .map((c) => String(c.name).toLowerCase())
      .includes("standort");
  } catch {
    /* PRAGMA evtl. nicht erlaubt; weiter mit hasStandortCol = false */
  }

  if (!hasStandortCol) {
    return jsonResponse(
      {
        from,
        to,
        days,
        modesTried: modes,
        customers: [],
        info:
          "Spalte `customers.standort` fehlt. Migration `d1/migrations/0005_customers_standort.sql` einspielen, dann erscheinen die Streams.",
        schemaWarning: "missing_column:customers.standort",
      },
      { status: 200 },
    );
  }

  let customerRows: CustomerDb[];
  try {
    const r = await db
      .prepare(
        `SELECT id, email, company, status, standort
         FROM customers
         WHERE standort IS NOT NULL AND TRIM(standort) != ''
           AND company IS NOT NULL AND TRIM(company) != ''
         ORDER BY datetime(created_at) DESC`,
      )
      .all<CustomerDb>();
    customerRows = r.results ?? [];
  } catch (e) {
    return jsonResponse(
      {
        error:
          "D1-Abfrage `customers` fehlgeschlagen: " +
          ((e as Error).message || String(e)),
        hint:
          "Falls die Spalte `standort` fehlt, Migration `0005_customers_standort.sql` einspielen.",
      },
      { status: 500 },
    );
  }

  // Pro Customer: Liste an Domain-Kandidaten.
  type Candidate = {
    customer: CustomerDb;
    domains: string[];
  };
  const candidates: Candidate[] = [];
  const lookupByDomain = new Map<string, { customerId: string }[]>();
  let totalDomains = 0;
  for (const c of customerRows) {
    const standort = (c.standort ?? "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(standort)) continue;
    const company = c.company ?? "";
    const doms = buildDomainCandidates(company);
    if (doms.length === 0) continue;
    const filtered: string[] = [];
    for (const d of doms) {
      if (totalDomains >= MAX_TOTAL_DOMAINS) break;
      filtered.push(d);
      totalDomains += 1;
      const arr = lookupByDomain.get(d) ?? [];
      arr.push({ customerId: c.id });
      lookupByDomain.set(d, arr);
    }
    if (filtered.length > 0) {
      candidates.push({ customer: { ...c, standort }, domains: filtered });
    }
  }

  if (candidates.length === 0) {
    return jsonResponse(
      {
        from,
        to,
        days,
        modesTried: modes,
        customers: [],
        info: "Keine Kunden mit Standort + Firmenname gefunden.",
      },
      { status: 200 },
    );
  }

  // 2) AE-Query in Chunks, beide Modi, beide Konten – Treffer mergen.
  const allDomains = Array.from(lookupByDomain.keys());
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
  const runSources = sourcesToRun(env, sources);

  /** domain → iso2 → count */
  const byDomain = new Map<string, Map<string, number>>();
  const queryWarnings: string[] = [];

  for (let i = 0; i < allDomains.length; i += MAX_DOMAINS_PER_QUERY) {
    const chunk = allDomains.slice(i, i + MAX_DOMAINS_PER_QUERY);
    for (const s of runSources) {
      const fromTable = fromKeyAnalyticsForBinding(env, s.binding);
      for (const mode of modes) {
        const sql = buildDomainCountrySql(
          from,
          to,
          fromTable,
          mode,
          name,
          chunk,
        );
        try {
          const r = await runAeSql<DomainCountryRow>(env, sql, {
            binding: s.binding,
          });
          for (const row of r.data) {
            const rec = row as Record<string, unknown>;
            const d =
              (typeof rec.d === "string" && rec.d) ||
              (typeof rec.D === "string" && rec.D) ||
              "";
            const iso2Raw =
              (typeof rec.iso2 === "string" && rec.iso2) ||
              (typeof rec.ISO2 === "string" && rec.ISO2) ||
              "";
            const iso2 = String(iso2Raw).toUpperCase().trim();
            if (!/^[A-Z]{2}$/.test(iso2)) continue;
            const dKey = String(d).toLowerCase().trim();
            if (!dKey) continue;
            const inner = byDomain.get(dKey) ?? new Map<string, number>();
            inner.set(iso2, (inner.get(iso2) ?? 0) + aeNumber(row.c));
            byDomain.set(dKey, inner);
          }
        } catch (e) {
          queryWarnings.push(
            `${s.binding}/${mode} (chunk ${Math.floor(i / MAX_DOMAINS_PER_QUERY) + 1}): ${
              (e as Error).message || String(e)
            }`,
          );
        }
      }
    }
  }

  // 3) Pro Kunde mergen — Treffer aller Kandidaten-Domains zusammenfassen.
  const out: {
    id: string;
    email: string;
    company: string;
    standort: string;
    domain: string;
    domainsMatched: string[];
    viewers: Record<string, number>;
    viewersTotal: number;
    viewersCountryCount: number;
    viewerMax: number;
  }[] = [];

  for (const cand of candidates) {
    const merged = new Map<string, number>();
    const matchedDomains: string[] = [];
    for (const d of cand.domains) {
      const inner = byDomain.get(d.toLowerCase());
      if (!inner) continue;
      matchedDomains.push(d);
      for (const [k, v] of inner) {
        merged.set(k, (merged.get(k) ?? 0) + v);
      }
    }
    if (merged.size === 0) continue;
    const viewers: Record<string, number> = {};
    let total = 0;
    let max = 0;
    for (const [k, v] of merged) {
      viewers[k] = v;
      total += v;
      if (v > max) max = v;
    }
    out.push({
      id: cand.customer.id,
      email: cand.customer.email,
      company: cand.customer.company ?? "",
      standort: cand.customer.standort ?? "",
      domain: matchedDomains[0] ?? cand.domains[0],
      domainsMatched: matchedDomains,
      viewers,
      viewersTotal: total,
      viewersCountryCount: Object.keys(viewers).length,
      viewerMax: max,
    });
  }

  out.sort((a, b) => b.viewersTotal - a.viewersTotal);

  return jsonResponse(
    {
      from,
      to,
      days,
      modesTried: modes,
      customers: out,
      stats: {
        crmCustomers: customerRows.length,
        candidatesWithDomain: candidates.length,
        domainsQueried: allDomains.length,
        matchedCustomers: out.length,
      },
      ...(queryWarnings.length > 0 && {
        queryWarnings: queryWarnings.slice(0, 8),
      }),
    },
    { status: 200 },
  );
};
