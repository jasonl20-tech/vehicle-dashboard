/**
 * Auswertung der Analytics-Engine-Dataset-Tabellen (z. B. controll_platform_logs).
 * Session-Erkennung, Kennzahlen double2–double5, Prognose – rein deterministische Logik
 * (keine DB, nur In-Memory nach fetch).
 */
import type { AuthEnv } from "./auth";
import { aeNumber, sqlDateTime, type AeRow } from "./analytics";

export const DEFAULT_DATASET = "controll_platform_logs";
/** 5 min ohne Event → Sessionsende. */
export const DEFAULT_SESSION_GAP_MS = 5 * 60 * 1000;
export const MAX_QUERY_ROWS = 150_000;

export type ControllingBlob4Mode = "nonempty" | "hex32";

export function getControllingDataset(env: AuthEnv): string {
  const raw = env.CONTROLLING_AE_DATASET?.trim() || DEFAULT_DATASET;
  if (!/^[a-zA-Z0-9_]+$/.test(raw)) return DEFAULT_DATASET;
  return raw;
}

function blob4FilterSql(mode: ControllingBlob4Mode): string {
  const b = "trim(toString(blob4))";
  if (mode === "hex32") {
    return `${b} != '' AND ${b} != 'NA' AND match(lower(replaceAll(${b}, '-', '')), '^[0-9a-f]{32}$')`;
  }
  return `${b} != '' AND ${b} != 'NA'`;
}

export function buildControllingFetchSql(
  env: AuthEnv,
  fromIso: string,
  toIso: string,
  options: { limit: number; blob4Mode: ControllingBlob4Mode },
): string {
  const dataset = getControllingDataset(env);
  const limit = Math.min(
    MAX_QUERY_ROWS,
    Math.max(1, Math.min(options.limit, MAX_QUERY_ROWS)),
  );
  const whereTime = `timestamp >= ${sqlDateTime(fromIso)} AND timestamp < ${sqlDateTime(
    toIso,
  )}`;
  const whereBlob = blob4FilterSql(options.blob4Mode);
  return `SELECT
  toString(timestamp) AS ts,
  toString(_sample_interval) AS siv,
  toString(index1) AS s_index1,
  toString(index2) AS s_index2,
  toString(blob1) AS s_blob1,
  toString(blob2) AS s_blob2,
  toString(blob3) AS s_blob3,
  toString(blob4) AS s_blob4,
  toString(blob5) AS s_blob5,
  double1 AS d1,
  double2 AS d2,
  double3 AS d3,
  double4 AS d4,
  double5 AS d5
FROM ${dataset}
WHERE ${whereTime} AND ${whereBlob}
ORDER BY ts ASC
LIMIT ${limit}
FORMAT JSON`;
}

export type RawControllingRow = {
  ts: string;
  siv: string;
  s_index1: string;
  s_index2: string;
  s_blob1: string;
  s_blob2: string;
  s_blob3: string;
  s_blob4: string;
  s_blob5: string;
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  d5: number;
};

export function parseControllingRow(r: AeRow): RawControllingRow {
  return {
    ts: String(r.ts ?? ""),
    siv: String(r.siv ?? ""),
    s_index1: String(r.s_index1 ?? ""),
    s_index2: String(r.s_index2 ?? ""),
    s_blob1: String(r.s_blob1 ?? ""),
    s_blob2: String(r.s_blob2 ?? ""),
    s_blob3: String(r.s_blob3 ?? ""),
    s_blob4: String(r.s_blob4 ?? ""),
    s_blob5: String(r.s_blob5 ?? ""),
    d1: aeNumber(r.d1),
    d2: aeNumber(r.d2),
    d3: aeNumber(r.d3),
    d4: aeNumber(r.d4),
    d5: aeNumber(r.d5),
  };
}

