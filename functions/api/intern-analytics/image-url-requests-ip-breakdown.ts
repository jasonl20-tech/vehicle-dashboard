/**
 * GET /api/intern-analytics/image-url-requests-ip-breakdown
 *
 * Aggregiert Bild-URL-Requests aus Analytics Engine `image_url_requests` nach
 * Client-IP und Land (`blob3` = ISO-2), analog zu `image-url-requests-geo`.
 * Die Client-IP liegt im Bildaustrahlungs-Worker in `blob4` (Standard). Per Env
 * `IMAGE_URL_REQUESTS_IP_BLOB` umschaltbar: `blob1` | `blob2` | `blob4`.
 *
 * Query: `days` (1–400), optional `from` / `to` (wie Geo-Endpoint).
 *
 * Response: sortierte Liste mit IP, ISO-2, Zählung, Klassifikation v4/v6,
 * optional: mittlere Antwortzeit `avgMs` (Spalte `double2` in `image_url_requests`,
 * in ms pro Bildaufruf), letzte gesehene Werte: `userAgent` (`blob5` / User-Agent-String
 * in eurer Engine), `edgeCode` (`blob9` / Edge-PoP z. B. LHR), `imagePath` (`argMax` aus `blob1`).
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
const MAX_IP_SQL_ROWS = 8000;

type Mode = "filter" | "dedicated";

type RawIpRow = {
  ip?: string;
  iso2?: string;
  c?: number;
  /** Gewichteter Mittelwert `double2` (ms) im Bucket */
  avgMs?: number | null;
  ua?: string;
  edge?: string;
  imagePath?: string;
};

