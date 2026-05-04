import type { ControllStatusRow } from "./vehicleImageryPublicApi";

export const CONTROLL_STATUS_API = "/api/configs/controll-status";

export type ControllStatusMode =
  | "correction"
  | "inside"
  | "scaling"
  | "shadow"
  | "transparency";

export type ControllStatusInput = {
  vehicleId: number;
  viewToken: string;
  mode: ControllStatusMode;
  status: string;
  key: string | null;
};

export type ControllStatusResponse = {
  row: ControllStatusRow;
};

/**
 * Ermittelt den R2-Pfad (`v1/...`) aus einer Bild-URL relativ zur `cdnBase`.
 * Gibt `null` zurück, wenn die URL nicht zur Basis passt.
 */
export function r2KeyFromImageUrl(
  cdnBase: string,
  imageUrl: string,
): string | null {
  if (!cdnBase || !imageUrl) return null;
  const base = cdnBase.replace(/\/$/, "");
  const noQuery = imageUrl.split("?")[0];
  const prefix = `${base}/`;
  if (!noQuery.startsWith(prefix)) return null;
  return noQuery.slice(prefix.length) || null;
}

/**
 * Wie `r2KeyFromImageUrl`, zusätzlich Fallback über `/v1/` im Pfad — z. B.
 * wenn dasselbe Objekt über `resimages.vehicleimagery.com` geladen wird.
 */
export function r2KeyFromAnyVehicleImageUrl(
  cdnBase: string,
  imageUrl: string,
): string | null {
  const primary = r2KeyFromImageUrl(cdnBase, imageUrl);
  if (primary) return primary;
  const noQuery = imageUrl.split("?")[0];
  const idx = noQuery.indexOf("/v1/");
  if (idx === -1) return null;
  const rest = noQuery.slice(idx + 1).trim();
  return rest || null;
}

export async function postControllStatus(
  input: ControllStatusInput,
): Promise<ControllStatusResponse> {
  const res = await fetch(CONTROLL_STATUS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const j = (await res.json().catch(() => ({}))) as
    | ControllStatusResponse
    | { error?: string; detail?: string };
  if (!res.ok) {
    const e = j as { error?: string; detail?: string };
    const parts: string[] = [];
    parts.push(e.error || `HTTP ${res.status}`);
    if (e.detail) parts.push(e.detail);
    throw new Error(parts.join(" • "));
  }
  return j as ControllStatusResponse;
}
