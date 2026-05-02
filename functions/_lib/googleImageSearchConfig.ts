/**
 * `settings`-Eintrag `google_image_search` (D1 `configs`) — Template für
 * eine Google-Bildersuche, das im Lightbox-Header der Control-Platform
 * verwendet wird.
 *
 * Das `config`-Feld kann in zwei Formen vorliegen:
 *
 * 1. Reines String-Template (so liegt es aktuell in der DB):
 *
 *    ```
 *    Schaue mir bilder von einem {{marke}} {{model}} {{jahr}} {{body}} {{trim}} ansicht {{ansicht}}
 *    ```
 *
 * 2. Objekt mit `template`-Feld:
 *
 *    ```json
 *    { "template": "Schaue mir bilder von einem {{marke}} …" }
 *    ```
 *
 * Beide Formen werden vom Endpoint auf `{ template: string }` normalisiert.
 */

export const GOOGLE_IMAGE_SEARCH_SETTING_ID = "google_image_search";

export type GoogleImageSearchConfig = {
  /** Template-String mit `{{platzhaltern}}`. */
  template: string;
};

export const DEFAULT_GOOGLE_IMAGE_SEARCH_CONFIG: GoogleImageSearchConfig = {
  template: "",
};

export function normalizeGoogleImageSearchConfig(
  raw: unknown,
): GoogleImageSearchConfig {
  if (typeof raw === "string") {
    return { template: raw.trim() };
  }
  if (raw && typeof raw === "object") {
    const t = (raw as Record<string, unknown>).template;
    if (typeof t === "string") return { template: t.trim() };
  }
  return { template: "" };
}

export function parseSettingsConfigColumn(config: unknown): unknown {
  if (config == null) return null;
  if (typeof config === "string") {
    // Zwei Fälle: das Feld enthält bereits den reinen Template-String,
    // oder es enthält JSON-Text. Wir versuchen JSON.parse zuerst und
    // fallen sonst auf den reinen String zurück.
    const trimmed = config.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      trimmed.startsWith('"')
    ) {
      try {
        return JSON.parse(trimmed) as unknown;
      } catch {
        /* noop */
      }
    }
    return trimmed;
  }
  if (typeof config === "object") return config;
  return null;
}
