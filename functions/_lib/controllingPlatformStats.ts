/**
 * Auswertung der Analytics-Engine-Tabelle `controll_platform_logs`.
 *
 * Spaltensemantik (vom Writer der Plattform vorgegeben):
 *   timestamp        – Zeit
 *   index1           – Benutzer
 *   blob1            – Benutzer (= index1, redundant → ignoriert)
 *   blob2            – Aktion ("modus:button", z. B. "shortcut:regen_vertex");
 *                      nur Werte mit ":" sind „echte" Aktionen
 *   blob3            – Modus (z. B. Korrektur, Ausschneiden, …)
 *   blob4            – R2-Image-Key
 *   blob5            – IPv4/IPv6
 *   blob6            – Betriebssystem / User-Agent
 *   double2          – verbleibende Fahrzeuge im Modus (offen)
 *   double3          – Gesamtzahl im Modus (insg. verfügbar)
 *   double4 / double5 – aktuell nicht ausgewertet
 *
 * Standard: dedicated AE-Tabelle (`FROM controll_platform_logs`).
 * Override per `CONTROLLING_AE_DEDICATED=0` → `FROM key_analytics`/`api_analytics`
 * + `AND dataset = '…'` (wie /api/analytics/customer-keys).
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

export const DEFAULT_DATASET = "controll_platform_logs";
/** 5 min ohne Event → Sessionsende. */
export const DEFAULT_SESSION_GAP_MS = 5 * 60 * 1000;
export const MAX_QUERY_ROWS = 150_000;

export type ControllingBlob4Mode = "nonempty" | "hex32" | "all";

/** Wert der Spalte `dataset` bzw. Tabellenname im dedicated-Mode. */
export function getControllingDataset(env: AuthEnv): string {
  const raw = env.CONTROLLING_AE_DATASET?.trim() || DEFAULT_DATASET;
  if (!/^[a-zA-Z0-9_]+$/.test(raw)) return DEFAULT_DATASET;
  return raw;
}

function isDedicatedTableMode(env: AuthEnv): boolean {
  const v = env.CONTROLLING_AE_DEDICATED?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return true;
}

function controllingAeBinding(env: AuthEnv): AeAccountBinding {
  return env.CONTROLLING_AE_ACCOUNT?.trim().toLowerCase() === "secondary"
    ? "secondary"
    : "primary";
}

function fromTableForFilterMode(binding: AeAccountBinding): string {
  return binding === "secondary" ? API_ANALYTICS_DATASET : KEY_ANALYTICS_DATASET;
}

/**
 * Filter-SQL für blob4. Default `nonempty` ist absichtlich permissiv und
 * lehnt sich an den `customer-keys`-Pattern an, damit es zur AE passt.
 */
function blob4FilterSql(mode: ControllingBlob4Mode): string {
  if (mode === "all") return "";
  const base = "blob4 != '' AND blob4 != 'NA' AND blob4 != 'na'";
  if (mode === "hex32") {
    return base + " AND length(blob4) = 32 AND match(blob4, '^[0-9a-fA-F]{32}$')";
  }
  return base;
}

export type ControllingFetchPlan = {
  sql: string;
  binding: AeAccountBinding;
  fromMode: "key_analytics_filter" | "dedicated_table";
  fromTable: string;
};

/**
 * Mirror der funktionierenden `customer-keys/recent` Projektion: kein Alias
 * auf `timestamp`, keine const-Projektionen — verhindert AE-Planner-Fehler
 * „unable to find type of column: timestamp".
 */
const selectBody = `SELECT
  timestamp,
  _sample_interval,
  index1,
  blob1,
  blob2,
  blob3,
  blob4,
  blob5,
  blob6,
  double1,
  double2,
  double3,
  double4,
  double5`;

