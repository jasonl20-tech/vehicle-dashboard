/**
 * Frontend-Typen + URL-Helfer für die „Car Database" (neue `fahrzeugliste`-DB).
 */

export const CAR_DATABASE_API = "/api/databases/car-database";

/** Server-Proxy, der das Thumbnail über die Kunden-API holt + verkleinert ausliefert. */
export const CAR_IMAGE_PROXY = "/api/databases/car-image";

/** Server-Proxy für die Markenliste (`/api/brands` der Kunden-API, gecacht). */
export const CAR_BRANDS_API = "/api/databases/car-brands";
export type BrandsResponse = { brands: string[] };

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
  opts?: {
    view?: string;
    width?: number;
    height?: number | null;
    format?: "png" | "jpeg" | "webp" | "avif";
    shadow?: boolean;
    transparent?: boolean;
    /** Vorgefertigte Auflösungsstufe (z. B. "default", "1K", "2K", "4K"). */
    resolution?: string;
    /** Fahrzeug am Boden „verankern" (nicht schwebend). */
    ground?: boolean;
    /** Bild horizontal spiegeln (neues API-Feature). */
    mirroring?: boolean;
    /**
     * Öffentlicher Demo-Link-Token (`dl_…`). Wird als `dt` an den Proxy gehängt,
     * damit ein Kunde ohne Dashboard-Login Bilder im erlaubten Scope laden kann.
     */
    demoToken?: string;
  },
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
  // Optionale explizite Höhe (Breite & Höhe anfragbar).
  if (opts?.height) u.searchParams.set("h", String(opts.height));
  // Ausgabeformat — nur setzen, wenn ≠ png (hält bestehende Thumbnail-URLs
  // und damit deren Cache-Keys stabil).
  if (opts?.format && opts.format !== "png")
    u.searchParams.set("format", opts.format);
  // Schatten-Variante.
  if (opts?.shadow) u.searchParams.set("shadow", "1");
  // Echtes Freisteller-PNG (Hintergrund von der Kunden-API entfernt) anfragen.
  if (opts?.transparent) u.searchParams.set("transparent", "1");
  // Vorgefertigte Auflösung (nur setzen, wenn ≠ default → stabile Default-URLs).
  if (opts?.resolution && opts.resolution !== "default")
    u.searchParams.set("resolution", opts.resolution);
  // Fahrzeug am Boden verankern.
  if (opts?.ground) u.searchParams.set("ground", "1");
  // Horizontale Spiegelung.
  if (opts?.mirroring) u.searchParams.set("mirroring", "1");
  // Demo-Link-Token (öffentlicher Kunden-Showcase).
  if (opts?.demoToken) u.searchParams.set("dt", opts.demoToken);
  return u.pathname + u.search;
}

