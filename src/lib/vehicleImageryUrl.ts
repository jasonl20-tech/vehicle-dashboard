import type { VehicleImageryRowLike } from "./vehicleImageryPublicApi";

/** Dateiendung aus dem DB-Feld `format` (jpg, png, …); Standard `png`. */
function fileExtFromRowFormat(format: string | null | undefined): string {
  const f = (format ?? "").trim().toLowerCase().replace(/^\./, "");
  if (!f) return "png";
  return f;
}

/**
 * Letztes Segment: `{view}.{format}` (z. B. `left.png`), danach `?key=…`.
 * `/v1/{format}/{resolution}/marke/…/farbe/left.png?key=…`
 */
export function buildVehicleImageUrl(
  cdnBase: string,
  row: VehicleImageryRowLike,
  viewToken: string,
  imageUrlQuery = "",
): string {
  const b = cdnBase.replace(/\/$/, "");
  const seg = (s: string | number | null | undefined) =>
    encodeURIComponent(String(s ?? "").trim());
  const view = (viewToken ?? "").trim();
  const q = (imageUrlQuery ?? "").trim();
  if (!view) {
    return b + q;
  }
  const ext = fileExtFromRowFormat(row.format);
  const fileName = `${view}.${ext}`;
  const path = `${b}/v1/${seg(row.format)}/${seg(row.resolution)}/${seg(row.marke)}/${seg(row.modell)}/${seg(row.jahr)}/${seg(row.body)}/${seg(row.trim)}/${seg(row.farbe)}/${encodeURIComponent(fileName)}`;
  return path + q;
}

/** `views` aus der DB: getrennt durch `;` */
export function parseViewTokens(views: string | null | undefined): string[] {
  if (!views?.trim()) return [];
  return views
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
