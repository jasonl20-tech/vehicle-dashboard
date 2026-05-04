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

export type ControllJobsResetResponse = {
  changed: number;
  from: 1 | 3;
  to: 0;
};

/**
 * Setzt alle Zeilen aus `controll_status` mit `"check" = from` auf `0` zurück.
 * Erlaubt sind nur `from = 1` (In Arbeit) und `from = 3` (Fehler).
 */
export async function resetControllJobsCheck(
  from: 1 | 3,
): Promise<ControllJobsResetResponse> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action: "reset-check", from }),
  });
  const j = (await res.json().catch(() => ({}))) as Partial<
    ControllJobsResetResponse
  > & { error?: string };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return {
    changed: j.changed ?? 0,
    from,
    to: 0,
  };
}

export type ControllJobsDeleteResponse = {
  deleted: number;
  from: 1 | 3;
};

/**
 * Löscht alle Zeilen aus `controll_status` mit `"check" = from`.
 * Erlaubt sind nur `from = 1` und `from = 3`.
 */
export async function deleteControllJobsCheck(
  from: 1 | 3,
): Promise<ControllJobsDeleteResponse> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action: "delete-check", from }),
  });
  const j = (await res.json().catch(() => ({}))) as Partial<
    ControllJobsDeleteResponse
  > & { error?: string };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return {
    deleted: j.deleted ?? 0,
    from,
  };
}
