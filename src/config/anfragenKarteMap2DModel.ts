import type { CSSProperties } from "react";
import { leafletChoroplethPathOptions } from "../lib/requestsChoropleth";
import type { SubmissionsByCountryResponse } from "../lib/overviewGlobeApi";

/**
 * 2D-Ansicht: reine **SVG**-Weltkarte (projiziertes Länder-GeoJSON im Browser).
 * Keine Rasterkacheln (kein OpenStreetMap o. ä.) – daher kein Mischkarten-Etikett
 * und keine „Zufall“-Ortstexte; nur Länderflächen + Farbe aus Anfrage-Daten.
 *
 * Ländergeometrie: `anfragenKarteGeo` → lokal abgelegte GeoJSON-Datei. Für ein
 * lizenziertes/anderes Länder-SVG-Export ersetze einfach diese Datei im `public/`-Pfad
 * (gleiche Struktur: FeatureCollection mit `properties.ISO_A2`).
 */
export const anfragenKarteMap2DModel = {
  /**
   * Ozean-Hintergrund (Halo um die Projektion) hinter den Länder-SVG-Pfaden.
   */
  svg: {
    projection: "geoEqualEarth" as const,
    projectionConfig: { scale: 200, center: [0, 0] } as {
      scale: number;
      center: [number, number];
    },
    ocean: {
      fill: "#b9d4ec",
      stroke: "rgba(100, 130, 165, 0.35)",
      strokeWidth: 0.45,
    },
    /** ZoomableGroup: Pan/Scroll-Zoom (nur Länder-SVG) */
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
      "2D: vektorisierte Länderkarte (SVG, keine Hintergrundkacheln) – stärkere Einsendungen erscheinen blauer. Grenzen: Natural Earth; bei Bedarf durch eure lizenzierte Geometrie ersetzbar.",
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
