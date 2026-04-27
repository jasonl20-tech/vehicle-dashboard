/**
 * 2D-Karte „Bildempfang / Tactical“: starker Zoom, dunkles UI (Command-Center-Look).
 * Geometrie (Projektion) identisch zu `anfragenKarteMap2DModel`, Werte leicht verstärkt
 * für schärferes Hineinzoomen.
 */
import { anfragenKarteMap2DModel } from "./anfragenKarteMap2DModel";

const base = anfragenKarteMap2DModel.svg;

export const bildempfangMap2DModel = {
  svg: {
    ...base,
    /** Dunkler Hintergrund (Ozean / Tiefraum) */
    canvasClassName: "rounded-b-xl bg-[#030712] ring-1 ring-cyan-900/20",
    scaleFactor: 0.22,
    zoom: {
      center: [0, 0] as [number, number],
      zoom: 1,
      minZoom: 0.35,
      /** D3 react-simple-maps: deutlich tieferes Hineinzoomen als Standard (8) */
      maxZoom: 22,
    },
  },
} as const;

/** Große Städte (Labels, ~wie Referenz) — dekorativ, grob lesbar. */
export const TACTICAL_CITY_ANCHORS: {
  name: string;
  /** [lng, lat] für react-simple-maps */
  pos: [number, number];
}[] = [
  { name: "Seattle", pos: [-122.3, 47.6] },
  { name: "New York", pos: [-74, 40.7] },
  { name: "London", pos: [-0.12, 51.5] },
  { name: "Paris", pos: [2.35, 48.86] },
  { name: "Moscow", pos: [37.6, 55.75] },
  { name: "Dubai", pos: [55.27, 25.2] },
  { name: "Mumbai", pos: [72.88, 19.08] },
  { name: "Bangkok", pos: [100.5, 13.75] },
  { name: "Singapore", pos: [103.8, 1.35] },
  { name: "Sydney", pos: [151.2, -33.86] },
  { name: "Cape Town", pos: [18.42, -33.92] },
  { name: "Lagos", pos: [3.4, 6.45] },
  { name: "São Paulo", pos: [-46.63, -23.55] },
  { name: "Tokyo", pos: [139.65, 35.68] },
  { name: "Shanghai", pos: [121.47, 31.23] },
  { name: "Shenzhen", pos: [114.05, 22.55] },
  { name: "L.A.", pos: [-118.25, 34.05] },
  { name: "Chicago", pos: [-87.6, 41.88] },
  { name: "Toronto", pos: [-79.38, 43.65] },
  { name: "Madrid", pos: [-3.7, 40.42] },
  { name: "Berlin", pos: [13.4, 52.52] },
  { name: "Istanbul", pos: [28.95, 41.01] },
  { name: "Johannesburg", pos: [28.05, -26.2] },
];
