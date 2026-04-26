import type { CSSProperties } from "react";
import { leafletChoroplethPathOptions } from "../lib/requestsChoropleth";
import type { SubmissionsByCountryResponse } from "../lib/overviewGlobeApi";

/**
 * 2D-Ansicht: **Flache** SVG-Länderkarte (d3 `geoNaturalEarth1` – klassische
 * Wandkarten-Projektion, **kein** Globus / keine weltrunde Ozean-Scheibe).
 * Kein Meer als eigene Fläche: nur Länder-Polygone; der sichtbare „Zwischenraum“
 * ist der neutrale Karten-Hintergrund (Papierfarbe), kein Blau.
 *
 * Geometrie: `anfragenKarteGeo` → GeoJSON unter `public/…` (ISO_A2 pro Land).
 */
export const anfragenKarteMap2DModel = {
  svg: {
    /** Flache 2D-Projektion (rechteckige Anmutung, keine Kugel-Silhouette) */
    projection: "geoNaturalEarth1" as const,
    /** `scale = width * scaleFactor` (wird in `Map2DWorldSvg` aus Containerbreite berechnet) */
    scaleFactor: 0.198,
    projectionConfigStatic: {
      center: [0, 0] as [number, number],
    },
    /** Hintergrund unter der SVG (Zwischenräume zwischen Ländern) */
    canvasClassName: "rounded-b-xl bg-[#f2f4f7]",
    /** ZoomableGroup: Pan/Scroll-Zoom */
    zoom: {
      center: [0, 0] as [number, number],
      zoom: 1,
      minZoom: 0.5,
      maxZoom: 8,
    },
  },

  /**
   * Choropleth-Parameter, analog zu ehem. Leaflet `PathOptions`.
   * Farben: `../lib/requestsChoropleth` → `countryBlues`.
   */
  choropleth: {
    pathOverrides: {
      weight: 0.7,
      fillOpacity: 0.9,
      opacity: 1,
    } as const,
  },

  ui: {
    cardTitle: "Anfragen nach Land",
    cardDescription:
      "2D: flache Länderkarte (SVG, ohne Meeresfläche, ohne Kugel-Hintergrund). Stärkere Einsendungen erscheinen blauer. Geometrie über GeoJSON; Datei bei Bedarf austauschbar.",
    legendTitle: "Farbskala",
    legendBody:
      "Hell = wenig/kein Volumen · Dunkelblau = hoher Anteil (relativ zu „stärkstem Land“)",
    emptyGeoText: "Geodaten werden geladen…",
  },
} as const;

export function getMap2DChoroplethPathOptions(
  data: SubmissionsByCountryResponse | null,
  iso: string | undefined,
) {
  const base = leafletChoroplethPathOptions(data, iso);
  return {
    ...base,
    ...anfragenKarteMap2DModel.choropleth.pathOverrides,
  };
}

/**
 * Füll- und Linienstil für `react-simple-maps` `<Geography style={{ default, hover }} />`
 */
export function getMap2DGeographyStyles(
  data: SubmissionsByCountryResponse | null,
  iso: string | undefined,
): {
  default: CSSProperties;
  hover: CSSProperties;
} {
  const o = getMap2DChoroplethPathOptions(data, iso);
  const w = o.weight;
  return {
    default: {
      fill: o.fillColor,
      fillOpacity: o.fillOpacity,
      stroke: o.color,
      strokeWidth: w,
      opacity: o.opacity,
      outline: "none",
    },
    hover: {
      fill: o.fillColor,
      fillOpacity: Math.min(1, o.fillOpacity + 0.04),
      stroke: o.color,
      strokeWidth: w + 0.15,
      opacity: 1,
      outline: "none",
    },
  };
}
