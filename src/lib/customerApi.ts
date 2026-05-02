import { useCallback, useEffect, useRef, useState } from "react";

export type Range = {
  from: string;
  to: string;
  /** Bezeichner damit Tabs/Buttons als „aktiv“ markiert werden können. */
  preset: "1h" | "24h" | "7d" | "30d" | "90d" | "custom";
};

export const PRESETS: { id: Range["preset"]; label: string; ms: number }[] = [
  { id: "1h", label: "1 Stunde", ms: 60 * 60 * 1000 },
  { id: "24h", label: "24 Stunden", ms: 24 * 60 * 60 * 1000 },
  { id: "7d", label: "7 Tage", ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "30d", label: "30 Tage", ms: 30 * 24 * 60 * 60 * 1000 },
  { id: "90d", label: "90 Tage", ms: 90 * 24 * 60 * 60 * 1000 },
];

export function rangeFromPreset(id: Range["preset"]): Range {
  if (id === "custom") {
    const t = new Date();
    return {
      from: toAeTimestamp(new Date(t.getTime() - 7 * 24 * 60 * 60 * 1000)),
      to: toAeTimestamp(new Date(t.getTime() + 60_000)),
      preset: "custom",
    };
  }
  const p = PRESETS.find((p) => p.id === id) ?? PRESETS[2];
  const now = new Date();
  return {
    from: toAeTimestamp(new Date(now.getTime() - p.ms)),
    to: toAeTimestamp(new Date(now.getTime() + 60_000)),
    preset: id,
  };
}

/** Heute (UTC): Tagesanfang … jetzt (+1 min Puffer für `to`). */
export function rangeTodayUtc(): Range {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0),
  );
  return {
    from: toAeTimestamp(start),
    to: toAeTimestamp(new Date(now.getTime() + 60_000)),
    preset: "custom",
  };
}

/** Laufender Kalendermonat (UTC, ab Monatsanfang). */
export function rangeCurrentMonthUtc(): Range {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0),
  );
  return {
    from: toAeTimestamp(start),
    to: toAeTimestamp(new Date(now.getTime() + 60_000)),
    preset: "custom",
  };
}

