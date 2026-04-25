import type { Range } from "./customerApi";

export type ControllingBlob4Mode = "nonempty" | "hex32";

export function controllingApiUrl(
  range: Range,
  opts: {
    gapMinutes: number;
    blob4: ControllingBlob4Mode;
    /** max. Zeilen aus Analytics Engine */
    limit?: number;
  },
): string {
  const p = new URLSearchParams();
  p.set("from", range.from);
  p.set("to", range.to);
  p.set("gapMinutes", String(opts.gapMinutes));
  p.set("blob4", opts.blob4);
  if (opts.limit != null) p.set("limit", String(opts.limit));
  return `/api/intern-analytics/controlling?${p.toString()}`;
}

export type ControllingSession = {
  start: string;
  end: string;
  events: number;
  durationSec: number;
  gapStartSec: number | null;
};

export type ControllingUserStats = {
  user: string;
  eventCount: number;
  firstTs: string | null;
  lastTs: string | null;
  sessions: ControllingSession[];
  totalSessionTimeSec: number;
  avgSessionTimeSec: number;
  openNow: {
    done: number | null;
    total: number | null;
    open: number | null;
    d2: number;
    d3: number;
    d4: number;
    d5: number;
    at: string;
    blob4: string;
    action: string;
  } | null;
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
  };
};

export type ControllingRawRow = {
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

export type ControllingResponse = {
  dataset: string;
  /** Wie in der Kunden-API: z. B. key_analytics + Spalte dataset. */
  ae?: {
    fromTable: string;
    fromMode: "key_analytics_filter" | "dedicated_table";
    binding: "primary" | "secondary";
  };
  range: { from: string; to: string };
  sessionGapMinutes: number;
  blob4Mode: ControllingBlob4Mode;
  rowLimit: number;
  rangeRows: number;
  truncated: boolean;
  byUser: Record<string, ControllingUserStats>;
  byBlob4: ControllingByBlob4[];
  rawTail: ControllingRawRow[];
  meta?: { beschreibung: string };
};
