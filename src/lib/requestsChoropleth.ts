import type { SubmissionsByCountryResponse } from "./overviewGlobeApi";

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/**
 * Füll- und Linienfarben (3D-Globe + 2D-Leaflet) aus Anfragenvolumen Relativ zu max.
 */
export function countryBlues(
  count: number,
  max: number,
): { cap: string; side: string; stroke: string } {
  if (max <= 0) {
    return {
      cap: "rgb(240, 244, 248)",
      side: "rgb(223, 230, 240)",
      stroke: "rgba(70, 88, 108, 0.88)",
    };
  }
  if (count <= 0) {
    return {
      cap: "rgb(238, 244, 250)",
      side: "rgb(222, 232, 242)",
      stroke: "rgba(70, 88, 108, 0.88)",
    };
  }
  const t = Math.min(1, count / max);
  const r = lerp(236, 30, t);
  const g = lerp(244, 95, t);
  const b = lerp(252, 220, t);
  const stroke =
    t > 0.45
      ? "rgba(255, 255, 255, 0.4)"
      : "rgba(55, 72, 95, 0.88)";
  return {
    cap: `rgb(${r},${g},${b})`,
    side: `rgb(${lerp(r, r - 18, 0.25)},${lerp(g, g - 12, 0.25)},${lerp(b, b - 20, 0.25)})`,
    stroke,
  };
}

export function countForFeature(
  data: SubmissionsByCountryResponse | null,
  iso: string | undefined,
): number {
  if (!data?.byIso2 || !iso) return 0;
  return data.byIso2[iso] ?? 0;
}

export function leafletChoroplethPathOptions(
  data: SubmissionsByCountryResponse | null,
  iso: string | undefined,
): {
  fillColor: string;
  color: string;
  weight: number;
  fillOpacity: number;
  opacity: number;
} {
  const c = countForFeature(data, iso);
  const max = data?.max && data.max > 0 ? data.max : 0;
  const b = countryBlues(c, max);
  return {
    fillColor: b.cap,
    color: b.stroke,
    weight: 0.7,
    fillOpacity: 0.9,
    opacity: 1,
  };
}
