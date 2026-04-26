/**
 * Natural Earth: einige Länder haben `ISO_A2: "-99"`, dafür gültiges `ADM0_A3` (FRA, NOR, …).
 * (Kein vollständiges cca3→cca2-Import, nur die in ne_110m vorkommenden Fälle.)
 */
const ADM0_A3_TO_ISO2: Record<string, string> = {
  FRA: "FR",
  NOR: "NO",
};

/**
 * Gemeinsame Geodaten & Typen für 2D-Karte und 3D-Globus (eine Quelle, gleiche Filter).
 * URL oder Filter ändern: nur hier.
 */
export const COUNTRIES_GEOJSON_URL = "/globe/ne_110m_admin_0_countries.geojson";

export type NeFeature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: { ISO_A2?: string; ADM0_A3?: string; ADMIN?: string };
};

export type NeFeatureCollection = {
  type: "FeatureCollection";
  features: NeFeature[];
};

/**
 * Fürs Choropleth / API-Keys: ISO-2 aus Natural-Earth-Properties, mit Fallback -99 → ADM0_A3 → cca2.
 */
export function effectiveNeIso2(
  p: NeFeature["properties"] | undefined,
): string | undefined {
  if (!p) return undefined;
  const a2 = p.ISO_A2;
  if (a2 && a2 !== "-99" && /^[A-Z]{2}$/i.test(a2)) return a2.toUpperCase();
  const a3 = p.ADM0_A3;
  if (a3 && a3 !== "-99" && /^[A-Z]{3}$/i.test(a3)) {
    return ADM0_A3_TO_ISO2[a3.toUpperCase()];
  }
  return undefined;
}

export function filterNeFeatures(
  features: NeFeature[] | undefined,
): NeFeature[] {
  if (!features) return [];
  return features.filter((f) => f.properties?.ISO_A2 !== "AQ");
}

export function toFeatureCollection(
  features: NeFeature[] | undefined,
): NeFeatureCollection {
  return { type: "FeatureCollection", features: filterNeFeatures(features) };
}
