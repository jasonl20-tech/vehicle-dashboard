/**
 * Frontend-Helfer für die NEUE Kontroll-Plattform (Quell-Bild-Freigabe).
 * Quelle: `fahrzeugliste` (neues ID-System), Bilder aus R2 `vehicleimages`.
 */

export const CAR_CONTROL_API = "/api/databases/car-control";
export const CAR_CONTROL_IMAGE_API = "/api/databases/car-control-image";

export type CarControlRow = {
  id: number;
  marke: string;
  modell: string;
  jahr: number;
  body: string;
  trim: string;
  farbe: string;
  view: string;
  innen: boolean;
  fehler: boolean;
  hold: boolean;
  hohe: number | null;
  imageKey: string;
  createdAt: string | null;
};

export type CarControlListResponse = {
  empty: boolean;
  total: number;
  rows: CarControlRow[];
  limit?: number;
  offset?: number;
};

export type CarControlAction =
  | "approve"
  | "hold"
  | "error"
  | "reset"
  | "delete";

export type CarControlListParams = {
  q?: string;
  marke?: string;
  limit?: number;
  offset?: number;
};

export function carControlListUrl(params: CarControlListParams): string {
  const u = new URL(CAR_CONTROL_API, "https://x");
  const set = (k: string, v: string | number | undefined | null) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (s) u.searchParams.set(k, s);
  };
  set("q", params.q);
  set("marke", params.marke);
  set("limit", params.limit);
  set("offset", params.offset);
  return u.pathname + u.search;
}

/* ── Reicher Arbeitsplatz (Klon): Varianten-Liste + Detail je Variante ── */

/** Identität einer Variante (= ein „Auto" in einer Farbe). */
export type CarVariantIdentity = {
  marke: string;
  modell: string;
  jahr: number;
  body: string;
  trim: string;
  farbe: string;
};

/** Eine Zeile der Varianten-Liste (Sidebar) mit Zähl-Aggregaten. */
export type CarControlVariant = CarVariantIdentity & {
  total: number;
  approved: number;
  open: number;
  error: number;
  hold: number;
  lastUpdated: string | null;
};

export type CarControlVariantsResponse = {
  total: number;
  rows: CarControlVariant[];
  limit?: number;
  offset?: number;
};

export type CarControlVariantStatus =
  | "approved"
  | "error"
  | "hold"
  | "open";

/** Eine Quell-Ansicht im Detail-Raster. */
export type CarControlDetailView = {
  id: number;
  view: string;
  innen: boolean;
  approved: boolean;
  fehler: boolean;
  hold: boolean;
  status: CarControlVariantStatus;
  hohe: number | null;
  imageKey: string;
  lastUpdated: string | null;
};

export type CarControlDetailResponse = {
  identity: CarVariantIdentity;
  views: CarControlDetailView[];
  missingExt: string[];
  missingInt: string[];
};

export type CarVariantSort =
  | "open_desc"
  | "updated_desc"
  | "marke"
  | "total_desc"
  | "error_desc";

export type CarVariantStatusFilter = "open" | "all" | "done" | "error" | "hold";

export function carControlVariantsUrl(params: {
  q?: string;
  status?: CarVariantStatusFilter;
  sort?: CarVariantSort;
  limit?: number;
  offset?: number;
}): string {
  const u = new URL(CAR_CONTROL_API, "https://x");
  u.searchParams.set("mode", "list");
  const set = (k: string, v: string | number | undefined | null) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (s) u.searchParams.set(k, s);
  };
  set("q", params.q);
  set("status", params.status);
  set("sort", params.sort);
  set("limit", params.limit);
  set("offset", params.offset);
  return u.pathname + u.search;
}

export function carControlDetailUrl(id: CarVariantIdentity | null): string | null {
  if (!id || !id.marke || !id.modell || !id.jahr) return null;
  const u = new URL(CAR_CONTROL_API, "https://x");
  u.searchParams.set("mode", "detail");
  u.searchParams.set("marke", id.marke);
  u.searchParams.set("modell", id.modell);
  u.searchParams.set("jahr", String(id.jahr));
  if (id.body) u.searchParams.set("body", id.body);
  if (id.trim) u.searchParams.set("trim", id.trim);
  if (id.farbe) u.searchParams.set("farbe", id.farbe);
  return u.pathname + u.search;
}

export const variantKey = (v: CarVariantIdentity): string =>
  `${v.marke}|${v.modell}|${v.jahr}|${v.body}|${v.trim}|${v.farbe}`;

/** Bild-URL für einen ID-Schlüssel (z. B. `source/01K…`). Null, wenn leer. */
export function carControlImageUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  const u = new URL(CAR_CONTROL_IMAGE_API, "https://x");
  u.searchParams.set("key", String(key));
  return u.pathname + u.search;
}

/** Aktion auf eine Liste von Zeilen-IDs anwenden (freigeben / hold / Fehler / reset). */
export async function carControlAction(
  action: CarControlAction,
  ids: number[],
): Promise<{ ok: boolean; action: string; changed: number }> {
  const res = await fetch(CAR_CONTROL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action, ids }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    action?: string;
    changed?: number;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  return { ok: !!j.ok, action: j.action || action, changed: j.changed ?? 0 };
}