export function buildControllingFetchPlan(
  env: AuthEnv,
  fromIso: string,
  toIso: string,
  options: { limit: number; blob4Mode: ControllingBlob4Mode },
): ControllingFetchPlan {
  const name = getControllingDataset(env);
  const limit = Math.min(
    MAX_QUERY_ROWS,
    Math.max(1, Math.min(options.limit, MAX_QUERY_ROWS)),
  );
  const whereTime = `timestamp >= ${sqlDateTime(fromIso)} AND timestamp < ${sqlDateTime(toIso)}`;
  const whereBlob = blob4FilterSql(options.blob4Mode);
  const blobClause = whereBlob ? ` AND ${whereBlob}` : "";
  const binding = controllingAeBinding(env);
  if (isDedicatedTableMode(env)) {
    return {
      binding,
      fromMode: "dedicated_table",
      fromTable: name,
      sql: `${selectBody}
FROM ${name}
WHERE ${whereTime}${blobClause}
ORDER BY timestamp ASC
LIMIT ${limit}
FORMAT JSON`,
    };
  }
  const fromTable = fromTableForFilterMode(binding);
  const whereDataset = `AND dataset = ${sqlString(name)} `;
  return {
    binding,
    fromMode: "key_analytics_filter",
    fromTable,
    sql: `${selectBody}
FROM ${fromTable}
WHERE ${whereTime} ${whereDataset}${blobClause ? blobClause.replace(/^\s*AND\s+/, "AND ") : ""}
ORDER BY timestamp ASC
LIMIT ${limit}
FORMAT JSON`,
  };
}

// ---------- Roh-Zeile ----------

export type RawControllingRow = {
  ts: string;
  siv: number;
  user: string; // index1
  s_blob2: string; // raw action
  actionMode: string; // blob2.split(':')[0] — falls ':' enthalten
  actionButton: string; // blob2.split(':')[1] — falls ':' enthalten
  mode: string; // blob3
  imageKey: string; // blob4
  ip: string; // blob5
  os: string; // blob6
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  d5: number;
};

export function parseControllingRow(r: AeRow): RawControllingRow {
  const tsVal = r.timestamp;
  const tsStr =
    tsVal == null
      ? ""
      : typeof tsVal === "number" || typeof tsVal === "bigint"
        ? String(tsVal)
        : String(tsVal);
  const blob2 = String(r.blob2 ?? "");
  let actionMode = "";
  let actionButton = "";
  if (blob2.includes(":")) {
    const idx = blob2.indexOf(":");
    actionMode = blob2.slice(0, idx).trim();
    actionButton = blob2.slice(idx + 1).trim();
  }
  return {
    ts: tsStr,
    siv: aeNumber(r._sample_interval) || 1,
    user: String(r.index1 ?? "").trim(),
    s_blob2: blob2,
    actionMode,
    actionButton,
    mode: String(r.blob3 ?? "").trim(),
    imageKey: String(r.blob4 ?? ""),
    ip: String(r.blob5 ?? ""),
    os: String(r.blob6 ?? ""),
    d1: aeNumber(r.double1),
    d2: aeNumber(r.double2),
    d3: aeNumber(r.double3),
    d4: aeNumber(r.double4),
    d5: aeNumber(r.double5),
  };
}

// ---------- Hilfsfunktionen ----------

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