/** YYYY-MM-DD HH:MM:SS in UTC, vom Backend als toDateTime() akzeptiert. */
export function toAeTimestamp(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export function aeTimestampToDate(s: string): Date {
  return new Date(s.replace(" ", "T") + "Z");
}

export function fmtNumber(
  n: number | null | undefined,
  opts: Intl.NumberFormatOptions = {},
): string {
  if (n == null || Number.isNaN(n)) return "–";
  return new Intl.NumberFormat("de-DE", opts).format(n);
}

export function fmtCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "–";
  return new Intl.NumberFormat("de-DE", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "–";
  try {
    const d = aeTimestampToDate(s);
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return s;
  }
}

export function fmtRelative(s: string | null | undefined): string {
  if (!s) return "–";
  try {
    const d = aeTimestampToDate(s);
    const diff = Date.now() - d.getTime();
    const sec = Math.round(diff / 1000);
    if (sec < 60) return `vor ${sec} s`;
    const min = Math.round(sec / 60);
    if (min < 60) return `vor ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `vor ${h} h`;
    const days = Math.round(h / 24);
    return `vor ${days} T`;
  } catch {
    return s;
  }
}

/** Klassifiziert HTTP-Status für Farbgebung. */
export function statusClass(code: number): "ok" | "warn" | "err" {
  if (code < 300) return "ok";
  if (code < 500) return "warn";
  return "err";
}

/** Parsed einen Pfad wie "/api/Audi/A8/2014/Basis/base/front_left". */
export function parsePath(path: string | null | undefined): {
  brand?: string;
  model?: string;
  year?: string;
  variant?: string;
  trim?: string;
  view?: string;
} {
  if (!path) return {};
  const parts = path.replace(/^\/+/, "").split("/");
  // parts[0] === "api"
  const [, brand, model, year, variant, trim, view] = parts;
  return { brand, model, year, variant, trim, view };
}

// ---------- Fetch-Hook ----------

type FetchState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
};

type UseApiOptions = {
  /**
   * Wenn `> 0`, refetcht der Hook im angegebenen Millisekunden-Intervall
   * **flicker-frei** (kein `loading`-Flackern, kein Daten-Reset bei Fehler).
   * Auf `0` oder `undefined` gesetzt: deaktiviert.
   */
  pollMs?: number;
};

/**
 * Generischer GET-Hook gegen `/api/...`. Re-fetched wenn sich `url`
 * (vollständige Querystring-URL) ändert. Optional silent Live-Polling
 * über `options.pollMs`.
 */
export function useApi<T>(
  url: string | null,
  options: UseApiOptions = {},
): FetchState<T> {
  const { pollMs = 0 } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const mainAborter = useRef<AbortController | null>(null);
  const pollAborter = useRef<AbortController | null>(null);

  const runFetch = useCallback(
    (currentUrl: string, silent: boolean): AbortController => {
      const ac = new AbortController();
      if (silent) {
        pollAborter.current?.abort();
        pollAborter.current = ac;
      } else {
        mainAborter.current?.abort();
        pollAborter.current?.abort();
        mainAborter.current = ac;
        setLoading(true);
        setError(null);
      }

      fetch(currentUrl, { credentials: "include", signal: ac.signal })
        .then(async (res) => {
          const json = (await res.json().catch(() => ({}))) as Partial<{
            error: string;
            hint: string;
            status: number;
            cfRay: string;
          }> &
            T;
          if (!res.ok) {
            const parts: string[] = [];
            parts.push(json.error || `HTTP ${res.status}`);
            if (json.hint) parts.push(`Hinweis: ${json.hint}`);
            if (json.cfRay) parts.push(`CF-Ray: ${json.cfRay}`);
            throw new Error(parts.join(" • "));
          }
          setData(json as T);
          if (silent) setError(null);
        })
        .catch((err) => {
          if (ac.signal.aborted) return;
          if (silent) {
            // Silent-Polling-Fehler nicht aggressiv anzeigen,
            // bestehende Daten behalten.
            return;
          }
          setError(err instanceof Error ? err.message : String(err));
          setData(null);
        })
        .finally(() => {
          if (ac.signal.aborted) return;
          if (!silent) setLoading(false);
        });

      return ac;
    },
    [],
  );

  useEffect(() => {
    if (!url) {
      mainAborter.current?.abort();
      pollAborter.current?.abort();
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    const ac = runFetch(url, false);
    return () => ac.abort();
  }, [url, tick, runFetch]);

  useEffect(() => {
    if (!url || pollMs <= 0) return;
    const id = window.setInterval(() => {
      runFetch(url, true);
    }, pollMs);
    return () => {
      window.clearInterval(id);
      pollAborter.current?.abort();
    };
  }, [url, pollMs, runFetch]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

// ---------- Response-Typen ----------

export interface OverviewRow {
  requests: number;
  uniqueKeys: number;
  okRequests: number;
  errRequests: number;
  /** Echte Bild-Aufrufe (blob5 ist ein View-Name, kein list_X/check_views). */
  viewRequests: number;
  /** Erfolgreiche Bild-Aufrufe (200/300). */
  viewOkRequests: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface TimeseriesPoint {
  bucket: string;
  requests: number;
  ok: number;
  err: number;
  keys: number;
}

export interface TopKey {
  keyId: string;
  requests: number;
  ok: number;
  err: number;
  brands: number;
  lastSeen: string;
}

export interface TopBrand {
  brand: string;
  requests: number;
}
export interface TopModel {
  brand: string;
  model: string;
  requests: number;
}
export interface TopAction {
  action: string;
  requests: number;
}
export interface TopPath {
  path: string;
  requests: number;
}
export interface TopView {
  view: string;
  requests: number;
  ok: number;
  err: number;
  keys: number;
}
export interface StatusCount {
  status: number;
  requests: number;
}

export interface RecentRow {
  timestamp: string;
  keyId: string;
  path: string;
  brand: string;
  model: string;
  action: string;
  statusText: string;
  status: number;
  sampleInterval: number;
}

export interface KeyDetailResponse {
  row: OverviewRow;
  timeseries: TimeseriesPoint[];
  bucket: "minute" | "hour" | "day";
  topBrands: TopBrand[];
  topActions: TopAction[];
  topPaths: TopPath[];
  topViews: TopView[];
  recent: RecentRow[];
}

// ---------- URL-Builder ----------

export type AnalyticsMode = "customers" | "oneauto";

function build(
  kind: string,
  range: Range,
  mode: AnalyticsMode,
  extra: Record<string, string> = {},
) {
  const qs = new URLSearchParams({
    kind,
    mode,
    from: range.from,
    to: range.to,
    ...extra,
  });
  return `/api/analytics/customer-keys?${qs.toString()}`;
}

/**
 * Kunden- vs. Oneauto-Mode. (Backend führt key_analytics + ggf. api_analytics
 * automatisch zusammen.)
 */
export function makeApiUrls(mode: AnalyticsMode) {
  return {
    overview: (r: Range) => build("overview", r, mode),
    timeseries: (r: Range) => build("timeseries", r, mode),
    topKeys: (r: Range, limit = 20) =>
      build("top-keys", r, mode, { limit: String(limit) }),
    topBrands: (r: Range, limit = 8) =>
      build("top-brands", r, mode, { limit: String(limit) }),
    topModels: (r: Range, limit = 8) =>
      build("top-models", r, mode, { limit: String(limit) }),
    topActions: (r: Range, limit = 8) =>
      build("top-actions", r, mode, { limit: String(limit) }),
    topPaths: (r: Range, limit = 10) =>
      build("top-paths", r, mode, { limit: String(limit) }),
    topViews: (r: Range, limit = 12) =>
      build("top-views", r, mode, { limit: String(limit) }),
    statusCodes: (r: Range, limit = 10) =>
      build("status-codes", r, mode, { limit: String(limit) }),
    recent: (r: Range, limit = 100) =>
      build("recent", r, mode, { limit: String(limit) }),
    keyDetail: (r: Range, key: string) =>
      build("key-detail", r, mode, { key }),
  };
}

export const apiUrls = makeApiUrls("customers");

// ---------- Oneauto-Reports ----------

export interface OneautoMonthRow {
  month: string; // YYYY-MM-01
  fromIso: string;
  toIso: string;
  closed: boolean;
  requests: number;
  views: number;
  viewsOk: number;
  viewsErr: number;
  gbp: number;
  eur: number | null;
  fx: {
    rate: number | null;
    date: string;
    source: "frankfurter" | "fallback";
    error: string | null;
  };
}

export interface OneautoReportsResponse {
  pricePerViewGbp: number;
  /** Erster / primärer Oneauto-Key (Rückwärtskompatibilität). */
  key: string;
  /** Alle API-Key-Hashes, deren Events einfließen (Konto 1 + 2). */
  keys?: string[];
  /** `index1` beginnt damit; SQL filtert per Präfix, nicht nur einzelne Keys. */
  oneautoKeyPrefix?: string;
  mergedSources?: string[];
  months: OneautoMonthRow[];
  totals: { views: number; gbp: number; eur: number | null };
  generatedAt: string;
}

export function reportsUrl(months = 12): string {
  return `/api/analytics/oneauto-reports?months=${months}`;
}

export function fmtMonthLong(s: string): string {
  try {
    const d = new Date(s.length === 10 ? s + "T00:00:00Z" : s);
    return new Intl.DateTimeFormat("de-DE", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return s;
  }
}

export function fmtCurrency(
  n: number | null,
  currency: "GBP" | "EUR",
): string {
  if (n == null || Number.isNaN(n)) return "–";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}
