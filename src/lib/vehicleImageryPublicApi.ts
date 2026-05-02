export const VEHICLE_IMAGERY_API = "/api/databases/vehicle-imagery";

/** Control Platform: D1-Tabelle `vehicleimagery_controlling_storage` (ohne `genehmigt`). */
export const VEHICLE_IMAGERY_CONTROLLING_API =
  "/api/databases/vehicle-imagery-controlling";

/** Wenn die API keine `cdnBase` liefert, gleicher Host wie Worker-Default. */
export const VEHICLE_IMAGERY_CONTROLLING_CDN_FALLBACK =
  "https://vehicleimagery-controlling.vehicleimagery.com";

export const VEHICLE_IMAGERY_STATUS_API =
  "/api/databases/vehicle-imagery-status";

export type VehicleImageryRowLike = {
  format: string | null;
  resolution: string | null;
  marke: string | null;
  modell: string | null;
  jahr: number | null;
  body: string | null;
  trim: string | null;
  farbe: string | null;
};

/**
 * Aggregierte `controll_status`-Counts pro Fahrzeug für den aktuellen
 * `views_mode`. Wird nur von der Controlling-Liste pro Row gefüllt.
 *
 * `total` = `done + errored + transferred + inProgress + pending` (Server-Aggregat).
 */
export type ControllStatusCountsForRow = {
  done: number;
  errored: number;
  transferred: number;
  inProgress: number;
  pending: number;
  total: number;
};

export type VehicleImageryPublicRow = VehicleImageryRowLike & {
  id: number;
  views: string | null;
  sonstiges: string | null;
  active: number | null;
  last_updated: string | null;
  /** Nur bei `vehicleimagery_public_storage`; Controlling-Zeilen ohne dieses Feld. */
  genehmigt?: number | null;
  /** Nur Controlling-Liste; Aggregat über `controll_status` für aktuellen `views_mode`. */
  controllStatusCounts?: ControllStatusCountsForRow;
};

export type VehicleImageryListResponse = {
  rows: VehicleImageryPublicRow[];
  total: number;
  offset: number;
  limit: number;
  cdnBase: string;
  /** Anhängen an jede Bild-URL: `?key=<image_url_secret>` (vom Worker). */
  imageUrlQuery: string;
};

/** Sortier-Optionen der Controlling-Liste (Whitelist; muss zum Server passen). */
export const CONTROLL_LIST_SORT_OPTIONS = [
  "default",
  "id_desc",
  "id_asc",
  "done_desc",
  "errored_desc",
  "transferred_desc",
  "inProgress_desc",
  "pending_desc",
  "total_desc",
] as const;
export type ControllListSortOption =
  (typeof CONTROLL_LIST_SORT_OPTIONS)[number];

/** Status-Filter der Controlling-Liste (Whitelist; muss zum Server passen). */
export const CONTROLL_LIST_STATUS_FILTERS = [
  "any",
  "errored",
  "transferred",
  "done",
  "inProgress",
  "pending",
  "none",
] as const;
export type ControllListStatusFilter =
  (typeof CONTROLL_LIST_STATUS_FILTERS)[number];

/** Eintrag aus `controll_status` (Controlling-Tabelle) für ein Fahrzeug. */
export type ControllStatusRow = {
  id: number;
  vehicle_id: number;
  /** Token wie in der `views`-Spalte, z. B. `front`, `rear#trp`, `front#skaliert_weiß`. */
  view_token: string;
  /** `correction` | `scaling` (weitere möglich). */
  mode: string;
  /** `correct` | `regen_vertex` | `regen_batch` | `delete` (weitere möglich). */
  status: string;
  updated_at: string | null;
  key: string | null;
  /** SQL-Spalte `"check"`; `0`/`1`. */
  check: number;
};

