/**
 * Gemeinsame Geodaten & Typen für 2D-Karte und 3D-Globus (eine Quelle, gleiche Filter).
 * URL oder Filter ändern: nur hier.
 */
export const COUNTRIES_GEOJSON_URL = "/globe/ne_110m_admin_0_countries.geojson";

export type NeFeature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: { ISO_A2?: string; ADMIN?: string };
};

export type NeFeatureCollection = {
  type: "FeatureCollection";
  features: NeFeature[];
};

export function filterNeFeatures(
  features: NeFeature[] | undefined,
): NeFeature[] {
  if (!features) return [];
  return features.filter((f) => {
    const iso = f.properties?.ISO_A2;
    return iso && iso !== "AQ" && iso !== "-99";
  });
}

export function toFeatureCollection(
  features: NeFeature[] | undefined,
): NeFeatureCollection {
  return { type: "FeatureCollection", features: filterNeFeatures(features) };
}
