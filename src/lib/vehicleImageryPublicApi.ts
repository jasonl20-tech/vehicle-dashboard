export const VEHICLE_IMAGERY_API = "/api/databases/vehicle-imagery";

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
};

export type VehicleImageryListResponse = {
  rows: VehicleImageryPublicRow[];
  total: number;
  offset: number;
  limit: number;
  cdnBase: string;
  hasImageUrlSecret?: boolean;
};

export function vehicleImageryListUrl(p: {
  q: string;
  limit: number;
  offset: number;
  active: "all" | "0" | "1";
}): string {
  const u = new URL(VEHICLE_IMAGERY_API, "https://x");
  u.searchParams.set("limit", String(p.limit));
  u.searchParams.set("offset", String(p.offset));
  if (p.q.trim()) u.searchParams.set("q", p.q.trim());
  if (p.active !== "all") u.searchParams.set("active", p.active);
  return u.pathname + u.search;
}
