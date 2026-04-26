import { leafletChoroplethPathOptions } from "../lib/requestsChoropleth";
import type { SubmissionsByCountryResponse } from "../lib/overviewGlobeApi";

/**
 * Zentrales Modell der 2D-Ansicht (wie das „Gebäude“ um den 3D-Globus):
 * Kacheln, Karten-View, Choropleth-Randwerte, Texte.
 *
 * - Farbverlauf (Blau) pro Land: `../lib/requestsChoropleth` → `countryBlues`
 * - Linienstärke / Opazität der Flächen: `choropleth.pathOverrides` unten
 * - Hintergrundkacheln: `tile` (z. B. später MapTiler, Carto, Eigen-Hosting)
 * - Karten-Position: `view` + `fitBounds` / `fitFallback`
 * - Anzeigetexte: `ui` (Karten-„Chrome“)
 */
export const anfragenKarteMap2DModel = {
  tile: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>-Mitwirkende',
  },

  view: {
    center: [24, 10] as [number, number],
    zoom: 2,
    minZoom: 1,
    maxZoom: 10,
    scrollWheelZoom: true,
    worldCopyJump: true,
  },

  fitBounds: {
    padding: [28, 28] as [number, number],
    maxZoom: 4,
  },

  fitFallback: {
    center: [20, 10] as [number, number],
    zoom: 2,
  },

  /**
   * Leaflet `PathOptions`–Parameter (ohne die Farben aus `countryBlues`).
   * Farbton-Kurve anpassen: in `requestsChoropleth.ts` (`countryBlues`).
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
      "2D-Karte: je mehr Anfragen, desto blauer (Nicht-Spam, Ländercode in Metadaten). Grenzen: Natural Earth 110m. Kacheln: OpenStreetMap.",
    legendTitle: "Farbskala",
    legendBody:
      "Hell = wenig/kein Volumen · Dunkelblau = hoher Anteil (relativ zu „stärkstem Land“)",
    emptyGeoText: "Geodaten werden geladen…",
  },
} as const;

/**
 * Fertige Leaflet-Pfad-Styles (Farbe aus `requestsChoropleth` + Werte aus `pathOverrides`).
 */
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
