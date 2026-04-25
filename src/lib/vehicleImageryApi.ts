/**
 * Fahrzeug-/Bildkatalog (D1) – nur Lese-API, siehe Functions.
 */
export const VEHICLE_IMAGERY_CATALOG = "/api/vehicle-imagery/catalog";

export type VehicleImageryCatalog = {
  marken: string[];
  modelle: string[];
  jahre: number[];
  bodies: string[];
  trims: string[];
  farben: string[];
  resolutions: string[];
  formate: string[];
  ansichten: string[];
  rowCount: number;
  filter: { marke?: string; modell?: string };
};

export async function fetchVehicleCatalog(
  options?: { marke?: string; modell?: string; signal?: AbortSignal },
): Promise<VehicleImageryCatalog> {
  const u = new URL(VEHICLE_IMAGERY_CATALOG, window.location.origin);
  if (options?.marke) u.searchParams.set("marke", options.marke);
  if (options?.modell) u.searchParams.set("modell", options.modell);
  const res = await fetch(u.toString(), {
    credentials: "include",
    signal: options?.signal,
  });
  const j = (await res.json().catch(() => ({}))) as VehicleImageryCatalog & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  return {
    marken: j.marken ?? [],
    modelle: j.modelle ?? [],
    jahre: j.jahre ?? [],
    bodies: j.bodies ?? [],
    trims: j.trims ?? [],
    farben: j.farben ?? [],
    resolutions: j.resolutions ?? [],
    formate: j.formate ?? [],
    ansichten: j.ansichten ?? [],
    rowCount: j.rowCount ?? 0,
    filter: j.filter && typeof j.filter === "object" ? j.filter : {},
  };
}