/** GET ?id= (ein Fahrzeug) bzw. PUT-Antwort */
export type VehicleImageryOneResponse = {
  row: VehicleImageryPublicRow;
  cdnBase: string;
  imageUrlQuery: string;
  /** Nur bei der Controlling-API gefüllt; Public-API liefert kein `statuses`. */
  statuses?: ControllStatusRow[];
};

export type VehicleImageryListParams = {
  q: string;
  limit: number;
  offset: number;
  active: "all" | "0" | "1";
  /** Control Platform / views-Spalte: korrektur | transparenz | skalierung | schatten */
  views_mode?: string;
  /** Weglassen = kein Filter (alle). */
  genehmigt?: "all" | "0" | "1";
  filter_id?: string;
  marke?: string;
  modell?: string;
  jahr?: string;
  body?: string;
  trim?: string;
  farbe?: string;
  resolution?: string;
  format?: string;
  /** YYYY-MM-DD */
  updated_from?: string;
  /** YYYY-MM-DD */
  updated_to?: string;
  /** Sortierung; nur von der Controlling-Liste verwertet. */
  sort?: ControllListSortOption;
  /** Status-Filter; nur von der Controlling-Liste verwertet. */
  status_filter?: ControllListStatusFilter;
};

export function vehicleImageryListUrl(
  p: VehicleImageryListParams,
  apiPath: string = VEHICLE_IMAGERY_API,
): string {
  const u = new URL(apiPath, "https://x");
  u.searchParams.set("limit", String(p.limit));
  u.searchParams.set("offset", String(p.offset));
  if (p.q.trim()) u.searchParams.set("q", p.q.trim());
  if (p.active !== "all") u.searchParams.set("active", p.active);
  const vm = (p.views_mode ?? "").trim().toLowerCase();
  if (vm) u.searchParams.set("views_mode", vm);
  if (p.genehmigt && p.genehmigt !== "all") {
    u.searchParams.set("genehmigt", p.genehmigt);
  }
  const setIf = (key: string, v: string | undefined) => {
    const t = (v ?? "").trim();
    if (t) u.searchParams.set(key, t);
  };
  setIf("filter_id", p.filter_id);
  setIf("marke", p.marke);
  setIf("modell", p.modell);
  setIf("jahr", p.jahr);
  setIf("body", p.body);
  setIf("trim", p.trim);
  setIf("farbe", p.farbe);
  setIf("resolution", p.resolution);
  setIf("format", p.format);
  setIf("updated_from", p.updated_from);
  setIf("updated_to", p.updated_to);
  if (p.sort && p.sort !== "default") u.searchParams.set("sort", p.sort);
  if (p.status_filter && p.status_filter !== "any") {
    u.searchParams.set("status_filter", p.status_filter);
  }
  return u.pathname + u.search;
}

export function vehicleImageryOneUrl(
  id: number,
  apiPath: string = VEHICLE_IMAGERY_API,
): string {
  const u = new URL(apiPath, "https://x");
  u.searchParams.set("id", String(id));
  return u.pathname + u.search;
}

export async function putVehicleImageryActive(
  id: number,
  active: 0 | 1,
): Promise<VehicleImageryOneResponse> {
  const res = await fetch(VEHICLE_IMAGERY_API, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id, active }),
  });
  const j = (await res.json().catch(() => ({}))) as
    | VehicleImageryOneResponse
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      (j as { error?: string }).error || `HTTP ${res.status}`,
    );
  }
  return j as VehicleImageryOneResponse;
}

export type VehicleImageryStatusRow = {
  id: number;
  marke: string | null;
  modell: string | null;
  jahr: number | null;
  body: string | null;
  trim: string | null;
  farbe: string | null;
  resolution: string | null;
  format: string | null;
  views: string | null;
  last_updated: string | null;
};

export type VehicleImageryStatusResponse = {
  activeRowCount: number;
  missingFarbeCount: number;
  missingFarbeSample: VehicleImageryStatusRow[];
  viewCoverage: { name: string; count: number; pct: number }[];
  avgDistinctViewsPerRow: number;
};