/**
 * Vornamen/Display: bevorzugt sichtbare Texte in blob1/blob2, sonst index1/2
 * (Hogir/Hogir), reine Ziffern in index1 allein eher kein Name.
 */
export function userLabelFromRow(r: RawControllingRow): string {
  const b1 = r.s_blob1.trim();
  const b2 = r.s_blob2.trim();
  if (b1 || b2) {
    return [b1, b2].filter(Boolean).join(" ") || "Unbekannt";
  }
  const i1 = r.s_index1.trim();
  const i2 = r.s_index2.trim();
  if (i1 && /^\d+$/.test(i1) && !i2) {
    return "Unbekannt";
  }
  const joined = [i1, i2].filter(Boolean).join(" ").trim();
  return joined || "Unbekannt";
}

/** Interpretation double2–5: d3−d2 = offen, falls sinnvoll; sonst 0. */
export function progressFromDoubles(
  d2: number,
  d3: number,
  d4: number,
  d5: number,
): {
  done: number | null;
  total: number | null;
  open: number | null;
  d4: number;
  d5: number;
} {
  if (d3 > 0 && d2 >= 0) {
    const open = Math.max(0, d3 - d2);
    return { done: d2, total: d3, open, d4, d5 };
  }
  if (d2 > 0 && d3 === 0) {
    return { done: d2, total: d2, open: 0, d4, d5 };
  }
  return { done: d2, total: d3, open: null, d4, d5 };
}

function parseTs(s: string): number {
  const t = Date.parse(s.replace(" ", "T") + "Z");
  return Number.isFinite(t) ? t : 0;
}

type Session = {
  start: string;
  end: string;
  events: number;
  durationSec: number;
  gapStartSec: number | null;
};

function buildSessions(rows: RawControllingRow[], gapMs: number): Session[] {
  if (rows.length === 0) return [];
  const sessions: Session[] = [];
  let startIdx = 0;
  for (let i = 1; i < rows.length; i++) {
    const tPrev = parseTs(rows[i - 1].ts);
    const tCur = parseTs(rows[i].ts);
    if (tCur - tPrev > gapMs) {
      const part = rows.slice(startIdx, i);
      if (part.length) {
        const t0 = parseTs(part[0].ts);
        const t1 = parseTs(part[part.length - 1].ts);
        const gapFromPrev =
          startIdx > 0
            ? (t0 - parseTs(rows[startIdx - 1].ts)) / 1000
            : null;
        sessions.push({
          start: part[0].ts,
          end: part[part.length - 1].ts,
          events: part.length,
          durationSec: (t1 - t0) / 1000,
          gapStartSec: gapFromPrev,
        });
      }
      startIdx = i;
    }
  }
  const part = rows.slice(startIdx);
  if (part.length) {
    const t0 = parseTs(part[0].ts);
    const t1 = parseTs(part[part.length - 1].ts);
    const gapFromPrev =
      startIdx > 0
        ? (t0 - parseTs(rows[startIdx - 1].ts)) / 1000
        : null;
    sessions.push({
      start: part[0].ts,
      end: part[part.length - 1].ts,
      events: part.length,
      durationSec: (t1 - t0) / 1000,
      gapStartSec: gapFromPrev,
    });
  }
  return sessions;
}

export type ControllingUserStats = {
  user: string;
  eventCount: number;
  firstTs: string | null;
  lastTs: string | null;
  sessions: Session[];
  totalSessionTimeSec: number;
  avgSessionTimeSec: number;
  openNow: { done: number | null; total: number | null; open: number | null; d2: number; d3: number; d4: number; d5: number; at: string; blob4: string; action: string } | null;
  forecast: {
    open: number;
    ratePerHour: number | null;
    etaHours: number | null;
    basis: string;
  } | null;
};

export type ControllingByBlob4 = {
  blob4: string;
  lastTs: string | null;
  userCount: number;
  users: string[];
  latestOpen: number | null;
  latestTotal: number | null;
  forecast: {
    ratePerHour: number | null;
    etaHours: number | null;
    basis: string;
  } | null;
};

