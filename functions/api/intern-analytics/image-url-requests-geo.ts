/**
 * GET /api/intern-analytics/image-url-requests-geo
 *
 * Analytics Engine: Stream `image_url_requests` (oder dedizierte Tabelle gleichen Namens).
 * Länder: `blob3` (ISO-2, z. B. GB). Domains: `index1` (Kunden-Hosts).
 * Zählung: SUM(_sample_interval) wie in den anderen AE-Auswertungen.
 *
 * Query: from, to (YYYY-MM-DD HH:MM:SS, UTC), `days` (1–400),
 * `diagnose=1` (Volumen pro Quelle/Modus + tatsächliche `dataset`-Werte).
 *
 * Hinweis: die Analytics-Engine-SQL-API unterstützt hier kein `TRIM()` /
 * `UPPER()` um Spalten (422). Nackte `blob3`-Vergleiche + `GROUP BY blob3`;
 * Normalisierung in `mergeByIso2()`.
 *
 * Wichtig: probiert *immer* beide Modi (`filter` über `key_analytics` /
 * `api_analytics` mit `AND dataset=…` UND `dedicated` aus eigener Tabelle).
 * So ist es egal, wie der Writer schreibt – sobald die Tabelle/das dataset
 * existiert, kommen Daten an. Treffer aus mehreren Modi werden gemerged.
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
const MAX_DOMAINS = 500;
const MAX_DAYS = 400;
const MAX_DATASETS = 50;

type CountryRow = { iso2: string; c: number };
type DomainRow = { d: string; c: number };
type VolumeRow = { c: number };
type DatasetRow = { dataset: string; c: number };
type Mode = "filter" | "dedicated";

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

/**
 * Wenn leer: beide Konto-Quellen (primary + secondary), sonst nur eines.
 * So werden Daten abgeglichen mit customer-keys/oneauto (Merge über Konten).
 */
function sourcesToRun(
  env: AuthEnv,
  all: AnalyticsSource[],
): { list: AnalyticsSource[]; label: "all" | "primary" | "secondary" } {
  const r = env.IMAGE_URL_AE_ACCOUNT?.trim().toLowerCase();
  if (r === "secondary") {
    const list = all.filter((s) => s.binding === "secondary");
    return { list: list.length ? list : all, label: "secondary" };
  }
  if (r === "primary") {
    const list = all.filter((s) => s.binding === "primary");
    return { list: list.length ? list : all, label: "primary" };
  }
  return { list: all, label: "all" };
}

/** Filter-Mode: tatsächliche Hosttabelle (key_analytics vs api_analytics). */
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

function buildCountrySql(
  fromIso: string,
  toIso: string,
  fromDataset: string,
  mode: Mode,
  name: string,
): string {
  const tw = buildTimeWhere(fromIso, toIso);
  if (mode === "dedicated") {
    return `SELECT
  blob3 AS iso2,
  SUM(_sample_interval) AS c
FROM ${name}
WHERE ${tw}
  AND blob3 != ${sqlString("")}
  AND blob3 != ${sqlString("NA")}
GROUP BY blob3
FORMAT JSON`;
  }
  return `SELECT
  blob3 AS iso2,
  SUM(_sample_interval) AS c
FROM ${fromDataset}
WHERE ${tw} AND dataset = ${sqlString(name)}
  AND blob3 != ${sqlString("")}
  AND blob3 != ${sqlString("NA")}
GROUP BY blob3
FORMAT JSON`;
}

