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
  /** Nur Controlling: 1, wenn ein identisches Auto bereits live in der Public-API existiert. */
  already_public?: number | null;
  /** Nur Controlling: id des Live-Zwillings in `vehicleimagery_public_storage` (falls vorhanden). */
  public_id?: number | null;
  /** Nur Controlling: 1, wenn aktuell noch eine Generierung läuft (check IN 0,1,7,8). */
  is_running?: number | null;
  /** Nur Controlling: 1, wenn die Innenansichten kontrolliert sind (mode=inside, correct). */
  inside_controlled?: number | null;
  /** Nur Controlling: 1, wenn überhaupt eine Ansicht kontrolliert ist (status=correct). */
  any_controlled?: number | null;
};

export type VehicleImageryListResponse = {
  rows: VehicleImageryPublicRow[];
  total: number;
  /**
   * Nur **Controlling**-Liste (`/vehicle-imagery-controlling`): wie viele Einträge im
   * aktuellen Ansichts-Modus **noch nicht fertig** sind (wie Filter „offen“:
   * mindestens eine erwartete Ansicht weder done noch übertragen, oder ein Fehler).
   * Bei `status_filter=all` gilt „Übrig“ bezogen auf dieselbe Basis-Suche ohne
   * Status-Teilfilter; bei `open` gilt `remainingTotal === total`; bei `done`
   * ist es `0`. Andere Datenbank-Endpoints setzen das Feld nicht.
   */
  remainingTotal?: number;
  offset: number;
  limit: number;
  cdnBase: string;
  /** Anhängen an jede Bild-URL: `?key=<image_url_secret>` (vom Worker). */
  imageUrlQuery: string;
};

/** Sortier-Optionen der Controlling-Liste (Whitelist; muss zum Server passen). */
export const CONTROLL_LIST_SORT_OPTIONS = [
  "default",
  "not_done_desc",
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

/**
 * Status-Filter der Controlling-Liste (Whitelist; muss zum Server passen).
 *
 * - `open`: Fahrzeuge, bei denen im aktuellen Modus mindestens eine Ansicht
 *   noch nicht `done`/`übertragen` ist oder ein `errored`-Status existiert.
 *   Server-Default; bildet den primären Arbeits-Workflow ab.
 * - `all`: alles (auch Fahrzeuge ohne erwartete Views in diesem Modus).
 * - `done`: nur Fahrzeuge, bei denen im aktuellen Modus ALLE erwarteten
 *   Views fertig sind und kein `errored`-Status existiert.
 */
export const CONTROLL_LIST_STATUS_FILTERS = [
  "open",
  "open_ext_only",
  "open_int",
  "all",
  "done",
] as const;
export type ControllListStatusFilter =
  (typeof CONTROLL_LIST_STATUS_FILTERS)[number];

export const CONTROLL_LIST_STATUS_FILTER_DEFAULT: ControllListStatusFilter =
  "open";

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
  /** Mehrere Farben, komma-separiert → `farbe IN (...)`. */
  farben?: string;
  /** Jahr-Bereich (inklusive), Ganzzahl als String. Zusätzlich zu `jahr` (exakt). */
  jahr_from?: string;
  jahr_to?: string;
  /** Anzahl Ansichten (;-Tokens) Bereich (inklusive). */
  views_min?: string;
  views_max?: string;
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
  setIf("farben", p.farben);
  setIf("jahr_from", p.jahr_from);
  setIf("jahr_to", p.jahr_to);
  setIf("views_min", p.views_min);
  setIf("views_max", p.views_max);
  setIf("updated_from", p.updated_from);
  setIf("updated_to", p.updated_to);
  if (p.sort && p.sort !== "default") u.searchParams.set("sort", p.sort);
  // Status-Filter immer mitschicken, damit kein impliziter Server-Default
  // den Wert überschreibt (auch `open` wird gesetzt, weil das der
  // Default-Wert ist und dem Server explizit übermittelt wird).
  if (p.status_filter) {
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

export type VehicleImageryDeleteResponse = {
  deleted: number;
  id: number;
  prefix?: string;
};

/**
 * Löscht ein Fahrzeug vollständig: alle Bilder aus dem `vehicleimagery-public`-
 * Bucket und die DB-Zeile. `deleted` = Anzahl entfernter R2-Objekte.
 */
export async function deleteVehicleImagery(
  id: number,
): Promise<VehicleImageryDeleteResponse> {
  const res = await fetch(vehicleImageryOneUrl(id), {
    method: "DELETE",
    credentials: "include",
  });
  const j = (await res.json().catch(() => ({}))) as
    | VehicleImageryDeleteResponse
    | { error?: string; detail?: string };
  if (!res.ok) {
    const e = j as { error?: string; detail?: string };
    throw new Error(
      [e.error || `HTTP ${res.status}`, e.detail].filter(Boolean).join(" • "),
    );
  }
  return j as VehicleImageryDeleteResponse;
}

export const VEHICLE_IMAGERY_RESCALE_API =
  "/api/databases/vehicle-imagery-rescale";

export type VehicleImageryRescaleResponse = {
  ok: true;
  controllingId: number;
  hohe: number;
  /** Erfolgreich neu angestoßene Außen-Ansichten. */
  scheduled: string[];
  /** Übersprungene Ansichten (kein Quellbild gefunden). */
  skipped: string[];
  /** Anzahl Quellbilder, die aus Public nach Controlling kopiert wurden. */
  copied: number;
  hint?: string;
};

/**
 * Skaliert die Außen-Ansichten eines Produktions-Autos mit einer eigenen Höhe
 * neu. Die Ergebnisse landen in Kontrolle → Skalierung und müssen dort erst
 * freigegeben werden, bevor sie die Produktionsbilder überschreiben.
 */
export async function rescaleVehicleImagery(
  id: number,
  hohe: number,
): Promise<VehicleImageryRescaleResponse> {
  const res = await fetch(VEHICLE_IMAGERY_RESCALE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id, hohe }),
  });
  const j = (await res.json().catch(() => ({}))) as
    | VehicleImageryRescaleResponse
    | { error?: string };
  if (!res.ok) {
    throw new Error((j as { error?: string }).error || `HTTP ${res.status}`);
  }
  return j as VehicleImageryRescaleResponse;
}