export function processControllingData(
  raw: AeRow[],
  gapMs: number,
  options?: { likelyTruncated: boolean },
): {
  rangeRows: number;
  truncated: boolean;
  byUser: Record<string, ControllingUserStats>;
  byBlob4: ControllingByBlob4[];
} {
  const rows = raw.map(parseControllingRow).filter((r) => r.ts);

  const byUser = new Map<string, RawControllingRow[]>();
  for (const r of rows) {
    const u = userLabelFromRow(r);
    if (!byUser.has(u)) byUser.set(u, []);
    byUser.get(u)!.push(r);
  }

  const stats: Record<string, ControllingUserStats> = {};

  for (const [user, urows] of byUser) {
    urows.sort(
      (a, b) => parseTs(a.ts) - parseTs(b.ts) || a.ts.localeCompare(b.ts),
    );
    const sessions = buildSessions(urows, gapMs);
    const totalSessionTimeSec = sessions.reduce(
      (s, x) => s + x.durationSec,
      0,
    );
    const last = urows[urows.length - 1];
    const prog = progressFromDoubles(
      last.d2,
      last.d3,
      last.d4,
      last.d5,
    );
    const openNow = {
      done: prog.done,
      total: prog.total,
      open: prog.open,
      d2: last.d2,
      d3: last.d3,
      d4: last.d4,
      d5: last.d5,
      at: last.ts,
      blob4: last.s_blob4,
      action: last.s_blob3,
    };
    const forecast = computeUserForecast(
      urows,
      openNow.open,
    );
    stats[user] = {
      user,
      eventCount: urows.length,
      firstTs: urows[0]?.ts ?? null,
      lastTs: last?.ts ?? null,
      sessions,
      totalSessionTimeSec,
      avgSessionTimeSec:
        sessions.length > 0
          ? totalSessionTimeSec / sessions.length
          : 0,
      openNow: urows.length ? openNow : null,
      forecast: forecast,
    };
  }

  const blobMap = new Map<string, RawControllingRow[]>();
  for (const r of rows) {
    const b = r.s_blob4.trim() || "—";
    if (!blobMap.has(b)) blobMap.set(b, []);
    blobMap.get(b)!.push(r);
  }

  const byBlob4: ControllingByBlob4[] = [];
  for (const [blob4, brows] of blobMap) {
    brows.sort(
      (a, b) => parseTs(a.ts) - parseTs(b.ts) || a.ts.localeCompare(b.ts),
    );
    const uSet = new Set(
      brows.map((x) => userLabelFromRow(x)),
    );
    const last = brows[brows.length - 1];
    const prog = progressFromDoubles(
      last.d2,
      last.d3,
      last.d4,
      last.d5,
    );
    const open = prog.open;
    const fc = computeBlobForecast(brows, open);
    byBlob4.push({
      blob4,
      lastTs: last?.ts ?? null,
      userCount: uSet.size,
      users: [...uSet].sort(),
      latestOpen: open,
      latestTotal: prog.total,
      forecast: fc,
    });
  }
  byBlob4.sort(
    (a, b) =>
      (a.latestOpen ?? 0) - (b.latestOpen ?? 0) || a.blob4.localeCompare(b.blob4),
  );

  return {
    rangeRows: rows.length,
    truncated: options?.likelyTruncated ?? false,
    byUser: stats,
    byBlob4,
  };
}

/**
 * Prognose aus Verlauf d3−d2 (offene Fahrzeuge) in der Zeit: linearer
 * Trend der letzten sinnvollen Stützstellen.
 */
