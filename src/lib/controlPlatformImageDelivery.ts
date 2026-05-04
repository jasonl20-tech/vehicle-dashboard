import type { VehicleImageryRowLike } from "./vehicleImageryPublicApi";
import { buildVehicleImageUrl } from "./vehicleImageryUrl";

/** CDN für transkodierte / komprimierte Varianten (Query: `f`, `q`; `key` wie bisher). */
export const CONTROL_PLATFORM_RESIMAGES_BASE =
  "https://resimages.vehicleimagery.com";

export type ControlPlatformImageDeliveryMode =
  | "normal"
  | "performance"
  | "custom";

export type ControlPlatformTranscodeFormat = "webp" | "avif";

/** Performance-Preset: WebP ist auf den meisten Clients ein guter Kompromiss aus kleiner Datei und schnellem Decode. */
export const CONTROL_PLATFORM_PERFORMANCE_FORMAT: ControlPlatformTranscodeFormat =
  "webp";
export const CONTROL_PLATFORM_PERFORMANCE_QUALITY = 80;

/**
 * Hängt `f` und `q` an die bestehende Bild-Query (`?key=…`) an.
 */
export function appendTranscodeToImageUrlQuery(
  imageUrlQuery: string,
  f: ControlPlatformTranscodeFormat,
  q: number,
): string {
  const qClamped = Math.min(100, Math.max(1, Math.round(Number(q)) || 80));
  const fNorm: ControlPlatformTranscodeFormat =
    f === "avif" ? "avif" : "webp";
  const tail = `f=${encodeURIComponent(fNorm)}&q=${qClamped}`;
  const t = (imageUrlQuery ?? "").trim();
  if (!t) return `?${tail}`;
  const qstr = t.startsWith("?") ? t : `?${t}`;
  return `${qstr}&${tail}`;
}

export function buildControlPlatformDisplayImageUrl(params: {
  mode: ControlPlatformImageDeliveryMode;
  customFormat: ControlPlatformTranscodeFormat;
  customQuality: number;
  cdnBase: string;
  row: VehicleImageryRowLike;
  viewToken: string;
  imageUrlQuery: string;
}): string {
  const {
    mode,
    customFormat,
    customQuality,
    cdnBase,
    row,
    viewToken,
    imageUrlQuery,
  } = params;

  if (mode === "normal") {
    return buildVehicleImageUrl(cdnBase, row, viewToken, imageUrlQuery);
  }

  const q =
    mode === "performance" ?
      CONTROL_PLATFORM_PERFORMANCE_QUALITY
    : customQuality;
  const f =
    mode === "performance" ?
      CONTROL_PLATFORM_PERFORMANCE_FORMAT
    : customFormat;

  const query = appendTranscodeToImageUrlQuery(imageUrlQuery, f, q);
  return buildVehicleImageUrl(
    CONTROL_PLATFORM_RESIMAGES_BASE,
    row,
    viewToken,
    query,
  );
}
