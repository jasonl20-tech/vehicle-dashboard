/**
 * Auswertung der Analytics-Engine-Tabelle `controll_platform_logs` aus
 * Sicht der **Plattform-User** (`/user-analytics`).
 *
 * Spalten (siehe `controllingPlatformStats.ts`):
 *   index1  – User
 *   blob2   – Action ("modus:button", z. B. "shortcut:correct"; nur ":" = echte Aktion)
 *   blob3   – Modus (Korrektur / Skalierung / Schatten / Transparenz)
 *   blob4   – Image-Key, Form: `version/format/resolution/marke/model/jahr/body/trim/farbe/ansicht.format`
 *   blob5   – IP
 *   blob6   – User-Agent (+ optional ` | {"vehicleId":..., "viewToken":..."}` Suffix)
 *   blob7   – Latenz / Internetgeschwindigkeit in ms
 *   double2 – verbleibende Fahrzeuge im Modus Korrektur
 *   double3 – verbleibende Fahrzeuge im Modus Transparenz
 *   double4 – verbleibende Fahrzeuge im Modus Schatten
 *   double5 – verbleibende Fahrzeuge im Modus Skalierung
 *
 * Sonderregeln (vom Nutzer gesetzt):
 * 1) Double-Werte erst ab `2026-05-02 19:32:50` valide.
 * 2) Die Zeile mit timestamp `2026-05-03 07:36:49` (defekte buggy-row) wird komplett ignoriert.
 * 3) Nur Aktionen mit Prefix `shortcut:` zählen als „echte" User-Aktionen.
 */

import type { AuthEnv } from "./auth";
import {
  aeNumber,
  API_ANALYTICS_DATASET,
  KEY_ANALYTICS_DATASET,
  sqlDateTime,
  sqlString,
  type AeAccountBinding,
  type AeRow,
} from "./analytics";

export const USER_ANALYTICS_DATASET = "controll_platform_logs";
export const USER_ANALYTICS_DEFAULT_GAP_MS = 5 * 60 * 1000;
export const USER_ANALYTICS_MAX_ROWS = 250_000;

/** Erst ab diesem Zeitpunkt liefern double2..double5 valide Werte. */
export const VALID_DOUBLE_FROM_TS = "2026-05-02 19:32:50";
/** Buggy-Row, wird komplett ignoriert. */
export const EXCLUDED_TS = "2026-05-03 07:36:49";
/** Aktions-Prefix in blob2 für echte User-Aktionen. */
export const ACTION_PREFIX = "shortcut:";

function getDataset(env: AuthEnv): string {
  const raw = env.CONTROLLING_AE_DATASET?.trim() || USER_ANALYTICS_DATASET;
  if (!/^[a-zA-Z0-9_]+$/.test(raw)) return USER_ANALYTICS_DATASET;
  return raw;
}

function isDedicatedTableMode(env: AuthEnv): boolean {
  const v = env.CONTROLLING_AE_DEDICATED?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return true;
}

function getBinding(env: AuthEnv): AeAccountBinding {
  return env.CONTROLLING_AE_ACCOUNT?.trim().toLowerCase() === "secondary"
    ? "secondary"
    : "primary";
}

const SELECT_BODY = `SELECT
  timestamp,
  _sample_interval,
  index1,
  blob1,
  blob2,
  blob3,
  blob4,
  blob5,
  blob6,
  blob7,
  double1,
  double2,
  double3,
  double4,
  double5`;

export type UserAnalyticsFetchPlan = {
  sql: string;
  binding: AeAccountBinding;
  fromMode: "dedicated_table" | "key_analytics_filter";
  fromTable: string;
};

export function buildUserAnalyticsFetchPlan(
  env: AuthEnv,
  fromIso: string,
  toIso: string,
  options: { limit: number; user?: string | null; ip?: string | null },
): UserAnalyticsFetchPlan {
  const binding = getBinding(env);
  const dataset = getDataset(env);
  const limit = Math.max(1, Math.min(options.limit, USER_ANALYTICS_MAX_ROWS));

  const filters: string[] = [
    `timestamp >= ${sqlDateTime(fromIso)}`,
    `timestamp < ${sqlDateTime(toIso)}`,
  ];
  if (options.user && options.user.trim()) {
    filters.push(`index1 = ${sqlString(options.user.trim())}`);
  }
  if (options.ip && options.ip.trim()) {
    filters.push(`blob5 = ${sqlString(options.ip.trim())}`);
  }

  if (isDedicatedTableMode(env)) {
    return {
      binding,
      fromMode: "dedicated_table",
      fromTable: dataset,
      sql: `${SELECT_BODY}
FROM ${dataset}
WHERE ${filters.join(" AND ")}
ORDER BY timestamp ASC
LIMIT ${limit}
FORMAT JSON`,
    };
  }

  const fromTable =
    binding === "secondary" ? API_ANALYTICS_DATASET : KEY_ANALYTICS_DATASET;
  return {
    binding,
    fromMode: "key_analytics_filter",
    fromTable,
    sql: `${SELECT_BODY}
FROM ${fromTable}
WHERE ${filters.join(" AND ")} AND dataset = ${sqlString(dataset)}
ORDER BY timestamp ASC
LIMIT ${limit}
FORMAT JSON`,
  };
}

