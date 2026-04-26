import { anfragenKarteMap2DModel } from "../config/anfragenKarteMap2DModel";

const u = anfragenKarteMap2DModel.ui;

/** Geteilte Texte für 2D/3D-Länderchoropleth (Karte + Legende + Globus-Tooltip). */
export type ChoroplethMapUi = {
  cardTitle: string;
  cardDescription: string;
  emptyGeoText: string;
  legendTitle: string;
  legendBody: string;
  /** 3D: „— 42 …“ */
  globeCountLabel: string;
};

export const ANFRAGEN_CHOROPLETH_UI: ChoroplethMapUi = {
  cardTitle: u.cardTitle,
  cardDescription: u.cardDescription,
  emptyGeoText: u.emptyGeoText,
  legendTitle: u.legendTitle,
  legendBody: u.legendBody,
  globeCountLabel: "Anfragen",
};

export const BILDAUSTRAHLUNG_CHOROPLETH_UI: ChoroplethMapUi = {
  cardTitle: "Bild-URL-Anfragen nach Land",
  cardDescription:
    "Datenquelle Analytics Engine `image_url_requests`: Ländercode in `blob3` (ISO-2, z. B. GB), gewichtet mit `_sample_interval`.",
  emptyGeoText: u.emptyGeoText,
  legendTitle: u.legendTitle,
  legendBody:
    "Hell = geringes Volumen · Dunkelblau = starker Anteil (relativ zum Maximum im Zeitraum).",
  globeCountLabel: "Bild-URL-Req.",
};

export function mergeChoroplethUi(
  base: ChoroplethMapUi,
  partial?: Partial<ChoroplethMapUi>,
): ChoroplethMapUi {
  return { ...base, ...partial };
}
