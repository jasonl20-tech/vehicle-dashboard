/**
 * Sperrliste: KV-Key fest `_config_blocked_vehicles`, JSON
 * `{"brands":[],"models":[]}`. Modellzeilen als `marke\0modell` (eindeutig).
 */

export const BLOCKED_VEHICLES_URL = "/api/system/blocked-vehicles";

const MODEL_SEP = "\0";

export type BlockedVehiclesValue = { brands: string[]; models: string[] };

export type BlockedVehiclesGetResponse = {
  value: BlockedVehiclesValue;
  raw: string | null;
  key: string;
};

export function encodeBlockedModel(marke: string, modell: string): string {
  return `${marke.trim()}${MODEL_SEP}${modell.trim()}`;
}

export function formatBlockedModelLabel(entry: string): string {
  const i = entry.indexOf(MODEL_SEP);
  if (i === -1) return entry;
  return `${entry.slice(0, i)} · ${entry.slice(i + 1)}`;
}

export function parseBlockedVehiclesValue(v: unknown): BlockedVehiclesValue {
  const d: BlockedVehiclesValue = { brands: [], models: [] };
  if (!v || typeof v !== "object" || Array.isArray(v)) return d;
  const o = v as Record<string, unknown>;
  if (Array.isArray(o.brands) && o.brands.every((x) => typeof x === "string")) {
    d.brands = [...(o.brands as string[])];
  }
  if (Array.isArray(o.models) && o.models.every((x) => typeof x === "string")) {
    d.models = [...(o.models as string[])];
  }
  return d;
}

export async function putBlockedVehicles(
  value: BlockedVehiclesValue,
): Promise<void> {
  const res = await fetch(BLOCKED_VEHICLES_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ value }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
}
