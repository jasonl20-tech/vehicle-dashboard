import type { Range } from "./customerApi";

export type AnalyticsSession = {
  start: string;
  end: string;
  events: number;
  actions: number;
  durationSec: number;
  modes: string[];
  ips: string[];
};

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
  processedTotal: number;
};

export type RemainingByMode = {
  mode: string;
  latestOpen: number | null;
  latestTs: string | null;
  minOpen: number | null;
  maxOpen: number | null;
  processed: number;
  added: number;
  processedPerHour: number | null;
  etaHours: number | null;
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
    rangeDays: number;
    rangeSpanSec: number;
    eventsPerSec: number | null;
    eventsPerMinute: number | null;
    actionsPerSec: number | null;
    actionsPerMinute: number | null;
    actionsPerActiveHour: number | null;
    eventsPerActiveHour: number | null;
    processedTotal: number;
    vehiclesPerActiveHour: number | null;
    vehiclesPerCalendarDay: number | null;
    vehiclesPerCalendarHour: number | null;
    totalRemaining: number | null;
    etaHoursActive: number | null;
    etaHoursCalendar: number | null;
    primaryUserAgent: string | null;
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
    mode: string;
    events: number;
    actions: number;
    sessions: number;
    activeSec: number;
    actionsPerHour: number | null;
    eventsPerHour: number | null;
  }>;
  remainingByMode: RemainingByMode[];
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
  timeline: Array<{
    bucket: string;
    events: number;
    actions: number;
    processed: number;
    avgLatencyMs: number | null;
  }>;
  dailyActivity: Array<{
    day: string;
    dayMs: number;
    activeSec: number;
    sessions: number;
    events: number;
    actions: number;
    processed: number;
    avgLatencyMs: number | null;
  }>;
  topButtonNames: string[];
  buttonsTimeline: Array<{
    bucket: string;
    bucketMs: number;
    avgLatencyMs: number | null;
    counts: Record<string, number>;
  }>;
  latencyPoints: Array<{ ts: string; ms: number }>;
  sessions: AnalyticsSession[];
  vehicleLatency: Array<{
    label: string;
    actions: number;
    avgLatencyMs: number | null;
    minLatencyMs: number | null;
    maxLatencyMs: number | null;
  }>;
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
    lastTs: string | null;
    users: Array<{ user: string; events: number; actions: number }>;
    views: Array<{ view: string; count: number }>;
  }>;
};

export type UserAnalyticsResponse = {
  range: { from: string; to: string };
  sessionGapMinutes: number;
  rowLimit: number;
  ae: {
    fromTable: string;
    fromMode: "key_analytics_filter" | "dedicated_table";
    binding: "primary" | "secondary";
  };
  rangeRows: number;
  truncated: boolean;
  validDoubleFromTs: string;
  excludedTs: string;
  users: UserListEntry[];
  detail: DetailReport | null;
};

export function userAnalyticsApiUrl(
  range: Range,
  opts: {
    user?: string | null;
    ip?: string | null;
    aggregate?: boolean;
    gapMinutes?: number;
    limit?: number;
  } = {},
): string {
  const p = new URLSearchParams();
  p.set("from", range.from);
  p.set("to", range.to);
  if (opts.user) p.set("user", opts.user);
  if (opts.ip) p.set("ip", opts.ip);
  if (opts.aggregate) p.set("aggregate", "1");
  if (opts.gapMinutes != null) p.set("gapMinutes", String(opts.gapMinutes));
  if (opts.limit != null) p.set("limit", String(opts.limit));
  return `/api/intern-analytics/user-analytics?${p.toString()}`;
}