// ---------- Roh-Zeile ----------

export type UserAnalyticsRow = {
  ts: string;
  tsMs: number;
  user: string;
  ip: string;
  ua: string;
  /** Geparster `vehicleId` aus blob6-Suffix, sonst null. */
  vehicleId: number | null;
  /** Geparster `viewToken` aus blob6-Suffix, sonst null. */
  viewToken: string | null;
  blob2: string;
  isAction: boolean;
  actionMode: string; // "shortcut" wenn echte Action
  actionButton: string; // z. B. "regen_vertex"
  mode: string; // blob3
  imageKey: string; // blob4
  vehicle: {
    version: string;
    format: string;
    resolution: string;
    brand: string;
    model: string;
    year: string;
    body: string;
    trim: string;
    color: string;
    view: string;
    fileExt: string;
  } | null;
  /** Latenz/Internetgeschwindigkeit in ms aus blob7. */
  latencyMs: number | null;
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  d5: number;
};

function parseTs(s: string): number {
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 1e12) return n;
    if (n > 1e9) return n * 1000;
  }
  const t = Date.parse(s.replace(" ", "T") + "Z");
  return Number.isFinite(t) ? t : 0;
}

function parseVehicleFromBlob4(key: string): UserAnalyticsRow["vehicle"] {
  if (!key) return null;
  const trimmed = key.trim().replace(/^\/+/, "");
  if (!trimmed) return null;
  const parts = trimmed.split("/");
  // version/format/resolution/marke/model/jahr/body/trim/farbe/ansicht.format
  // 10 Teile erwartet; wir nehmen so viel wie möglich.
  const [version, format, resolution, brand, model, year, body, trim, color, last] =
    [
      parts[0] ?? "",
      parts[1] ?? "",
      parts[2] ?? "",
      parts[3] ?? "",
      parts[4] ?? "",
      parts[5] ?? "",
      parts[6] ?? "",
      parts[7] ?? "",
      parts[8] ?? "",
      parts[9] ?? "",
    ];
  let view = last;
  let fileExt = "";
  if (last) {
    // Anker: "front.png", "front_left.png", "front%23trp.png" usw.
    const decoded = (() => {
      try {
        return decodeURIComponent(last);
      } catch {
        return last;
      }
    })();
    const dot = decoded.lastIndexOf(".");
    if (dot > 0) {
      view = decoded.slice(0, dot);
      fileExt = decoded.slice(dot + 1).toLowerCase();
    } else {
      view = decoded;
    }
    // Hash-Suffixe wie `front#trp` vereinheitlichen.
    const hash = view.indexOf("#");
    if (hash > 0) view = view.slice(0, hash);
  }
  if (!brand && !model && !view) return null;
  return {
    version,
    format,
    resolution,
    brand,
    model,
    year,
    body,
    trim,
    color,
    view: view.toLowerCase(),
    fileExt,
  };
}

function parseUaSuffix(blob6: string): {
  ua: string;
  vehicleId: number | null;
  viewToken: string | null;
} {
  if (!blob6) return { ua: "", vehicleId: null, viewToken: null };
  const sepIdx = blob6.indexOf(" | ");
  if (sepIdx < 0) {
    return { ua: blob6.trim(), vehicleId: null, viewToken: null };
  }
  const ua = blob6.slice(0, sepIdx).trim();
  const tail = blob6.slice(sepIdx + 3).trim();
  let vehicleId: number | null = null;
  let viewToken: string | null = null;
  if (tail.startsWith("{")) {
    try {
      const j = JSON.parse(tail) as Record<string, unknown>;
      const v = j.vehicleId;
      if (typeof v === "number" && Number.isFinite(v)) vehicleId = Math.trunc(v);
      else if (typeof v === "string" && /^\d+$/.test(v.trim()))
        vehicleId = Number(v.trim());
      const w = j.viewToken;
      if (typeof w === "string" && w.trim()) viewToken = w.trim();
    } catch {
      /* ignore */
    }
  }
  return { ua, vehicleId, viewToken };
}

