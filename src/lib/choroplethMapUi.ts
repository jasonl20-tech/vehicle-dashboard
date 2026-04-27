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

export const BILDBEMPFANG_CHOROPLETH_UI: ChoroplethMapUi = {
  cardTitle: "Bild-URL-Streams: Länder + Client-IP",
  cardDescription:
    "Gleiche Quelle wie Bildaustrahlung (AE `image_url_requests`). Fläche: Volumen pro Land (Cyan-Blau). IP: `blob4`, Land: `blob3` — Lage = Land + minimale Streuung; tiefes Zoom (Mausrad) bis lokal. Rote Hülle = IP-Hotspot, Linien = Referenz ab Ländermittelpunkt.",
  emptyGeoText: u.emptyGeoText,
  legendTitle: "Karte + IPs",
  legendBody:
    "Dunkle Basiskarte · Hell/Blau = stärkere Länder · Rot-Weiß = IP-Cluster · Weiß = Kanten. Scrollen/Zoomen: stark einzoomen. Städtenamen: Orientierung (nicht angebundene API).",
  globeCountLabel: "Bild-URL-Req.",
};

export function mergeChoroplethUi(
  base: ChoroplethMapUi,
  partial?: Partial<ChoroplethMapUi>,
): ChoroplethMapUi {
  return { ...base, ...partial };
}