function computeUserForecast(
  urows: RawControllingRow[],
  openFromLatest: number | null,
): ControllingUserStats["forecast"] {
  if (openFromLatest == null || openFromLatest <= 0) {
    return {
      open: 0,
      ratePerHour: null,
      etaHours: null,
      basis: "Kein offener Bestand laut d2/d3.",
    };
  }
  const series: { t: number; open: number }[] = [];
  for (const r of urows) {
    const p = progressFromDoubles(
      r.d2,
      r.d3,
      r.d4,
      r.d5,
    );
    if (p.open != null) {
      const t = parseTs(r.ts);
      if (t) series.push({ t, open: p.open });
    }
  }
  if (series.length < 2) {
    return {
      open: openFromLatest,
      ratePerHour: null,
      etaHours: null,
      basis: "Zu wenig Datenpunkte mit Kennzahlen d2/d3.",
    };
  }
  const lastN = series.slice(-20);
  let sumDt = 0;
  let sumDopen = 0;
  for (let i = 1; i < lastN.length; i++) {
    const dt = (lastN[i].t - lastN[i - 1].t) / 1000;
    if (dt <= 0) continue;
    const dO = lastN[i - 1].open - lastN[i].open;
    if (dO > 0) {
      sumDt += dt;
      sumDopen += dO;
    }
  }
  if (sumDt <= 0) {
    return {
      open: openFromLatest,
      ratePerHour: null,
      etaHours: null,
      basis: "Kein sichtbarer Fortschritt (offen sinkt nicht).",
    };
  }
  const ratePerSec = sumDopen / sumDt;
  if (ratePerSec <= 0) {
    return {
      open: openFromLatest,
      ratePerHour: null,
      etaHours: null,
      basis: "Letzte Messungen zeigen keinen Abbau des offenen Bestands.",
    };
  }
  const ratePerHour = ratePerSec * 3600;
  const etaSec = openFromLatest / ratePerSec;
  return {
    open: openFromLatest,
    ratePerHour,
    etaHours: etaSec / 3600,
    basis: "Trend aus letzten abnehmenden offenen (max. 20 Stützstellen).",
  };
}

function computeBlobForecast(
  rows: RawControllingRow[],
  openLatest: number | null,
): ControllingByBlob4["forecast"] {
  if (openLatest == null) {
    return { ratePerHour: null, etaHours: null, basis: "d2/d3 nicht auswertbar." };
  }
  if (openLatest <= 0) {
    return {
      ratePerHour: null,
      etaHours: 0,
      basis: "Offen = 0.",
    };
  }
  const s: { t: number; open: number }[] = [];
  for (const r of rows) {
    const p = progressFromDoubles(
      r.d2,
      r.d3,
      r.d4,
      r.d5,
    );
    if (p.open != null) {
      const t = parseTs(r.ts);
      if (t) s.push({ t, open: p.open });
    }
  }
  if (s.length < 2) {
    return {
      ratePerHour: null,
      etaHours: null,
      basis: "Zu wenig Zeitpunkte pro blob4.",
    };
  }
  const lastN = s.slice(-30);
  let sumDt = 0;
  let sumDopen = 0;
  for (let i = 1; i < lastN.length; i++) {
    const dt = (lastN[i].t - lastN[i - 1].t) / 1000;
    if (dt <= 0) continue;
    const dO = lastN[i - 1].open - lastN[i].open;
    if (dO > 0) {
      sumDt += dt;
      sumDopen += dO;
    }
  }
  if (sumDt <= 0) {
    return { ratePerHour: null, etaHours: null, basis: "Kein Rückgang offen pro blob4." };
  }
  const rps = sumDopen / sumDt;
  if (rps <= 0) {
    return { ratePerHour: null, etaHours: null, basis: "Kein Fortschritt messbar." };
  }
  return {
    ratePerHour: rps * 3600,
    etaHours: openLatest / rps / 3600,
    basis: "Pro blob4 (alle Nutzer) aggregierter Rückgang offen.",
  };
}

export function defaultControllingRange(): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now.getTime() + 60_000);
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const f = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);
  return { from: f(from), to: f(to) };
}