export type VehicleImageryFacets = {
  markes: string[];
  modellsByMarke: Record<string, string[]>;
};

/** Distinct Marken + Modelle aus dem Controlling-Storage (für „Auto erstellen"). */
export async function getVehicleImageryControllingFacets(): Promise<VehicleImageryFacets> {
  const u = new URL(VEHICLE_IMAGERY_CONTROLLING_API, "https://x");
  u.searchParams.set("facets", "1");
  const res = await fetch(u.pathname + u.search, { credentials: "include" });
  const j = (await res.json().catch(() => ({}))) as
    | VehicleImageryFacets
    | { error?: string };
  if (!res.ok) {
    throw new Error((j as { error?: string }).error || `HTTP ${res.status}`);
  }
  return j as VehicleImageryFacets;
}

export type CreateVehicleInput = {
  marke: string;
  modell: string;
  /** Ein oder mehrere Jahrgänge — pro Jahr wird ein Auto angelegt. */
  jahre: string[];
  body?: string;
  trim?: string;
  farbe?: string;
  resolution?: string;
  format?: string;
  views: string[];
  /**
   * Wenn `true`, werden bereits in Controlling vorhandene Jahrgänge
   * überschrieben (neu generiert). Ohne Flag landen sie in `needsConfirm`.
   */
  overwrite?: boolean;
  /**
   * Optionaler Prompt-Jahrgang: ersetzt im KI-Prompt das Jahr (nicht das
   * gespeicherte Jahr). Leer/weggelassen = echtes Jahr verwenden.
   */
  prompt_jahr?: string;
};

export type CreateVehicleResponse = {
  created: { id: number; jahr: number }[];
  /** Jahrgänge, die bereits LIVE in der öffentlichen API existieren → blockiert. */
  blockedLive: { jahr: number; publicId: number }[];
  /** Jahrgänge, die bereits in Controlling existieren → Rückfrage nötig (overwrite). */
  needsConfirm: { jahr: number; existingId: number }[];
  totalJobs: number;
  views: string[];
};

/** Legt ein neues Fahrzeug im Controlling-Storage an + startet Generierungs-Jobs. */
export async function createVehicleImageryControlling(
  input: CreateVehicleInput,
): Promise<CreateVehicleResponse> {
  const res = await fetch(VEHICLE_IMAGERY_CONTROLLING_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const j = (await res.json().catch(() => ({}))) as
    | CreateVehicleResponse
    | { error?: string; existingId?: number };
  if (!res.ok) {
    throw new Error((j as { error?: string }).error || `HTTP ${res.status}`);
  }
  return j as CreateVehicleResponse;
}

export type DeleteControllingResponse = {
  deleted: boolean;
  id: number;
  deletedObjects: number;
  publicId?: number | null;
};

/**
 * Löscht ein „Geister"-Auto aus dem **Controlling**-Storage (R2-Objekte im
 * Controlling-Bucket + `controll_status` + Controlling-Zeile). Die öffentliche
 * Live-Version bleibt unberührt. Server erlaubt das nur, wenn ein Live-Zwilling
 * existiert und keine Generierung mehr läuft.
 */
export async function deleteVehicleImageryControlling(
  id: number,
): Promise<DeleteControllingResponse> {
  const res = await fetch(
    `${VEHICLE_IMAGERY_CONTROLLING_API}?id=${encodeURIComponent(String(id))}`,
    { method: "DELETE", credentials: "include" },
  );
  const j = (await res.json().catch(() => ({}))) as
    | DeleteControllingResponse
    | { error?: string; detail?: string };
  if (!res.ok) {
    const e = j as { error?: string; detail?: string };
    throw new Error(
      [e.error || `HTTP ${res.status}`, e.detail].filter(Boolean).join(" • "),
    );
  }
  return j as DeleteControllingResponse;
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
