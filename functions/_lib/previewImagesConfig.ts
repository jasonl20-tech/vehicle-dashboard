/**
 * `settings`-Eintrag `preview_images` (D1 `configs`) — Referenz-Bilder pro
 * View-Slug für die Lightbox-Preview-Funktion.
 *
 * Beispiel-Inhalt der Spalte `config`:
 *
 * ```json
 * {
 *   "front": "https://bildurl.../v1/.../front%23trp.png?key=…",
 *   "rear":  "https://bildurl.../v1/.../rear%23trp.png?key=…",
 *   …
 * }
 * ```
 *
 * Das Mapping ist case-insensitiv (alle Keys werden auf lowercase normiert).
 */

export const PREVIEW_IMAGES_SETTING_ID = "preview_images";

/** Map: lowercase-View-Slug → absolute Bild-URL. */
export type PreviewImagesConfig = Record<string, string>;

export const DEFAULT_PREVIEW_IMAGES_CONFIG: PreviewImagesConfig = {};

/**
 * Validiert/normalisiert das aus dem `config`-Feld geparste Objekt:
 * - akzeptiert nur String-Values
 * - keys werden zu lowercase getrimmt
 * - URLs werden grob auf `http(s)://`-Präfix geprüft
 */
export function normalizePreviewImagesConfig(
  raw: unknown,
): PreviewImagesConfig {
  const out: PreviewImagesConfig = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || !k.trim()) continue;
    if (typeof v !== "string") continue;
    const url = v.trim();
    if (!/^https?:\/\//i.test(url)) continue;
    out[k.trim().toLowerCase()] = url;
  }
  return out;
}

/** Reuse: gleicher JSON-Parser wie bei `controll_buttons`. */
export function parseSettingsConfigColumn(config: unknown): unknown {
  if (config == null) return null;
  if (typeof config === "string") {
    try {
      return JSON.parse(config) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof config === "object") return config;
  return null;
}