function buildDomainSql(
  fromIso: string,
  toIso: string,
  fromDataset: string,
  mode: Mode,
  name: string,
): string {
  const tw = buildTimeWhere(fromIso, toIso);
  const notEmpty = `index1 != ${sqlString("")} AND index1 != ${sqlString(
    "NA",
  )}`;
  if (mode === "dedicated") {
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

/** Volumen im Zeitraum (Diagnose) – ohne Gruppierung. */
function buildVolumeSql(
  fromIso: string,
  toIso: string,
  fromDataset: string,
  mode: Mode,
  name: string,
): string {
  const tw = buildTimeWhere(fromIso, toIso);
  if (mode === "dedicated") {
    return `SELECT SUM(_sample_interval) AS c
FROM ${name}
WHERE ${tw}
FORMAT JSON`;
  }
  return `SELECT SUM(_sample_interval) AS c
FROM ${fromDataset}
WHERE ${tw} AND dataset = ${sqlString(name)}
FORMAT JSON`;
}

/** Diagnose: tatsächliche `dataset`-Werte in einer Filter-Tabelle. */
function buildDatasetListSql(
  fromIso: string,
  toIso: string,
  fromDataset: string,
): string {
  const tw = buildTimeWhere(fromIso, toIso);
  return `SELECT dataset, SUM(_sample_interval) AS c
FROM ${fromDataset}
WHERE ${tw}
GROUP BY dataset
ORDER BY c DESC
LIMIT ${MAX_DATASETS}
FORMAT JSON`;
}

const SAMPLE_REJECTED_MAX = 12;

function mergeByIso2(parts: CountryRow[][]): {
  byIso2: Record<string, number>;
  max: number;
  total: number;
  countryCount: number;
  countryGroupsRejected: number;
  sampleRejectedBlob3: string[];
} {
  const byIso2: Record<string, number> = {};
  const sampleRejectedBlob3: string[] = [];
  const seen = new Set<string>();
  let countryGroupsRejected = 0;
  for (const part of parts) {
    for (const r of part) {
      const rec = r as { iso2?: string; c?: number } & Record<string, unknown>;
      const raw =
        (typeof rec.iso2 === "string" && rec.iso2) ||
        (typeof rec.ISO2 === "string" && rec.ISO2) ||
        "";
      const k = String(raw).toUpperCase().trim();
      if (!/^[A-Z]{2}$/.test(k)) {
        countryGroupsRejected += 1;
        if (sampleRejectedBlob3.length < SAMPLE_REJECTED_MAX) {
          const s = String(raw).slice(0, 64);
          if (s && !seen.has(s)) {
            seen.add(s);
            sampleRejectedBlob3.push(s);
          }
        }
        continue;
      }
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
    countryGroupsRejected,
    sampleRejectedBlob3,
  };
}

function mergeDomains(parts: DomainRow[][]): {
  domains: { domain: string; count: number }[];
} {
  const m = new Map<string, { display: string; n: number }>();
  for (const part of parts) {
    for (const r of part) {
      const rec = r as { d?: string } & Record<string, unknown>;
      const raw = String(
        (typeof rec.d === "string" && rec.d) ||
          (typeof rec.D === "string" && rec.D) ||
          "",
      ).trim();
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

type SourceModeMeta = {
  binding: AeAccountBinding;
  mode: Mode;
  fromTable: string;
  countryGroupRows: number;
  domainGroupRows: number;
  volumeInRange?: number;
  datasetsTopFiltered?: { dataset: string; count: number }[];
  errors?: string[];
};

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
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
  const wantDiagnose = url.searchParams.get("diagnose") === "1";

  /**
   * `IMAGE_URL_REQUESTS_DEDICATED` steuert Modus, aber wir probieren default
   * IMMER beide Modi (filter + dedicated). Per Env kann man einen davon
   * explizit deaktivieren – sinnvoll, falls die dedizierte Tabelle nicht
   * existiert und sonst 400er werfen würde.
   */
  const dedicatedEnv = env.IMAGE_URL_REQUESTS_DEDICATED?.trim().toLowerCase();
  const tryFilter = !envFlag(env.IMAGE_URL_REQUESTS_FILTER_DISABLE);
  const tryDedicated = !envFlagFalse(dedicatedEnv);

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

  const { list: runSources, label: accountLabel } = sourcesToRun(env, sources);

  const countryRows: CountryRow[][] = [];
  const domainRows: DomainRow[][] = [];
  const errors: string[] = [];
  let hadAnyOk = false;
  const perSourceMeta: SourceModeMeta[] = [];

  const modes: Mode[] = [];
  if (tryFilter) modes.push("filter");
  if (tryDedicated) modes.push("dedicated");

  for (const s of runSources) {
    const fromTable = fromKeyAnalyticsForBinding(env, s.binding);
    for (const mode of modes) {
      const localErrors: string[] = [];
      let cLen = 0;
      let dLen = 0;
      let vol: number | undefined;
      let datasetsTopFiltered: { dataset: string; count: number }[] | undefined;

      const csql = buildCountrySql(from, to, fromTable, mode, name);
      const dsql = buildDomainSql(from, to, fromTable, mode, name);
      try {
        const c = await runAeSql<CountryRow>(env, csql, {
          binding: s.binding,
        });
        countryRows.push(c.data);
        cLen = c.data.length;
        if (cLen > 0) hadAnyOk = true;
      } catch (e) {
        countryRows.push([]);
        const msg = (e as Error).message || String(e);
        localErrors.push(`country ${s.binding}/${mode}: ${msg}`);
      }
      try {
        const d = await runAeSql<DomainRow>(env, dsql, { binding: s.binding });
        domainRows.push(d.data);
        dLen = d.data.length;
        if (dLen > 0) hadAnyOk = true;
      } catch (e) {
        domainRows.push([]);
        const msg = (e as Error).message || String(e);
        localErrors.push(`domain ${s.binding}/${mode}: ${msg}`);
      }

      if (wantDiagnose) {
        const volSql = buildVolumeSql(from, to, fromTable, mode, name);
        try {
          const vr = await runAeSql<VolumeRow>(env, volSql, {
            binding: s.binding,
          });
          const row = vr.data[0] as VolumeRow | undefined;
          vol = row ? aeNumber(row.c) : 0;
        } catch (e) {
          localErrors.push(
            `volumen ${s.binding}/${mode}: ${(e as Error).message || String(e)}`,
          );
        }
        if (mode === "filter") {
          try {
            const ds = await runAeSql<DatasetRow>(
              env,
              buildDatasetListSql(from, to, fromTable),
              { binding: s.binding },
            );
            datasetsTopFiltered = ds.data
              .map((r) => {
                const rec = r as Record<string, unknown>;
                const ds =
                  (typeof rec.dataset === "string" && rec.dataset) ||
                  (typeof rec.DATASET === "string" && rec.DATASET) ||
                  "";
                return { dataset: String(ds), count: aeNumber(r.c) };
              })
              .filter((r) => r.dataset !== "");
          } catch (e) {
            localErrors.push(
              `datasets ${s.binding}: ${(e as Error).message || String(e)}`,
            );
          }
        }
      }

      perSourceMeta.push({
        binding: s.binding,
        mode,
        fromTable: mode === "dedicated" ? name : fromTable,
        countryGroupRows: cLen,
        domainGroupRows: dLen,
        ...(wantDiagnose && {
          volumeInRange: vol,
          ...(datasetsTopFiltered && { datasetsTopFiltered }),
        }),
        ...(localErrors.length > 0 && { errors: localErrors }),
      });
      errors.push(...localErrors);
    }
  }

  const merged = mergeByIso2(
    countryRows.length > 0 ? countryRows : [[] as CountryRow[]],
  );
  const { domains } = mergeDomains(
    domainRows.length > 0 ? domainRows : [[] as DomainRow[]],
  );

  const countryGroupsTotal = countryRows.reduce((a, p) => a + p.length, 0);
  const domainGroupsTotal = domainRows.reduce((a, p) => a + p.length, 0);

  // Wenn ALLE Versuche 0 Daten ergeben + ALLE warfen Fehler → 502.
  if (!hadAnyOk && perSourceMeta.every((m) => (m.errors?.length ?? 0) > 0)) {
    return jsonResponse(
      {
        error: "image_url_requests: Analytics Engine Abfrage fehlgeschlagen",
        details: errors.slice(0, 4),
        hint:
          "Beide Modi (filter + dedicated) lieferten Fehler. Mit `?diagnose=1` zeigt die API die tatsächlich vorhandenen `dataset`-Werte und das Volumen.",
        stats: { perSource: perSourceMeta },
      },
      { status: 502 },
    );
  }

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
        mode: "auto" as const,
        modesTried: modes,
        accounts: accountLabel,
        days,
      },
      stats: {
        perSource: perSourceMeta,
        countryGroupsTotal,
        domainGroupsTotal,
        countryGroupsRejected: merged.countryGroupsRejected,
        sampleRejectedBlob3: merged.sampleRejectedBlob3,
        ...(!wantDiagnose
          ? {
              hint:
                "Zusatz: `?diagnose=1` — listet pro Quelle das Volumen und die tatsächlichen `dataset`-Werte (Filter-Mode).",
            }
          : {}),
      },
      queryWarnings: errors.length > 0 ? errors : undefined,
    },
    { status: 200 },
  );
};
