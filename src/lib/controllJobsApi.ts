const BASE = "/api/intern-analytics/controll-jobs";

export type ControllJobCheck = "0" | "1" | "2" | "3" | "all";

export type ControllJobRow = {
  id: number;
  vehicle_id: number;
  view_token: string;
  mode: string;
  status: string;
  updated_at: string;
  key: string | null;
  job_check: number;
};

export type ControllJobsListResponse = {
  rows: ControllJobRow[];
  total: number;
  offset: number;
  limit: number;
  checkCounts: Record<string, number>;
};

export function controllJobsListUrl(
  p: {
    check?: ControllJobCheck;
    vehicleId?: string;
    q: string;
    limit: number;
    offset: number;
  },
): string {
  const u = new URL(BASE, "https://x");
  u.searchParams.set("check", p.check ?? "all");
  u.searchParams.set("limit", String(p.limit));
  u.searchParams.set("offset", String(p.offset));
  if (p.q.trim()) u.searchParams.set("q", p.q.trim());
  if (p.vehicleId?.trim()) {
    u.searchParams.set("vehicle_id", p.vehicleId.trim());
  }
  return u.pathname + u.search;
}