function parseRow(r: AeRow): UserAnalyticsRow | null {
  const tsRaw = r.timestamp;
  const ts =
    tsRaw == null
      ? ""
      : typeof tsRaw === "number" || typeof tsRaw === "bigint"
        ? String(tsRaw)
        : String(tsRaw);
  if (!ts) return null;
  if (ts.startsWith(EXCLUDED_TS)) return null;

  const user = String(r.index1 ?? "").trim();
  if (!user) return null;

  const blob2 = String(r.blob2 ?? "");
  let isAction = false;
  let actionMode = "";
  let actionButton = "";
  if (blob2.startsWith(ACTION_PREFIX)) {
    isAction = true;
    actionMode = ACTION_PREFIX.slice(0, -1);
    actionButton = blob2.slice(ACTION_PREFIX.length).trim();
  } else if (blob2.includes(":")) {
    const idx = blob2.indexOf(":");
    actionMode = blob2.slice(0, idx).trim();
    actionButton = blob2.slice(idx + 1).trim();
  }

  const blob6 = String(r.blob6 ?? "");
  const { ua, vehicleId, viewToken } = parseUaSuffix(blob6);
  const blob7 = String(r.blob7 ?? "").trim();
  let latencyMs: number | null = null;
  if (blob7) {
    const n = Number(blob7);
    if (Number.isFinite(n) && n >= 0) latencyMs = n;
  }

  return {
    ts,
    tsMs: parseTs(ts),
    user,
    ip: String(r.blob5 ?? "").trim(),
    ua,
    vehicleId,
    viewToken,
    blob2,
    isAction,
    actionMode,
    actionButton,
    mode: String(r.blob3 ?? "").trim(),
    imageKey: String(r.blob4 ?? ""),
    vehicle: parseVehicleFromBlob4(String(r.blob4 ?? "")),
    latencyMs,
    d1: aeNumber(r.double1),
    d2: aeNumber(r.double2),
    d3: aeNumber(r.double3),
    d4: aeNumber(r.double4),
    d5: aeNumber(r.double5),
  };
}

// ---------- Sessions ----------

export type AnalyticsSession = {
  start: string;
  end: string;
  events: number;
  actions: number;
  durationSec: number;
  modes: string[];
  ips: string[];
};

function buildSessions(rows: UserAnalyticsRow[], gapMs: number): AnalyticsSession[] {
  if (!rows.length) return [];
  const out: AnalyticsSession[] = [];
  let startIdx = 0;
  const flush = (end: number) => {
    const part = rows.slice(startIdx, end);
    if (!part.length) return;
    const t0 = part[0].tsMs;
    const t1 = part[part.length - 1].tsMs;
    out.push({
      start: part[0].ts,
      end: part[part.length - 1].ts,
      events: part.length,
      actions: part.reduce((s, r) => s + (r.isAction ? 1 : 0), 0),
      durationSec: Math.max(0, (t1 - t0) / 1000),
      modes: [...new Set(part.map((p) => p.mode).filter(Boolean))],
      ips: [...new Set(part.map((p) => p.ip).filter(Boolean))],
    });
  };
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].tsMs - rows[i - 1].tsMs > gapMs) {
      flush(i);
      startIdx = i;
    }
  }
  flush(rows.length);
  return out;
}

function activeTimeSec(sessions: AnalyticsSession[]): number {
  return sessions.reduce((s, x) => s + x.durationSec, 0);
}

// ---------- Aggregations ----------

export type CountEntry<K extends string = "key"> = Record<K, string> & { count: number };

function topCounts(map: Map<string, number>, limit = 10) {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const p = Math.min(1, Math.max(0, q));
  const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
  return sorted[idx];
}

function pickBucketMs(spanMs: number): number {
  if (spanMs <= 6 * 60 * 60 * 1000) return 5 * 60 * 1000;
  if (spanMs <= 36 * 60 * 60 * 1000) return 30 * 60 * 1000;
  if (spanMs <= 8 * 24 * 60 * 60 * 1000) return 60 * 60 * 1000;
  return 6 * 60 * 60 * 1000;
}

