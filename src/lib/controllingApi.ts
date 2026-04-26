import type { Range } from "./customerApi";

export type ControllingBlob4Mode = "nonempty" | "hex32" | "all";

export function controllingApiUrl(
  range: Range,
  opts: {
    gapMinutes: number;
    blob4: ControllingBlob4Mode;
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
  modes: string[];
};

export type ControllingPerModeOfUser = {
  mode: string;
  events: number;
  processed: number;
  perHour: number | null;
  activeSec: number;
};

export type ControllingPerUserInMode = {
  user: string;
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
  modes: string[];
  primaryOs: string | null;
  lastIp: string | null;
  topButtons: Array<{ mode: string; button: string; count: number }>;
  perMode: ControllingPerModeOfUser[];
  totalProcessed: number;
  processedPerHour: number | null;
  perActiveMinute: number | null;
};

export type ControllingByMode = {
  mode: string;
  events: number;
  uniqueUsers: number;
  users: string[];
  firstTs: string | null;
  lastTs: string | null;
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
  topButtons: Array<{ button: string; count: number }>;
  byUser: ControllingPerUserInMode[];
};

export type ControllingBucket = {
  bucket: string;
  events: number;
  activeUsers: number;
  processed: number;
  added: number;
};

export type ControllingGlobal = {
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
  activeUserSec: number;
};

export type ControllingResponse = {
  dataset: string;
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
  global: ControllingGlobal;
  byUser: ControllingUserStats[];
  byMode: ControllingByMode[];
  timeline: ControllingBucket[];
};