function fmtIso(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

// ---------- Sessions ----------

export type ControllingSession = {
  start: string;
  end: string;
  events: number;
  durationSec: number;
  gapStartSec: number | null;
  modes: string[]; // unique blob3 in dieser Session
};

function buildSessions(
  rows: RawControllingRow[],
  gapMs: number,
): ControllingSession[] {
  if (rows.length === 0) return [];
  const sessions: ControllingSession[] = [];
  let startIdx = 0;
  const flush = (i: number) => {
    const part = rows.slice(startIdx, i);
    if (!part.length) return;
    const t0 = parseTs(part[0].ts);
    const t1 = parseTs(part[part.length - 1].ts);
    const gapFromPrev =
      startIdx > 0 ? (t0 - parseTs(rows[startIdx - 1].ts)) / 1000 : null;
    const modes = Array.from(
      new Set(part.map((p) => p.mode).filter(Boolean)),
    );
    sessions.push({
      start: part[0].ts,
      end: part[part.length - 1].ts,
      events: part.length,
      durationSec: Math.max(0, (t1 - t0) / 1000),
      gapStartSec: gapFromPrev,
      modes,
    });
  };
  for (let i = 1; i < rows.length; i++) {
    const tPrev = parseTs(rows[i - 1].ts);
    const tCur = parseTs(rows[i].ts);
    if (tCur - tPrev > gapMs) {
      flush(i);
      startIdx = i;
    }
  }
  flush(rows.length);
  return sessions;
}

/** Akkumulierte „aktive Zeit" eines Users = Summe der Session-Dauern. */
function activeTimeSec(sessions: ControllingSession[]): number {
  return sessions.reduce((s, x) => s + x.durationSec, 0);
}

// ---------- Pro-Modus-Auswertung (blob3) ----------

export type ControllingPerUserInMode = {
  user: string;
  events: number;
  /** Anzahl Bilder, die diesem User zugeordnet bei abnehmender open in diesem Modus zuzuschreiben sind. */
  processed: number;
  /** Bearbeitete Bilder pro Stunde, normiert auf aktive Zeit des Users im Modus. */
  perHour: number | null;
  /** Aktive Zeit (s) des Users in diesem Modus (Sessions, in denen dieser Modus vorkam). */
  activeSec: number;
};

export type ControllingByMode = {
  mode: string;
  events: number;
  uniqueUsers: number;
  users: string[];
  firstTs: string | null;
  lastTs: string | null;
  /** Letzter bekannter Stand im Modus. */
  latestOpen: number | null; // double2
  latestTotal: number | null; // double3
  latestDone: number | null; // total - open
  /** Wie viele Bilder pro Stunde abgearbeitet werden (Summe der Rückgänge in `open`). */
  processedPerHour: number | null;
  /** Wie viele Bilder pro Stunde NEU dazukommen (Anstiege in `total`). */
  addedPerHour: number | null;
  /** processed − added (positiv = Bestand sinkt). */
  netReductionPerHour: number | null;
  /** Wenn nichts mehr dazu kommt: open / processedPerHour. */
  etaIfNoNewHours: number | null;
  /** Wenn weiter so dazu kommt: open / netReductionPerHour. null wenn ≤ 0. */
  etaIfKeepsAddingHours: number | null;
  /** Bisher bearbeitet im Zeitraum (Summe der Rückgänge open). */
  processedTotal: number;
  /** Bisher dazu gekommen im Zeitraum (Summe der Anstiege total). */
  addedTotal: number;
  /** Top-Buttons aus blob2 ("modus:button"), nur Einträge mit ":". */
  topButtons: Array<{ button: string; count: number }>;
  /** Pro-User-Aufschlüsselung für diesen Modus. */
  byUser: ControllingPerUserInMode[];
};

// ---------- Pro-User-Auswertung ----------

export type ControllingPerModeOfUser = {
  mode: string;
  events: number;
  processed: number;
  perHour: number | null;
  activeSec: number;
};

export type ControllingUserStats = {
  user: string;
  eventCount: number;
  firstTs: string | null;
  lastTs: string | null;
  sessions: ControllingSession[];
  totalSessionTimeSec: number;
  avgSessionTimeSec: number;
  /** Distincts. */
  modes: string[];
  /** Häufigstes OS aus blob6. */
  primaryOs: string | null;
  /** Letzte IP aus blob5. */
  lastIp: string | null;
  /** Top-Buttons (blob2 mit ":") für diesen User. */
  topButtons: Array<{ mode: string; button: string; count: number }>;
  /** Aufschlüsselung nach Modus. */
  perMode: ControllingPerModeOfUser[];
  /** Summe `processed` über alle Modi. */
  totalProcessed: number;
  /** Globaler Bilder-/h Wert über die aktive Zeit des Users. */
  processedPerHour: number | null;
  /** Bilder pro aktiver Minute (Sessions). */
  perActiveMinute: number | null;
};

// ---------- Globale Timeline ----------

export type ControllingBucket = {
  bucket: string; // ISO „YYYY-MM-DD HH:MM"
  events: number;
  activeUsers: number;
  processed: number;
  added: number;
};

// ---------- Hauptauswertung ----------

export type ProcessedControlling = {
  rangeRows: number;
  truncated: boolean;
  sessionGapMinutes: number;
  byUser: ControllingUserStats[];
  byMode: ControllingByMode[];
  timeline: ControllingBucket[];
  /** Globaler Bestand im Zeitraum (Aufsummiert über Modi). */
  global: {
    latestOpen: number | null;
    latestTotal: number | null;
    latestDone: number | null;
    processedPerHour: number | null;
    addedPerHour: number | null;
    netReductionPerHour: number | null;
    etaIfNoNewHours: number | null;
    etaIfKeepsAddingHours: number | null;
    processedTotal: number;
    addedTotal: number;
    activeUsers: number;
    activeUserSec: number; // Summe aktiver Zeit aller User
  };
};

/**
 * Linearisiert Punkte (t, value) → liefert Pro-Stunde-Werte als
 * Summe der Anstiege/Rückgänge / verstrichener Zeit (robust gegen Sprünge).
 */
function rateSeries(points: Array<{ t: number; v: number }>): {
  upPerSec: number; // Summe positiver Differenzen / Δt
  downPerSec: number; // Summe negativer Differenzen (positiv kodiert) / Δt
  upTotal: number;
  downTotal: number;
  spanSec: number;
} {
  if (points.length < 2) {
    return { upPerSec: 0, downPerSec: 0, upTotal: 0, downTotal: 0, spanSec: 0 };
  }
  let upTotal = 0;
  let downTotal = 0;
  for (let i = 1; i < points.length; i++) {
    const d = points[i].v - points[i - 1].v;
    if (d > 0) upTotal += d;
    else if (d < 0) downTotal += -d;
  }
  const spanSec = Math.max(
    1,
    (points[points.length - 1].t - points[0].t) / 1000,
  );
  return {
    upPerSec: upTotal / spanSec,
    downPerSec: downTotal / spanSec,
    upTotal,
    downTotal,
    spanSec,
  };
}

/** Pro Bucket-Größe (ms): bestimme passende, wenn nicht gesetzt. */
function pickBucketMs(spanMs: number): number {
  if (spanMs <= 6 * 60 * 60 * 1000) return 5 * 60 * 1000; // ≤ 6h → 5min
  if (spanMs <= 36 * 60 * 60 * 1000) return 30 * 60 * 1000; // ≤ 36h → 30min
  if (spanMs <= 8 * 24 * 60 * 60 * 1000) return 60 * 60 * 1000; // ≤ 8d → 1h
  return 6 * 60 * 60 * 1000; // sonst 6h
}

export function processControllingData(
  raw: AeRow[],
  gapMs: number,
  options?: { likelyTruncated: boolean },
): ProcessedControlling {
  const rows = raw
    .map(parseControllingRow)
    .filter((r) => r.ts && r.user)
    .sort(
      (a, b) => parseTs(a.ts) - parseTs(b.ts) || a.ts.localeCompare(b.ts),
    );

  // ---------- Pro-Modus-Auswertung ----------
  const modeBuckets = new Map<string, RawControllingRow[]>();
  for (const r of rows) {
    const m = r.mode || "—";
    if (!modeBuckets.has(m)) modeBuckets.set(m, []);
    modeBuckets.get(m)!.push(r);
  }

  const byMode: ControllingByMode[] = [];
  for (const [mode, mrows] of modeBuckets) {
    const userSet = new Set(mrows.map((x) => x.user));
    // open- und total-Serien (jeweils nur sinnvolle Werte)
    const openSeries: { t: number; v: number }[] = [];
    const totalSeries: { t: number; v: number }[] = [];
    for (const r of mrows) {
      const t = parseTs(r.ts);
      if (!t) continue;
      if (r.d2 >= 0 && Number.isFinite(r.d2)) openSeries.push({ t, v: r.d2 });
      if (r.d3 >= 0 && Number.isFinite(r.d3)) totalSeries.push({ t, v: r.d3 });
    }
    const openR = rateSeries(openSeries); // downTotal = abgearbeitet
    const totalR = rateSeries(totalSeries); // upTotal = neu dazu

    const last = mrows[mrows.length - 1];
    const latestOpen = last?.d2 ?? null;
    const latestTotal = last?.d3 ?? null;
    const latestDone =
      latestTotal != null && latestOpen != null
        ? Math.max(0, latestTotal - latestOpen)
        : null;

    const processedPerHour =
      openR.spanSec > 0 ? openR.downPerSec * 3600 : null;
    const addedPerHour = totalR.spanSec > 0 ? totalR.upPerSec * 3600 : null;
    const netReductionPerHour =
      processedPerHour != null && addedPerHour != null
        ? processedPerHour - addedPerHour
        : null;

    const etaIfNoNewHours =
      latestOpen != null && processedPerHour && processedPerHour > 0
        ? latestOpen / processedPerHour
        : latestOpen === 0
          ? 0
          : null;
    const etaIfKeepsAddingHours =
      latestOpen != null && netReductionPerHour && netReductionPerHour > 0
        ? latestOpen / netReductionPerHour
        : latestOpen === 0
          ? 0
          : null;

    // Top-Buttons (blob2 mit ":")
    const buttonCounts = new Map<string, number>();
    for (const r of mrows) {
      if (r.actionButton) {
        const k = r.actionButton;
        buttonCounts.set(k, (buttonCounts.get(k) || 0) + 1);
      }
    }
    const topButtons = [...buttonCounts.entries()]
      .map(([button, count]) => ({ button, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Pro-User in diesem Modus
    const perUserMap = new Map<string, RawControllingRow[]>();
    for (const r of mrows) {
      if (!perUserMap.has(r.user)) perUserMap.set(r.user, []);
      perUserMap.get(r.user)!.push(r);
    }
    const byUser: ControllingPerUserInMode[] = [];
    for (const [user, urows] of perUserMap) {
      const sess = buildSessions(urows, gapMs);
      const tSec = activeTimeSec(sess);
      const uOpen: { t: number; v: number }[] = [];
      for (const r of urows) {
        const t = parseTs(r.ts);
        if (t && r.d2 >= 0) uOpen.push({ t, v: r.d2 });
      }
      const r = rateSeries(uOpen);
      const processed = Math.round(r.downTotal);
      const perHour = tSec > 0 ? (processed / tSec) * 3600 : null;
      byUser.push({
        user,
        events: urows.length,
        processed,
        perHour,
        activeSec: tSec,
      });
    }
    byUser.sort((a, b) => b.processed - a.processed || b.events - a.events);

    byMode.push({
      mode,
      events: mrows.length,
      uniqueUsers: userSet.size,
      users: [...userSet].sort(),
      firstTs: mrows[0]?.ts ?? null,
      lastTs: last?.ts ?? null,
      latestOpen,
      latestTotal,
      latestDone,
      processedPerHour,
      addedPerHour,
      netReductionPerHour,
      etaIfNoNewHours,
      etaIfKeepsAddingHours,
      processedTotal: Math.round(openR.downTotal),
      addedTotal: Math.round(totalR.upTotal),
      topButtons,
      byUser,
    });
  }
  byMode.sort(
    (a, b) =>
      (b.latestOpen ?? 0) - (a.latestOpen ?? 0) || b.events - a.events,
  );

  // ---------- Pro-User-Auswertung ----------
  const userBuckets = new Map<string, RawControllingRow[]>();
  for (const r of rows) {
    if (!userBuckets.has(r.user)) userBuckets.set(r.user, []);
    userBuckets.get(r.user)!.push(r);
  }

  const byUser: ControllingUserStats[] = [];
  let totalActiveSec = 0;
  for (const [user, urows] of userBuckets) {
    const sessions = buildSessions(urows, gapMs);
    const tSec = activeTimeSec(sessions);
    totalActiveSec += tSec;
    const last = urows[urows.length - 1];

    // Pro-Modus-Aufschlüsselung
    const perModeMap = new Map<string, RawControllingRow[]>();
    for (const r of urows) {
      const m = r.mode || "—";
      if (!perModeMap.has(m)) perModeMap.set(m, []);
      perModeMap.get(m)!.push(r);
    }
    const perMode: ControllingPerModeOfUser[] = [];
    for (const [mode, mrows] of perModeMap) {
      const sess = buildSessions(mrows, gapMs);
      const aSec = activeTimeSec(sess);
      const opens: { t: number; v: number }[] = [];
      for (const r of mrows) {
        const t = parseTs(r.ts);
        if (t && r.d2 >= 0) opens.push({ t, v: r.d2 });
      }
      const r = rateSeries(opens);
      const processed = Math.round(r.downTotal);
      perMode.push({
        mode,
        events: mrows.length,
        processed,
        perHour: aSec > 0 ? (processed / aSec) * 3600 : null,
        activeSec: aSec,
      });
    }
    perMode.sort((a, b) => b.processed - a.processed || b.events - a.events);

    const totalProcessed = perMode.reduce((s, m) => s + m.processed, 0);
    const processedPerHour =
      tSec > 0 ? (totalProcessed / tSec) * 3600 : null;
    const perActiveMinute = tSec > 0 ? (totalProcessed / tSec) * 60 : null;

    // OS-Häufigkeit / Buttons / IP
    const osCounts = new Map<string, number>();
    const btnCounts = new Map<string, { mode: string; button: string; count: number }>();
    let lastIp = "";
    for (const r of urows) {
      if (r.os) osCounts.set(r.os, (osCounts.get(r.os) || 0) + 1);
      if (r.actionButton) {
        const k = `${r.actionMode}|${r.actionButton}`;
        const e = btnCounts.get(k) || { mode: r.actionMode, button: r.actionButton, count: 0 };
        e.count += 1;
        btnCounts.set(k, e);
      }
      if (r.ip) lastIp = r.ip;
    }
    const primaryOs =
      [...osCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topButtons = [...btnCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    byUser.push({
      user,
      eventCount: urows.length,
      firstTs: urows[0]?.ts ?? null,
      lastTs: last?.ts ?? null,
      sessions,
      totalSessionTimeSec: tSec,
      avgSessionTimeSec: sessions.length > 0 ? tSec / sessions.length : 0,
      modes: [...new Set(urows.map((x) => x.mode).filter(Boolean))].sort(),
      primaryOs,
      lastIp: lastIp || null,
      topButtons,
      perMode,
      totalProcessed,
      processedPerHour,
      perActiveMinute,
    });
  }
  byUser.sort((a, b) => b.eventCount - a.eventCount);

  // ---------- Timeline ----------
  const timeline: ControllingBucket[] = [];
  if (rows.length > 0) {
    const t0 = parseTs(rows[0].ts);
    const t1 = parseTs(rows[rows.length - 1].ts);
    const span = Math.max(60_000, t1 - t0);
    const bucketMs = pickBucketMs(span);
    type B = {
      ms: number;
      events: number;
      users: Set<string>;
      processed: number;
      added: number;
    };
    const map = new Map<number, B>();
    // Für processed/added: pro Modus separat letztes d2/d3 vor jedem Bucket merken
    type Last = { d2: number | null; d3: number | null };
    const lastByMode = new Map<string, Last>();
    for (const r of rows) {
      const t = parseTs(r.ts);
      if (!t) continue;
      const ms = Math.floor(t / bucketMs) * bucketMs;
      let b = map.get(ms);
      if (!b) {
        b = { ms, events: 0, users: new Set(), processed: 0, added: 0 };
        map.set(ms, b);
      }
      b.events += 1;
      if (r.user) b.users.add(r.user);
      const last = lastByMode.get(r.mode) || { d2: null, d3: null };
      if (last.d2 != null && r.d2 >= 0) {
        const d = last.d2 - r.d2;
        if (d > 0) b.processed += d;
      }
      if (last.d3 != null && r.d3 >= 0) {
        const d = r.d3 - last.d3;
        if (d > 0) b.added += d;
      }
      lastByMode.set(r.mode, { d2: r.d2, d3: r.d3 });
    }
    for (const b of [...map.values()].sort((a, b) => a.ms - b.ms)) {
      timeline.push({
        bucket: fmtIso(b.ms),
        events: b.events,
        activeUsers: b.users.size,
        processed: Math.round(b.processed),
        added: Math.round(b.added),
      });
    }
  }

  // ---------- Globaler Bestand (Summe Modi) ----------
  let gOpen: number | null = null;
  let gTotal: number | null = null;
  let gProcessed = 0;
  let gAdded = 0;
  let gProcPerH: number | null = null;
  let gAddedPerH: number | null = null;
  for (const m of byMode) {
    if (m.latestOpen != null) gOpen = (gOpen ?? 0) + m.latestOpen;
    if (m.latestTotal != null) gTotal = (gTotal ?? 0) + m.latestTotal;
    gProcessed += m.processedTotal;
    gAdded += m.addedTotal;
    if (m.processedPerHour != null) {
      gProcPerH = (gProcPerH ?? 0) + m.processedPerHour;
    }
    if (m.addedPerHour != null) {
      gAddedPerH = (gAddedPerH ?? 0) + m.addedPerHour;
    }
  }
  const gNet =
    gProcPerH != null && gAddedPerH != null ? gProcPerH - gAddedPerH : null;
  const gEtaNoNew =
    gOpen != null && gProcPerH && gProcPerH > 0
      ? gOpen / gProcPerH
      : gOpen === 0
        ? 0
        : null;
  const gEtaKeep =
    gOpen != null && gNet && gNet > 0
      ? gOpen / gNet
      : gOpen === 0
        ? 0
        : null;
  const gDone =
    gTotal != null && gOpen != null ? Math.max(0, gTotal - gOpen) : null;

  return {
    rangeRows: rows.length,
    truncated: options?.likelyTruncated ?? false,
    sessionGapMinutes: gapMs / 60_000,
    byUser,
    byMode,
    timeline,
    global: {
      latestOpen: gOpen,
      latestTotal: gTotal,
      latestDone: gDone,
      processedPerHour: gProcPerH,
      addedPerHour: gAddedPerH,
      netReductionPerHour: gNet,
      etaIfNoNewHours: gEtaNoNew,
      etaIfKeepsAddingHours: gEtaKeep,
      processedTotal: gProcessed,
      addedTotal: gAdded,
      activeUsers: byUser.length,
      activeUserSec: totalActiveSec,
    },
  };
}

export function defaultControllingRange(): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now.getTime() + 60_000);
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const f = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);
  return { from: f(from), to: f(to) };
}
