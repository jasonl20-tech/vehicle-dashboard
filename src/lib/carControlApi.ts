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

export type CarControlAction = "approve" | "hold" | "error" | "reset";

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
