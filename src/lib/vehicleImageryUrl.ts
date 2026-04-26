import type { VehicleImageryRowLike } from "./vehicleImageryPublicApi";

/**
 * Muster: `{cdnBase}/v1/{format}/{resolution}/{marke}/{modell}/{jahr}/{body}/{trim}/{farbe}/{ansicht}`
 * (wie CDN / Pipeline; Segmente per encodeURIComponent)
 */
export function buildVehicleImageUrl(
  cdnBase: string,
  row: VehicleImageryRowLike,
  viewToken: string,
): string {
  const b = cdnBase.replace(/\/$/, "");
  const seg = (s: string | number | null | undefined) =>
    encodeURIComponent(String(s ?? "").trim());
  const view = (viewToken ?? "").trim();
  if (!view) return b;
  return `${b}/v1/${seg(row.format)}/${seg(row.resolution)}/${seg(row.marke)}/${seg(row.modell)}/${seg(row.jahr)}/${seg(row.body)}/${seg(row.trim)}/${seg(row.farbe)}/${encodeURIComponent(view)}`;
}

/** `views` aus der DB: getrennt durch `;` */
export function parseViewTokens(views: string | null | undefined): string[] {
  if (!views?.trim()) return [];
  return views
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
