/**
 * Frontend-Typen + URL-Helfer für die „Car Database" (neue `fahrzeugliste`-DB).
 */

export const CAR_DATABASE_API = "/api/databases/car-database";

/**
 * Öffentlicher Bild-Host für die `r2_key`s des NEUEN Systems (z. B. `source/01K…`).
 *
 * NOCH NICHT GESETZT: Die neuen Bilder liegen hinter einer gated Auslieferung
 * (`images.vehicleimagery.com` antwortet öffentlich mit 403); es gibt aktuell
 * keine öffentliche URL, über die man ein `source/<id>` direkt laden kann.
 * Sobald der korrekte Host/Zugang feststeht (von Jason), hier eintragen — dann
 * erscheinen die Thumbnails automatisch. Bis dahin: sauberer Platzhalter.
 */
export const CAR_DB_IMAGE_CDN: string = "";

/**
 * Stark verkleinertes Thumbnail aus dem `r2_key` (schnelles Laden, via
 * Cloudflare Image Resizing). Liefert `null`, solange kein Bild-Host gesetzt
 * ist → die UI zeigt dann einen Platzhalter statt fehlschlagender Anfragen.
 */
export function carThumbUrl(
  r2Key: string | null | undefined,
  width = 96,
): string | null {
  if (!r2Key || !CAR_DB_IMAGE_CDN) return null;
  const base = CAR_DB_IMAGE_CDN.replace(/\/$/, "");
  const key = String(r2Key).replace(/^\/+/, "");
  const src = `${base}/${key}`;
  return `${base}/cdn-cgi/image/width=${width},quality=55,format=auto,fit=contain/${encodeURI(src)}`;
}

export type CarDatabaseOverview = {
  empty: boolean;
  reason?: string;
  kpis: {
    vehicles: number;
    images: number;
    aktiv: number;
    offen: number;
    fehler: number;
    hold: number;
    nicht_gerendert: number;
  };
  stages: {
    gesamt: number;
    kontrolliert: number;
    ausgeschnitten: number;
    skaliert: number;
    aktiv: number;
  };
  openByView: { view: string; offen: number; gesamt: number }[];
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
  images: number;
  aktiv: number;
  viewsTotal: number;
  viewsOffen: number;
  offeneViews: string[];
  fehler: number;
  hold: number;
  nichtGerendert: number;
  lastUpdated: string | null;
  thumbKey: string | null;
};

export type CarListResponse = {
  empty: boolean;
  reason?: string;
  rows: CarRow[];
  total: number;
  limit?: number;
  offset?: number;
};

export const CAR_STATUS_FILTERS = [
  "all",
  "open",
  "done",
  "error",
  "hold",
  "not_rendered",
] as const;
export type CarStatusFilter = (typeof CAR_STATUS_FILTERS)[number];

export const CAR_STATUS_LABELS: Record<CarStatusFilter, string> = {
  all: "Alle",
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