function fmtIso(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

// ---------- Detail-Bericht pro User ----------

export type ModeKey = "Korrektur" | "Transparenz" | "Schatten" | "Skalierung" | string;

export type RemainingSnapshot = {
  ts: string;
  open: number;
};

export type ModeRemainingSummary = {
  mode: ModeKey;
  /** Letzter bekannter „verbleibend"-Wert dieses Modus aus den User-Events. */
  latestOpen: number | null;
  latestTs: string | null;
  /** Minimale beobachtete „verbleibend"-Anzahl im Zeitraum. */
  minOpen: number | null;
  /** Maximaler beobachteter Wert. */
  maxOpen: number | null;
  /** Summe der Rückgänge (≈ vom User bearbeitete Fahrzeuge im Zeitraum). */
  processed: number;
  /** Summe der Anstiege (neu dazugekommene Fahrzeuge / Reset). */
  added: number;
  /** /Stunde, normalisiert auf aktive Zeit des Users. */
  processedPerHour: number | null;
};

export type DetailReport = {
  user: string;
  scope: { ip: string | null; aggregate: boolean };
  summary: {
    eventCount: number;
    actionCount: number;
    sessionCount: number;
    totalActiveSec: number;
    avgSessionSec: number;
    longestSessionSec: number;
    firstTs: string | null;
    lastTs: string | null;
    uniqueIps: number;
    uniqueUsers: number;
    uniqueDays: number;
    /** Anzahl Kalendertage im Reportzeitraum (von..bis). */
    rangeDays: number;
    /** Anzahl Sekunden im Reportzeitraum. */
    rangeSpanSec: number;
    eventsPerSec: number | null;
    eventsPerMinute: number | null;
    actionsPerSec: number | null;
    actionsPerMinute: number | null;
    actionsPerActiveHour: number | null;
    eventsPerActiveHour: number | null;
    /** Bearbeitete Fahrzeuge insgesamt im Zeitraum (Summe der Rückgänge in double2..5). */
    processedTotal: number;
    /** Bearbeitete Fahrzeuge pro aktive Stunde des Users (= echte Arbeitsleistung). */
    vehiclesPerActiveHour: number | null;
    /** Bearbeitete Fahrzeuge pro Kalendertag (= 24h-Sicht über den ganzen Zeitraum). */
    vehiclesPerCalendarDay: number | null;
    /** Bearbeitete Fahrzeuge pro Stunde, gemessen über den ganzen 24h-Zeitraum. */
    vehiclesPerCalendarHour: number | null;
  };
  network: {
    samples: number;
    avgMs: number | null;
    minMs: number | null;
    maxMs: number | null;
    p50Ms: number | null;
    p95Ms: number | null;
    p99Ms: number | null;
  };
  perMode: Array<{
    mode: ModeKey;
    events: number;
    actions: number;
    sessions: number;
    activeSec: number;
    actionsPerHour: number | null;
    eventsPerHour: number | null;
  }>;
  remainingByMode: ModeRemainingSummary[];
  topActions: Array<{ button: string; count: number }>;
  topModes: Array<{ mode: string; count: number }>;
  topVehicles: Array<{
    label: string;
    brand: string;
    model: string;
    year: string;
    count: number;
  }>;
  topBrands: Array<{ brand: string; count: number }>;
  topModels: Array<{ brand: string; model: string; count: number }>;
  topViews: Array<{ view: string; count: number }>;
  topUserAgents: Array<{ ua: string; count: number }>;
  perIp: Array<{
    ip: string;
    events: number;
    actions: number;
    firstTs: string | null;
    lastTs: string | null;
    activeSec: number;
    avgLatencyMs: number | null;
  }>;
  perHourOfDay: Array<{ hour: number; events: number; actions: number }>;
  perWeekday: Array<{ weekday: number; events: number; actions: number }>;
  /** Gleichmäßige Buckets für Charts (events / actions / processed). */
  timeline: Array<{
    bucket: string;
    events: number;
    actions: number;
    processed: number;
    avgLatencyMs: number | null;
  }>;
  /** Latenz pro Aktion (Scatter / Verlauf): zeitstempel + ms. */
  latencyPoints: Array<{ ts: string; ms: number }>;
  /** Sessions als Liste. */
  sessions: AnalyticsSession[];
  /** Vehicle×Latenz Aggregation, sortiert nach Anzahl Aktionen. */
  vehicleLatency: Array<{
    label: string;
    actions: number;
    avgLatencyMs: number | null;
    minLatencyMs: number | null;
    maxLatencyMs: number | null;
  }>;
  /** Komplette Fahrzeug-Liste inkl. User-Aufteilung (max 500), für Vehicle-Suche. */
  vehicles: Array<{
    label: string;
    brand: string;
    model: string;
    year: string;
    body: string;
    trim: string;
    color: string;
    events: number;
    actions: number;
    /** Letzte Aktion. */
    lastTs: string | null;
    /** Welche User haben dieses Fahrzeug bearbeitet. */
    users: Array<{ user: string; events: number; actions: number }>;
    /** Welche Ansichten (front, rear, …) wurden zu diesem Fahrzeug aufgerufen. */
    views: Array<{ view: string; count: number }>;
  }>;
};

// ---------- Übersichts-Liste (alle User) ----------

export type UserListEntry = {
  user: string;
  eventCount: number;
  actionCount: number;
  firstTs: string | null;
  lastTs: string | null;
  uniqueIps: number;
  primaryOs: string | null;
  totalActiveSec: number;
  avgLatencyMs: number | null;
  /** Bearbeitete Fahrzeuge im Zeitraum (Summe Rückgänge double2..5 ab valid-from). */
  processedTotal: number;
};

// ---------- Hauptfunktion ----------

export type ProcessedUserAnalytics = {
  range: { from: string; to: string };
  rangeRows: number;
  truncated: boolean;
  sessionGapMinutes: number;
  validDoubleFromTs: string;
  excludedTs: string;
  /** Liste aller im Zeitraum aktiven User. */
  users: UserListEntry[];
  /** Detailbericht (wenn `user`-Filter gesetzt war). */
  detail: DetailReport | null;
};

function computeRemainingByMode(
  rows: UserAnalyticsRow[],
): ModeRemainingSummary[] {
  // Mapping: (double-Spalten-Index, Modus-Bezeichnung)
  const slots: Array<{ key: keyof UserAnalyticsRow; label: ModeKey }> = [
    { key: "d2", label: "Korrektur" },
    { key: "d3", label: "Transparenz" },
    { key: "d4", label: "Schatten" },
    { key: "d5", label: "Skalierung" },
  ];

  const validFromMs = parseTs(VALID_DOUBLE_FROM_TS);
  const out: ModeRemainingSummary[] = [];
  for (const slot of slots) {
    const points: { t: number; v: number }[] = [];
    for (const r of rows) {
      if (r.tsMs < validFromMs) continue;
      const v = r[slot.key] as number;
      if (!Number.isFinite(v) || v < 0) continue;
      points.push({ t: r.tsMs, v });
    }
    if (points.length === 0) {
      out.push({
        mode: slot.label,
        latestOpen: null,
        latestTs: null,
        minOpen: null,
        maxOpen: null,
        processed: 0,
        added: 0,
        processedPerHour: null,
      });
      continue;
    }
    let processed = 0;
    let added = 0;
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const v = points[i].v;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
      if (i > 0) {
        const d = v - points[i - 1].v;
        if (d < 0) processed += -d;
        else if (d > 0) added += d;
      }
    }
    const spanSec = Math.max(
      1,
      (points[points.length - 1].t - points[0].t) / 1000,
    );
    out.push({
      mode: slot.label,
      latestOpen: points[points.length - 1].v,
      latestTs: fmtIso(points[points.length - 1].t),
      minOpen: Number.isFinite(mn) ? mn : null,
      maxOpen: Number.isFinite(mx) ? mx : null,
      processed: Math.round(processed),
      added: Math.round(added),
      processedPerHour: spanSec > 0 ? (processed / spanSec) * 3600 : null,
    });
  }
  return out;
}

