export const VEHICLE_IMAGERY_API = "/api/databases/vehicle-imagery";

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

export type VehicleImageryPublicRow = VehicleImageryRowLike & {
  id: number;
  views: string | null;
  sonstiges: string | null;
  active: number | null;
  last_updated: string | null;
  genehmigt: number | null;
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

/** GET ?id= (ein Fahrzeug) bzw. PUT-Antwort */
export type VehicleImageryOneResponse = {
  row: VehicleImageryPublicRow;
  cdnBase: string;
  imageUrlQuery: string;
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
};

export function vehicleImageryListUrl(p: VehicleImageryListParams): string {
  const u = new URL(VEHICLE_IMAGERY_API, "https://x");
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
  return u.pathname + u.search;
}

export function vehicleImageryOneUrl(id: number): string {
  const u = new URL(VEHICLE_IMAGERY_API, "https://x");
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