export type CarDatabaseOverview = {
  empty: boolean;
  reason?: string;
  kpis: {
    cars: number;
    variants: number;
    images: number;
    marken: number;
    aktiv: number;
    fehler: number;
    hold: number;
    nicht_gerendert: number;
  };
  completeness: {
    aussen_komplett: number;
    aussen_unvollstaendig: number;
    innen_komplett: number;
    innen_teilweise: number;
    innen_keine: number;
    mit_transparenz: number;
    ohne_transparenz: number;
    mit_schatten: number;
    ohne_schatten: number;
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
  viewsTotal: number;
  aussen: number;
  innen: number;
  hasTrp: boolean;
  hasShadow: boolean;
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
  "incomplete_int",
  "no_transparent",
  "no_shadow",
  "error",
  "hold",
  "not_rendered",
] as const;
export type CarStatusFilter = (typeof CAR_STATUS_FILTERS)[number];

export const CAR_STATUS_LABELS: Record<CarStatusFilter, string> = {
  all: "Alle",
  incomplete_ext: "Außen unvollständig (<8)",
  incomplete_int: "Innen teilweise (1/2)",
  no_transparent: "Ohne Transparenz",
  no_shadow: "Ohne Schatten",
  error: "Fehler",
  hold: "On Hold",
  not_rendered: "Nicht gerendert",
};

/** Sortier-Optionen für die Liste. */
export const CAR_SORTS = [
  "marke",
  "jahr_desc",
  "jahr_asc",
  "aussen_asc",
  "bilder_desc",
  "updated_desc",
] as const;
export type CarSort = (typeof CAR_SORTS)[number];

export const CAR_SORT_LABELS: Record<CarSort, string> = {
  marke: "Marke, Modell, Jahr ↑ (Standard)",
  jahr_desc: "Jahr (neueste)",
  jahr_asc: "Jahr (älteste)",
  aussen_asc: "Außen (unvollständige zuerst)",
  bilder_desc: "Bilder (meiste)",
  updated_desc: "Zuletzt aktualisiert",
};

export type CarListParams = {
  q?: string;
  marke?: string;
  modell?: string;
  body?: string;
  trim?: string;
  farbe?: string;
  farben?: string[];
  format?: string;
  resolution?: string;
  view?: string;
  status?: CarStatusFilter;
  jahr?: number | string;
  jahrMin?: number | string;
  jahrMax?: number | string;
  viewsMin?: number | string;
  viewsMax?: number | string;
  updatedFrom?: string;
  updatedTo?: string;
  sort?: CarSort;
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
  set("modell", params.modell);
  set("body", params.body);
  set("trim", params.trim);
  set("farbe", params.farbe);
  if (params.farben && params.farben.length)
    u.searchParams.set("farben", params.farben.join(","));
  set("format", params.format);
  set("resolution", params.resolution);
  set("view", params.view);
  if (params.status && params.status !== "all") set("status", params.status);
  set("jahr", params.jahr);
  set("jahr_min", params.jahrMin);
  set("jahr_max", params.jahrMax);
  set("views_min", params.viewsMin);
  set("views_max", params.viewsMax);
  set("updated_from", params.updatedFrom);
  set("updated_to", params.updatedTo);
  if (params.sort && params.sort !== "marke") set("sort", params.sort);
  set("limit", params.limit);
  set("offset", params.offset);
  return u.pathname + u.search;
}

// --- Galerie ---

export type GalleryRow = {
  marke: string;
  modell: string;
  jahr: number;
  body: string;
  trim: string;
  farbe: string;
  farben: number;
};

export type GalleryResponse = {
  rows: GalleryRow[];
  count: number;
};

export type GalleryParams = {
  marke?: string;
  jahrMin?: number | string;
  jahrMax?: number | string;
  view?: string;
  random?: boolean;
  limit?: number;
  /** Nur Cache-Buster für „Würfeln" (neue Zufallsauswahl). */
  seed?: number;
};

export function carDatabaseGalleryUrl(params: GalleryParams): string {
  const u = new URL(CAR_DATABASE_API, "https://x");
  u.searchParams.set("mode", "gallery");
  const set = (k: string, v: string | number | undefined | null) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (s) u.searchParams.set(k, s);
  };
  set("marke", params.marke);
  set("jahr_min", params.jahrMin);
  set("jahr_max", params.jahrMax);
  set("view", params.view);
  if (params.random === false) u.searchParams.set("random", "0");
  set("limit", params.limit);
  set("seed", params.seed);
  return u.pathname + u.search;
}

/** Auswählbare Ansichten für die Galerie (Außen + Innen), mit Labels. */
export const GALLERY_VIEWS: { value: string; label: string }[] = [
  { value: "front_left", label: "Vorne links" },
  { value: "front_right", label: "Vorne rechts" },
  { value: "front", label: "Vorne" },
  { value: "rear", label: "Hinten" },
  { value: "rear_left", label: "Hinten links" },
  { value: "rear_right", label: "Hinten rechts" },
  { value: "left", label: "Links" },
  { value: "right", label: "Rechts" },
  { value: "dashboard", label: "Cockpit" },
  { value: "center_console", label: "Mittelkonsole" },
];

/** Auswählbare Farben (Galerie). „" = jeweils Auto-Standard. */
export const GALLERY_COLORS: { value: string; label: string }[] = [
  { value: "", label: "Auto-Standard" },
  { value: "default", label: "Default" },
  { value: "black", label: "Schwarz" },
  { value: "white", label: "Weiß" },
  { value: "blue", label: "Blau" },
  { value: "orange", label: "Orange" },
  { value: "wine_red", label: "Weinrot" },
];
