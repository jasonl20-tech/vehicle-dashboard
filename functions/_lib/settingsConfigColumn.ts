/**
 * Normalisiert Werte aus `settings.config` (D1 JSON-Spalte) für die Admin-API.
 *
 * In der Praxis liegen Daten nicht immer als JSON-Objekt vor:
 * - `google_image_search`: reiner Template-String
 * - `first_views` / `inside_views`: kommaseparierte Slugs
 * - `image_ai`: oft die Zahl `1` oder der JSON-Text `"1"`
 *
 * Vorher wurde `parseSettingsConfigColumn` aus `controllButtonsConfig` genutzt,
 * das bei nicht parsebarem String `null` lieferte — dann waren diese Zeilen in
 * der Admin-UI leer/falsch.
 */
export function normalizeSettingsConfigForAdmin(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "number" || typeof raw === "boolean") return raw;
  if (typeof raw === "object") return raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return trimmed;
    }
  }

  return null;
}