export function processUserAnalytics(
  raw: AeRow[],
  options: {
    fromIso: string;
    toIso: string;
    gapMs: number;
    user?: string | null;
    ip?: string | null;
    aggregate?: boolean;
    likelyTruncated?: boolean;
  },
): ProcessedUserAnalytics {
  const allRows = raw
    .map(parseRow)
    .filter((r): r is UserAnalyticsRow => r != null)
    .sort((a, b) => a.tsMs - b.tsMs || a.ts.localeCompare(b.ts));

  // ---- Liste aller User ----
  const userMap = new Map<string, UserAnalyticsRow[]>();
  for (const r of allRows) {
    const arr = userMap.get(r.user);
    if (arr) arr.push(r);
    else userMap.set(r.user, [r]);
  }
  const users: UserListEntry[] = [];
  for (const [user, urows] of userMap) {
    const ipSet = new Set<string>();
    const osCounts = new Map<string, number>();
    let actions = 0;
    let latSum = 0;
    let latN = 0;
    for (const r of urows) {
      if (r.ip) ipSet.add(r.ip);
      if (r.ua) osCounts.set(r.ua, (osCounts.get(r.ua) || 0) + 1);
      if (r.isAction) actions += 1;
      if (r.latencyMs != null) {
        latSum += r.latencyMs;
        latN += 1;
      }
    }
    const sess = buildSessions(urows, options.gapMs);
    const tSec = activeTimeSec(sess);
    const remByMode = computeRemainingByMode(urows);
    const processedTotal = remByMode.reduce((s, m) => s + m.processed, 0);
    users.push({
      user,
      eventCount: urows.length,
      actionCount: actions,
      firstTs: urows[0]?.ts ?? null,
      lastTs: urows[urows.length - 1]?.ts ?? null,
      uniqueIps: ipSet.size,
      primaryOs:
        [...osCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      totalActiveSec: tSec,
      avgLatencyMs: latN > 0 ? latSum / latN : null,
      processedTotal,
    });
  }
  users.sort((a, b) => b.eventCount - a.eventCount || a.user.localeCompare(b.user));

  // ---- Detail (pro User ODER aggregat über alle) ----
  let detail: DetailReport | null = null;
  const wantUser = (options.user || "").trim();
  const aggregate = !!options.aggregate && !wantUser;

  if (wantUser) {
    const urows = (userMap.get(wantUser) ?? []).filter(
      (r) => !options.ip || r.ip === options.ip,
    );
    detail = buildDetail(urows, wantUser, options, false);
  } else if (aggregate) {
    const urows = options.ip
      ? allRows.filter((r) => r.ip === options.ip)
      : allRows;
    detail = buildDetail(urows, "(Alle User)", options, true);
  }

  return {
    range: { from: options.fromIso, to: options.toIso },
    rangeRows: allRows.length,
    truncated: options.likelyTruncated ?? false,
    sessionGapMinutes: options.gapMs / 60_000,
    validDoubleFromTs: VALID_DOUBLE_FROM_TS,
    excludedTs: EXCLUDED_TS,
    users,
    detail,
  };
}

function buildDetail(
  urows: UserAnalyticsRow[],
  user: string,
  options: { fromIso: string; toIso: string; gapMs: number; ip?: string | null },
  aggregate: boolean,
): DetailReport {
  const ipScope = options.ip || null;
  const sessions = buildSessions(urows, options.gapMs);
  const totalActive = activeTimeSec(sessions);
  const avgSession =
    sessions.length > 0 ? totalActive / sessions.length : 0;
  const longest = sessions.reduce((m, s) => Math.max(m, s.durationSec), 0);

  const ipSet = new Set<string>();
  const userSet = new Set<string>();
  const dayKeys = new Set<string>();
  let actionCount = 0;
  const latencies: number[] = [];
  const latencyPoints: Array<{ ts: string; ms: number }> = [];
  const buttonCounts = new Map<string, number>();
  const modeCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  const brandModelCounts = new Map<string, { brand: string; model: string; count: number }>();
  const vehicleCounts = new Map<string, { label: string; brand: string; model: string; year: string; count: number }>();
  const vehicleAll = new Map<
    string,
    {
      label: string;
      brand: string;
      model: string;
      year: string;
      body: string;
      trim: string;
      color: string;
      events: number;
      actions: number;
      lastTs: string | null;
      lastTsMs: number;
      users: Map<string, { events: number; actions: number }>;
      views: Map<string, number>;
    }
  >();
  const viewCounts = new Map<string, number>();
  const uaCounts = new Map<string, number>();
  const perIpMap = new Map<string, {
    rows: UserAnalyticsRow[];
    actions: number;
    latencies: number[];
  }>();
  const hourCounts: Array<{ events: number; actions: number }> = Array.from(
    { length: 24 },
    () => ({ events: 0, actions: 0 }),
  );
  const weekdayCounts: Array<{ events: number; actions: number }> = Array.from(
    { length: 7 },
    () => ({ events: 0, actions: 0 }),
  );

  // Per-Modus-Aggregation (aktive Zeit über Modus-Sessions)
  const perModeRows = new Map<string, UserAnalyticsRow[]>();

  // Vehicle×Latenz
  const vehicleLatency = new Map<string, { label: string; values: number[]; count: number }>();

  for (const r of urows) {
    if (r.ip) ipSet.add(r.ip);
    if (r.user) userSet.add(r.user);
    if (r.ts) dayKeys.add(r.ts.slice(0, 10));
    if (r.isAction) actionCount += 1;

    if (r.actionButton) {
      buttonCounts.set(
        r.actionButton,
        (buttonCounts.get(r.actionButton) || 0) + (r.isAction ? 1 : 0),
      );
    }
    if (r.mode) {
      modeCounts.set(r.mode, (modeCounts.get(r.mode) || 0) + 1);
      const arr = perModeRows.get(r.mode);
      if (arr) arr.push(r);
      else perModeRows.set(r.mode, [r]);
    }

    if (r.vehicle) {
      const v = r.vehicle;
      if (v.brand) brandCounts.set(v.brand, (brandCounts.get(v.brand) || 0) + 1);
      if (v.brand && v.model) {
        const k = `${v.brand}|${v.model}`;
        const cur = brandModelCounts.get(k) || {
          brand: v.brand,
          model: v.model,
          count: 0,
        };
        cur.count += 1;
        brandModelCounts.set(k, cur);
      }
      const vehicleKey = [v.brand, v.model, v.year, v.body, v.trim, v.color]
        .filter(Boolean)
        .join("|");
      if (vehicleKey) {
        const label = [v.brand, v.model, v.year]
          .filter(Boolean)
          .join(" ")
          .trim();
        const cur = vehicleCounts.get(vehicleKey) || {
          label,
          brand: v.brand,
          model: v.model,
          year: v.year,
          count: 0,
        };
        cur.count += 1;
        vehicleCounts.set(vehicleKey, cur);

        const all = vehicleAll.get(vehicleKey) || {
          label,
          brand: v.brand,
          model: v.model,
          year: v.year,
          body: v.body,
          trim: v.trim,
          color: v.color,
          events: 0,
          actions: 0,
          lastTs: null as string | null,
          lastTsMs: 0,
          users: new Map<string, { events: number; actions: number }>(),
          views: new Map<string, number>(),
        };
        all.events += 1;
        if (r.isAction) all.actions += 1;
        if (r.tsMs > all.lastTsMs) {
          all.lastTsMs = r.tsMs;
          all.lastTs = r.ts;
        }
        if (r.user) {
          const u = all.users.get(r.user) || { events: 0, actions: 0 };
          u.events += 1;
          if (r.isAction) u.actions += 1;
          all.users.set(r.user, u);
        }
        if (v.view) all.views.set(v.view, (all.views.get(v.view) || 0) + 1);
        vehicleAll.set(vehicleKey, all);
      }
      if (v.view) viewCounts.set(v.view, (viewCounts.get(v.view) || 0) + 1);
    }

    if (r.ua) uaCounts.set(r.ua, (uaCounts.get(r.ua) || 0) + 1);

    if (r.latencyMs != null) {
      latencies.push(r.latencyMs);
      latencyPoints.push({ ts: r.ts, ms: r.latencyMs });
    }

    if (r.ip) {
      const cur = perIpMap.get(r.ip) || { rows: [], actions: 0, latencies: [] };
      cur.rows.push(r);
      if (r.isAction) cur.actions += 1;
      if (r.latencyMs != null) cur.latencies.push(r.latencyMs);
      perIpMap.set(r.ip, cur);
    }

    // Stunde / Wochentag (UTC, weil Timestamps UTC sind)
    if (r.tsMs) {
      const d = new Date(r.tsMs);
      const h = d.getUTCHours();
      const wd = d.getUTCDay(); // 0=So
      hourCounts[h].events += 1;
      weekdayCounts[wd].events += 1;
      if (r.isAction) {
        hourCounts[h].actions += 1;
        weekdayCounts[wd].actions += 1;
      }
    }

    // Vehicle × Latency
    if (r.vehicle && r.latencyMs != null) {
      const label = [r.vehicle.brand, r.vehicle.model, r.vehicle.year]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (label) {
        const cur = vehicleLatency.get(label) || { label, values: [], count: 0 };
        cur.values.push(r.latencyMs);
        cur.count += 1;
        vehicleLatency.set(label, cur);
      }
    }
  }

  // Latenz-Stats
  const sortedLat = [...latencies].sort((a, b) => a - b);
  const network = {
    samples: sortedLat.length,
    avgMs:
      sortedLat.length > 0
        ? sortedLat.reduce((s, x) => s + x, 0) / sortedLat.length
        : null,
    minMs: sortedLat[0] ?? null,
    maxMs: sortedLat[sortedLat.length - 1] ?? null,
    p50Ms: quantile(sortedLat, 0.5),
    p95Ms: quantile(sortedLat, 0.95),
    p99Ms: quantile(sortedLat, 0.99),
  };

  // Per-Modus
  const perMode: DetailReport["perMode"] = [];
  for (const [mode, mrows] of perModeRows) {
    const sess = buildSessions(mrows, options.gapMs);
    const aSec = activeTimeSec(sess);
    const actions = mrows.filter((r) => r.isAction).length;
    perMode.push({
      mode,
      events: mrows.length,
      actions,
      sessions: sess.length,
      activeSec: aSec,
      actionsPerHour: aSec > 0 ? (actions / aSec) * 3600 : null,
      eventsPerHour: aSec > 0 ? (mrows.length / aSec) * 3600 : null,
    });
  }
  perMode.sort((a, b) => b.events - a.events);

  const remainingByMode = computeRemainingByMode(urows);

  // Per-IP
  const perIp: DetailReport["perIp"] = [];
  for (const [ip, info] of perIpMap) {
    const sess = buildSessions(info.rows, options.gapMs);
    perIp.push({
      ip,
      events: info.rows.length,
      actions: info.actions,
      firstTs: info.rows[0]?.ts ?? null,
      lastTs: info.rows[info.rows.length - 1]?.ts ?? null,
      activeSec: activeTimeSec(sess),
      avgLatencyMs:
        info.latencies.length > 0
          ? info.latencies.reduce((s, x) => s + x, 0) / info.latencies.length
          : null,
    });
  }
  perIp.sort((a, b) => b.events - a.events || a.ip.localeCompare(b.ip));

  // Timeline
  const timeline: DetailReport["timeline"] = [];
  if (urows.length > 0) {
    const t0 = urows[0].tsMs;
    const t1 = urows[urows.length - 1].tsMs;
    const span = Math.max(60_000, t1 - t0);
    const bucketMs = pickBucketMs(span);
    type B = {
      ms: number;
      events: number;
      actions: number;
      processed: number;
      latSum: number;
      latN: number;
    };
    const map = new Map<number, B>();
    type Last = { d2: number | null; d3: number | null; d4: number | null; d5: number | null };
    let last: Last = { d2: null, d3: null, d4: null, d5: null };
    const validFromMs = parseTs(VALID_DOUBLE_FROM_TS);
    for (const r of urows) {
      const ms = Math.floor(r.tsMs / bucketMs) * bucketMs;
      let b = map.get(ms);
      if (!b) {
        b = { ms, events: 0, actions: 0, processed: 0, latSum: 0, latN: 0 };
        map.set(ms, b);
      }
      b.events += 1;
      if (r.isAction) b.actions += 1;
      if (r.latencyMs != null) {
        b.latSum += r.latencyMs;
        b.latN += 1;
      }
      if (r.tsMs >= validFromMs) {
        const cur = { d2: r.d2, d3: r.d3, d4: r.d4, d5: r.d5 };
        for (const k of ["d2", "d3", "d4", "d5"] as const) {
          const prev = last[k];
          const now = cur[k];
          if (prev != null && now != null && Number.isFinite(now) && now >= 0) {
            const diff = prev - now;
            if (diff > 0) b.processed += diff;
          }
        }
        last = cur;
      }
    }
    for (const b of [...map.values()].sort((a, b) => a.ms - b.ms)) {
      timeline.push({
        bucket: fmtIso(b.ms),
        events: b.events,
        actions: b.actions,
        processed: Math.round(b.processed),
        avgLatencyMs: b.latN > 0 ? b.latSum / b.latN : null,
      });
    }
  }

  const totalProcessed = remainingByMode.reduce((s, m) => s + m.processed, 0);
  const eventsPerActiveHour =
    totalActive > 0 ? (urows.length / totalActive) * 3600 : null;
  const actionsPerActiveHour =
    totalActive > 0 ? (actionCount / totalActive) * 3600 : null;
  const vehiclesPerActiveHour =
    totalActive > 0 ? (totalProcessed / totalActive) * 3600 : null;

  const eventsPerSec =
    totalActive > 0 ? urows.length / totalActive : null;
  const eventsPerMinute =
    eventsPerSec != null ? eventsPerSec * 60 : null;
  const actionsPerSec =
    totalActive > 0 ? actionCount / totalActive : null;
  const actionsPerMinute =
    actionsPerSec != null ? actionsPerSec * 60 : null;

  const topVehicles = [...vehicleCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  const topBrands = [...brandCounts.entries()]
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  const topModels = [...brandModelCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  const topViews = [...viewCounts.entries()]
    .map(([view, count]) => ({ view, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const topActions = [...buttonCounts.entries()]
    .map(([button, count]) => ({ button, count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  const topModes = topCounts(modeCounts, 8).map((x) => ({
    mode: x.key,
    count: x.count,
  }));
  const topUserAgents = topCounts(uaCounts, 6).map((x) => ({
    ua: x.key,
    count: x.count,
  }));

  const vehicleLatencyArr: DetailReport["vehicleLatency"] = [];
  for (const v of vehicleLatency.values()) {
    if (v.count === 0) continue;
    const sorted = [...v.values].sort((a, b) => a - b);
    vehicleLatencyArr.push({
      label: v.label,
      actions: v.count,
      avgLatencyMs:
        sorted.length > 0 ? sorted.reduce((s, x) => s + x, 0) / sorted.length : null,
      minLatencyMs: sorted[0] ?? null,
      maxLatencyMs: sorted[sorted.length - 1] ?? null,
    });
  }
  vehicleLatencyArr.sort((a, b) => b.actions - a.actions);

  // Range-bezogene KPIs (Kalendertag-Sicht)
  const rangeFromMs = parseTs(options.fromIso);
  const rangeToMs = parseTs(options.toIso);
  const rangeSpanSec =
    rangeFromMs && rangeToMs && rangeToMs > rangeFromMs
      ? Math.round((rangeToMs - rangeFromMs) / 1000)
      : 0;
  const rangeDays = rangeSpanSec > 0 ? rangeSpanSec / 86_400 : 0;
  const vehiclesPerCalendarDay =
    rangeDays > 0 ? totalProcessed / rangeDays : null;
  const vehiclesPerCalendarHour =
    rangeSpanSec > 0 ? (totalProcessed / rangeSpanSec) * 3600 : null;

  // Vollständige Vehicle-Liste (bis 500), für Vehicle-Suche
  const vehiclesList: DetailReport["vehicles"] = [];
  for (const v of vehicleAll.values()) {
    const usersArr = [...v.users.entries()]
      .map(([user, info]) => ({ user, events: info.events, actions: info.actions }))
      .sort((a, b) => b.actions - a.actions || b.events - a.events);
    const viewsArr = [...v.views.entries()]
      .map(([view, count]) => ({ view, count }))
      .sort((a, b) => b.count - a.count);
    vehiclesList.push({
      label: v.label,
      brand: v.brand,
      model: v.model,
      year: v.year,
      body: v.body,
      trim: v.trim,
      color: v.color,
      events: v.events,
      actions: v.actions,
      lastTs: v.lastTs,
      users: usersArr,
      views: viewsArr,
    });
  }
  vehiclesList.sort(
    (a, b) =>
      b.actions - a.actions ||
      b.events - a.events ||
      a.label.localeCompare(b.label),
  );
  const vehiclesTrimmed = vehiclesList.slice(0, 500);

  return {
    user,
    scope: { ip: ipScope, aggregate },
    summary: {
      eventCount: urows.length,
      actionCount,
      sessionCount: sessions.length,
      totalActiveSec: totalActive,
      avgSessionSec: avgSession,
      longestSessionSec: longest,
      firstTs: urows[0]?.ts ?? null,
      lastTs: urows[urows.length - 1]?.ts ?? null,
      uniqueIps: ipSet.size,
      uniqueUsers: userSet.size,
      uniqueDays: dayKeys.size,
      rangeDays,
      rangeSpanSec,
      eventsPerSec,
      eventsPerMinute,
      actionsPerSec,
      actionsPerMinute,
      actionsPerActiveHour,
      eventsPerActiveHour,
      processedTotal: totalProcessed,
      vehiclesPerActiveHour,
      vehiclesPerCalendarDay,
      vehiclesPerCalendarHour,
    },
    network,
    perMode,
    remainingByMode,
    topActions,
    topModes,
    topVehicles,
    topBrands,
    topModels,
    topViews,
    topUserAgents,
    perIp,
    perHourOfDay: hourCounts.map((c, h) => ({ hour: h, ...c })),
    perWeekday: weekdayCounts.map((c, wd) => ({ weekday: wd, ...c })),
    timeline,
    latencyPoints: latencyPoints.slice(-2000),
    sessions,
    vehicleLatency: vehicleLatencyArr.slice(0, 20),
    vehicles: vehiclesTrimmed,
  };
}

export function defaultUserAnalyticsRange(): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now.getTime() + 60_000);
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const f = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);
  return { from: f(from), to: f(to) };
}
