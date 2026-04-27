import type { CSSProperties } from "react";
import type { SubmissionsByCountryResponse } from "./overviewGlobeApi";
import { countForFeature } from "./requestsChoropleth";

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/**
 * Länderfarben auf dunklem Hintergrund: tiefes Marineblau → leuchtendes Cyan-Blau.
 */
function tacticalFills(
  count: number,
  max: number,
): { fill: string; stroke: string; strokeWidth: number } {
  if (max <= 0) {
    return { fill: "#0b1526", stroke: "rgba(34, 211, 238, 0.2)", strokeWidth: 0.45 };
  }
  if (count <= 0) {
    return { fill: "#0a1220", stroke: "rgba(14, 165, 233, 0.14)", strokeWidth: 0.4 };
  }
  const t = Math.min(1, count / max);
  const r = lerp(20, 34, t);
  const g = lerp(55, 200, t);
  const b = lerp(95, 255, t);
  const stroke =
    t > 0.4
      ? "rgba(103, 232, 249, 0.55)"
      : "rgba(30, 64, 100, 0.65)";
  return {
    fill: `rgb(${r},${g},${b})`,
    stroke,
    strokeWidth: 0.5 + 0.35 * t,
  };
}

export function getTacticalGeographyStyles(
  data: SubmissionsByCountryResponse | null,
  iso: string | undefined,
): {
  default: CSSProperties;
  hover: CSSProperties;
} {
  const c = countForFeature(data, iso);
  const max = data?.max && data.max > 0 ? data.max : 0;
  const o = tacticalFills(c, max);
  return {
    default: {
      fill: o.fill,
      fillOpacity: 0.92,
      stroke: o.stroke,
      strokeWidth: o.strokeWidth,
      opacity: 1,
      outline: "none",
      filter: "drop-shadow(0 0 3px rgba(34, 211, 238, 0.15))",
    },
    hover: {
      fill: o.fill,
      fillOpacity: 1,
      stroke: "rgba(165, 243, 252, 0.75)",
      strokeWidth: o.strokeWidth + 0.25,
      opacity: 1,
      outline: "none",
    },
  };
}
