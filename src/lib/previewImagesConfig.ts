/**
 * Frontend-Typen + API-Pfad für die `preview_images`-Settings.
 *
 * Liefert ein Mapping `view-slug → URL` (z. B. `front_left` → `https://…`),
 * das in der Control-Platform-Lightbox als Overlay-Preview angezeigt wird.
 */

export const PREVIEW_IMAGES_SETTINGS_PATH = "/api/configs/preview-images";

export type PreviewImagesMap = Record<string, string>;

export type PreviewImagesSettingsApiResponse = {
  images: PreviewImagesMap;
  _meta?: { source: "database" | "default"; configsBound: boolean };
};

/**
 * Liefert das Preview-Image für einen View-Slug aus der Map.
 * Lookup ist case-insensitiv und akzeptiert sowohl `slot.slug` (z. B.
 * `front_left`) als auch das Label aus dem Layout.
 */
export function previewImageForSlug(
  map: PreviewImagesMap | null | undefined,
  slug: string | null | undefined,
): string | null {
  if (!map) return null;
  const key = (slug ?? "").trim().toLowerCase();
  if (!key) return null;
  return map[key] ?? null;
}