function parseOptFloat(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

type MergedIp = {
  ip: string;
  iso2: string;
  c: number;
  /** Summe(avgPart * cPart) für gewichtete Gesamt-avgMs */
  msNum: number;
  msDen: number;
  userAgent: string;
  edgeCode: string;
  imagePath: string;
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

type IpBlobCol = "blob1" | "blob2" | "blob4";

function getIpBlobColumn(env: AuthEnv): IpBlobCol {
  const v = (env.IMAGE_URL_REQUESTS_IP_BLOB ?? "blob4").trim().toLowerCase();
  if (v === "blob1" || v === "blob2" || v === "blob4") return v;
  return "blob4";
}

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
 * Wie bisher: nur Zählung (immer kompatibel mit Analytics Engine).
 * Dient als Fallback, falls die reichere Abfrage scheitert.
 */
function buildIpSqlSimple(
  fromIso: string,
  toIso: string,
  fromDataset: string,
  mode: Mode,
  name: string,
  ipCol: IpBlobCol,
): string {
  const tw = buildTimeWhere(fromIso, toIso);
  const blob3NotEmpty = `blob3 != ${sqlString("")} AND blob3 != ${sqlString(
    "NA",
  )}`;
  const colNotEmpty = `${ipCol} != ${sqlString("")}`;
  const core = `SELECT
  ${ipCol} AS ip,
  blob3 AS iso2,
  SUM(_sample_interval) AS c
`;
  if (mode === "dedicated") {
    return `${core}FROM ${name}
WHERE ${tw}
  AND ${colNotEmpty}
  AND ${blob3NotEmpty}
GROUP BY ${ipCol}, blob3
ORDER BY c DESC
LIMIT ${MAX_IP_SQL_ROWS}
FORMAT JSON`;
  }
  return `${core}FROM ${fromDataset}
WHERE ${tw} AND dataset = ${sqlString(name)}
  AND ${colNotEmpty}
  AND ${blob3NotEmpty}
GROUP BY ${ipCol}, blob3
ORDER BY c DESC
LIMIT ${MAX_IP_SQL_ROWS}
FORMAT JSON`;
}

/**
 * `double2` = Antwortzeit ms; `blob5` = UA; `blob9` = Edge; `blob1` = Pfad.
 * Nur `sum`/`if`/`any` — wie in `customer-keys` (kein `argMax`/`sumIf`, die in AE
 * fehlen oder anders heißen).
 */
function buildIpSqlEnriched(
  fromIso: string,
  toIso: string,
  fromDataset: string,
  mode: Mode,
  name: string,
  ipCol: IpBlobCol,
): string {
  const tw = buildTimeWhere(fromIso, toIso);
  const blob3NotEmpty = `blob3 != ${sqlString("")} AND blob3 != ${sqlString(
    "NA",
  )}`;
  const colNotEmpty = `${ipCol} != ${sqlString("")}`;
  const dOk = "double2 > 0 AND double2 < 1000000";
  const agg = `SELECT
  ${ipCol} AS ip,
  blob3 AS iso2,
  SUM(_sample_interval) AS c,
  sumIf(double2 * _sample_interval, ${dOk}) / nullIf(sumIf(_sample_interval, ${dOk}), 0) AS avgMs,
  argMax(blob5, timestamp) AS ua,
  argMax(blob9, timestamp) AS edge,
  argMax(blob1, timestamp) AS imagePath`;
  if (mode === "dedicated") {
    return `${agg}
FROM ${name}
WHERE ${tw}
  AND ${colNotEmpty}
  AND ${blob3NotEmpty}
GROUP BY ${ipCol}, blob3
ORDER BY c DESC
LIMIT ${MAX_IP_SQL_ROWS}
FORMAT JSON`;
  }
  return `${agg}
FROM ${fromDataset}
WHERE ${tw} AND dataset = ${sqlString(name)}
  AND ${colNotEmpty}
  AND ${blob3NotEmpty}
GROUP BY ${ipCol}, blob3
ORDER BY c DESC
LIMIT ${MAX_IP_SQL_ROWS}
FORMAT JSON`;
}

function isIPv4String(s: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(
    s.trim().replaceAll(" ", ""),
  );
  if (!m) return false;
  for (let i = 1; i <= 4; i++) {
    const n = Number(m[i]);
    if (n < 0 || n > 255) return false;
  }
  return true;
}

function isIPv6String(s: string): boolean {
  const t = s.trim().replace(/^\[|\]$/g, "");
  if (!t.includes(":")) return false;
  if (/^[\d.]+$/.test(t)) return false;
  if (!/^[0-9a-fA-F:]+$/.test(t)) return false;
  if (t.split("::").length > 2) return false;
  return true;
}

function classifyIpFamily(
  ip: string,
): "v4" | "v6" | "unknown" {
  if (isIPv4String(ip)) return "v4";
  if (isIPv6String(ip)) return "v6";
  return "unknown";
}

function mergeRows(parts: RawIpRow[][]): Map<string, MergedIp> {
  const m = new Map<string, MergedIp>();
  for (const part of parts) {
    for (const r of part) {
      const rec = r as Record<string, unknown>;
      const rawIp =
        (typeof rec.ip === "string" && rec.ip) ||
        (typeof rec.IP === "string" && rec.IP) ||
        "";
      const rawIso =
        (typeof rec.iso2 === "string" && rec.iso2) ||
        (typeof rec.ISO2 === "string" && rec.ISO2) ||
        "";
      const ip = String(rawIp).trim();
      const iso2 = String(rawIso).toUpperCase().trim();
      if (!ip || !/^[A-Z]{2}$/.test(iso2)) continue;
      const n = aeNumber(r.c);
      if (n <= 0) continue;
      const k = `${ip.toLowerCase()}|${iso2}`;
      const avgMs = parseOptFloat(rec.avgMs);
      const ua = String(rec.ua ?? rec.UA ?? "").trim();
      const edge = String(rec.edge ?? rec.EDGE ?? "").trim();
      const imagePath = String(rec.imagePath ?? rec.imagepath ?? "").trim();
      const cur = m.get(k);
      if (!cur) {
        m.set(k, {
          ip,
          iso2,
          c: n,
          msNum: avgMs != null ? avgMs * n : 0,
          msDen: avgMs != null ? n : 0,
          userAgent: ua,
          edgeCode: edge,
          imagePath,
        });
        continue;
      }
      const prevC = cur.c;
      cur.c += n;
      if (avgMs != null) {
        cur.msNum += avgMs * n;
        cur.msDen += n;
      }
      if (n >= prevC) {
        if (ua) cur.userAgent = ua;
        if (edge) cur.edgeCode = edge;
        if (imagePath) cur.imagePath = imagePath;
      }
    }
  }
  return m;
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
  const daysRaw = Number(url.searchParams.get("days") || DEFAULT_DAYS);
  const days =
    Number.isFinite(daysRaw) && daysRaw > 0
      ? Math.min(MAX_DAYS, Math.max(1, daysRaw))
      : DEFAULT_DAYS;
  const def = defaultRange(days);
  const from = (url.searchParams.get("from") || def.from).trim();
  const to = (url.searchParams.get("to") || def.to).trim();
  const name = getDatasetName(env);
  const ipCol = getIpBlobColumn(env);

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
  const ipRowParts: RawIpRow[][] = [];
  const errors: string[] = [];
  let hadAnyOk = false;

  const modes: Mode[] = [];
  if (tryFilter) modes.push("filter");
  if (tryDedicated) modes.push("dedicated");

  for (const s of runSources) {
    const fromTable = fromKeyAnalyticsForBinding(env, s.binding);
    for (const mode of modes) {
      const tryEnriched = async () => {
        const sql = buildIpSqlEnriched(
          from,
          to,
          fromTable,
          mode,
          name,
          ipCol,
        );
        const r = await runAeSql<RawIpRow>(env, sql, { binding: s.binding });
        ipRowParts.push(r.data);
        if (r.data.length > 0) hadAnyOk = true;
      };
      const trySimple = async () => {
        const sql = buildIpSqlSimple(
          from,
          to,
          fromTable,
          mode,
          name,
          ipCol,
        );
        const r = await runAeSql<RawIpRow>(env, sql, { binding: s.binding });
        ipRowParts.push(r.data);
        if (r.data.length > 0) hadAnyOk = true;
      };
      try {
        await tryEnriched();
      } catch (e1) {
        const msg1 = (e1 as Error).message || String(e1);
        try {
          await trySimple();
          errors.push(
            `ip ${s.binding}/${mode}: Enriched-SQL nicht nutzbar (${msg1.slice(0, 180)}); Fallback simple OK`,
          );
        } catch (e2) {
          ipRowParts.push([]);
          const msg2 = (e2 as Error).message || String(e2);
          errors.push(`ip ${s.binding}/${mode}: ${msg1} | Fallback: ${msg2}`);
        }
      }
    }
  }

  const merged = mergeRows(ipRowParts.length > 0 ? ipRowParts : [[]]);
  const rows: {
    ip: string;
    iso2: string;
    count: number;
    family: "v4" | "v6" | "unknown";
    avgMs: number | null;
    userAgent: string;
    edgeCode: string;
    imagePath: string;
  }[] = [];
  let totalV4 = 0;
  let totalV6 = 0;
  let totalUnknown = 0;

  for (const row of merged.values()) {
    const { ip, iso2, c, msNum, msDen, userAgent, edgeCode, imagePath } = row;
    const family = classifyIpFamily(ip);
    const avgMs =
      msDen > 0 && Number.isFinite(msNum / msDen) ? msNum / msDen : null;
    rows.push({
      ip,
      iso2,
      count: c,
      family,
      avgMs,
      userAgent,
      edgeCode,
      imagePath,
    });
    if (family === "v4") totalV4 += c;
    else if (family === "v6") totalV6 += c;
    else totalUnknown += c;
  }

  rows.sort((a, b) => b.count - a.count);

  if (!hadAnyOk && errors.length > 0) {
    return jsonResponse(
      {
        error: "image_url_requests (IP): Analytics Engine Abfrage fehlgeschlagen",
        details: errors.slice(0, 4),
        hint: `Gleiche Quelle wie /image-url-requests-geo. Spalte für IP: ${ipCol} (Env IMAGE_URL_REQUESTS_IP_BLOB).`,
        engine: { name, days, ipColumn: ipCol, accounts: accountLabel },
      },
      { status: 502 },
    );
  }

  return jsonResponse(
    {
      range: { from, to },
      days,
      engine: {
        name,
        modesTried: modes,
        accounts: accountLabel,
        ipColumn: ipCol,
      },
      rows,
      totals: {
        v4: totalV4,
        v6: totalV6,
        nonIp: totalUnknown,
        uniqueIpRows: rows.length,
        requests:
          totalV4 + totalV6 + totalUnknown,
      },
      hint:
        totalUnknown > 0 && totalV4 + totalV6 === 0
          ? `Keine erkennbaren IPv4/IPv6-Werte in ${ipCol}. Prüfe ob der Bildaustrahlungs-Worker die Client-IP dort setzt, oder stelle auf die andere Spalte um (IMAGE_URL_REQUESTS_IP_BLOB).`
          : totalUnknown > 0
            ? "Einige Zeilen in der gewählten Spalte sind keine gültigen IPs (z. B. Pfade) — werden als „non-IP“ gezählt."
            : undefined,
      queryWarnings: errors.length > 0 ? errors : undefined,
    },
    { status: 200 },
  );
};
