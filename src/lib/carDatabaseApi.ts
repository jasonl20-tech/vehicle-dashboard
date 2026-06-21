/**
 * Frontend-Typen + URL-Helfer für die „Car Database" (neue `fahrzeugliste`-DB).
 */

export const CAR_DATABASE_API = "/api/databases/car-database";

/** Server-Proxy, der das Thumbnail über die Kunden-API holt + verkleinert ausliefert. */
export const CAR_IMAGE_PROXY = "/api/databases/car-image";

/**
 * Thumbnail-URL für ein Auto. Zeigt auf den Dashboard-Proxy
 * (`/api/databases/car-image`), der das Bild über die bestehende Kunden-API
 * (mit internem Key) holt und verkleinert ausliefert.
 *
 * Identifiziert wird das Auto über marke/modell/jahr (+ body/trim/farbe), NICHT
 * über den neuen `r2_key` — denn die Kunden-API bedient aktuell noch das alte
 * System. Sobald sie aufs neue System umgestellt ist, liefert derselbe Proxy
 * automatisch die neuen Bilder. Fehlt das Bild → Proxy gibt 404 → Platzhalter.
 */
export function carThumbApiUrl(
  car: {
    marke?: string | null;
    modell?: string | null;
    jahr?: number | string | null;
    body?: string | null;
    trim?: string | null;
    farbe?: string | null;
  },
  opts?: { view?: string; width?: number },
): string | null {
  if (!car || !car.marke || !car.modell || !car.jahr) return null;
  const u = new URL(CAR_IMAGE_PROXY, "https://x");
  u.searchParams.set("marke", String(car.marke));
  u.searchParams.set("modell", String(car.modell));
  u.searchParams.set("jahr", String(car.jahr));
  if (car.body) u.searchParams.set("body", String(car.body));
  if (car.trim) u.searchParams.set("trim", String(car.trim));
  if (car.farbe) u.searchParams.set("farbe", String(car.farbe));
  u.searchParams.set("view", opts?.view || "front_right");
  u.searchParams.set("w", String(opts?.width ?? 160));
  return u.pathname + u.search;
}

export type CarDatabaseOverview = {
  empty: boolean;
  reason?: string;
  kpis: {
    cars: number;
    variants: number;
    images: number;
    aktiv: number;
    offen: number;
    fehler: number;
    hold: number;
    nicht_gerendert: number;
    aussen_komplett: number;
    aussen_unvollstaendig: number;
  };
  stages: {
    gesamt: number;
    kontrolliert: number;
    ausgeschnitten: number;
    skaliert: number;
    aktiv: number;
  };
  exteriorCars: number;
  missingByView: { view: string; fehlt: number; have: number }[];
  topBrands: {
    marke: string;
    images: number;
    vehicles: number;
    aktiv: number;
  }[];
};

export type CarRow = {
  marke: string;
  modell: string;
  jahr: number;
  body: string;
  trim: string;
  farbe: string;
  farben: number;
  images: number;
  aktiv: number;
  viewsTotal: number;
  aussen: number;
  viewsOffen: number;
  offeneViews: string[];
  fehler: number;
  hold: number;
  nichtGerendert: number;
  lastUpdated: string | null;
};

export type CarListResponse = {
  empty: boolean;
  reason?: string;
  rows: CarRow[];
  total: number;
  limit?: number;
  offset?: number;
};

export type CarDetailStatus =
  | "done"
  | "open"
  | "error"
  | "hold"
  | "not_rendered";

export type CarDetailColor = {
  farbe: string;
  images: number;
  aktiv: number;
  viewsTotal: number;
  viewsOffen: number;
};

export type CarDetailView = {
  view: string;
  images: number;
  aktiv: number;
  fehler: number;
  hold: number;
  notRendered: number;
  status: CarDetailStatus;
  formats: string[];
  resolutions: string[];
  hohe: number | null;
  shadow: boolean;
  transparent: boolean;
  lastUpdated: string | null;
};

export type CarDetailResponse = {
  empty: boolean;
  car: {
    marke: string;
    modell: string;
    jahr: number;
    body: string;
    trim: string;
  };
  colors: CarDetailColor[];
  selectedFarbe: string;
  views: CarDetailView[];
};

export type CarDetailParams = {
  marke: string;
  modell: string;
  jahr: number | string;
  body?: string;
  trim?: string;
  farbe?: string;
};

export function carDatabaseDetailUrl(params: CarDetailParams): string {
  const u = new URL(CAR_DATABASE_API, "https://x");
  u.searchParams.set("mode", "detail");
  u.searchParams.set("marke", String(params.marke));
  u.searchParams.set("modell", String(params.modell));
  u.searchParams.set("jahr", String(params.jahr));
  u.searchParams.set("body", String(params.body ?? ""));
  u.searchParams.set("trim", String(params.trim ?? ""));
  if (params.farbe) u.searchParams.set("farbe", String(params.farbe));
  return u.pathname + u.search;
}

export const CAR_STATUS_FILTERS = [
  "all",
  "incomplete_ext",
  "open",
  "done",
  "error",
  "hold",
  "not_rendered",
] as const;
export type CarStatusFilter = (typeof CAR_STATUS_FILTERS)[number];

export const CAR_STATUS_LABELS: Record<CarStatusFilter, string> = {
  all: "Alle",
  incomplete_ext: "Außen unvollständig (<8)",
  open: "Offen",
  done: "Fertig",
  error: "Fehler",
  hold: "On Hold",
  not_rendered: "Nicht gerendert",
};

export type CarListParams = {
  q?: string;
  marke?: string;
  farbe?: string;
  format?: string;
  view?: string;
  status?: CarStatusFilter;
  limit?: number;
  offset?: number;
};

export function carDatabaseOverviewUrl(): string {
  return `${CAR_DATABASE_API}?mode=overview`;
}

export function carDatabaseListUrl(params: CarListParams): string {
  const u = new URL(CAR_DATABASE_API, "https://x");
  const set = (k: string, v: string | number | undefined | null) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (s) u.searchParams.set(k, s);
  };
  set("q", params.q);
  set("marke", params.marke);
  set("farbe", params.farbe);
  set("format", params.format);
  set("view", params.view);
  if (params.status && params.status !== "all") set("status", params.status);
  set("limit", params.limit);
  set("offset", params.offset);
  return u.pathname + u.search;
}
