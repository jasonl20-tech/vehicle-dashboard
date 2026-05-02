/**
 * `settings`-Eintrag `generation_views` (D1 `configs`) — gibt an, für
 * welche View-Slugs ein „+"-Button im Grid angezeigt werden darf, wenn das
 * Fahrzeug die Ansicht (noch) nicht hat. Ein Klick auf den Button erzeugt
 * dann einen `regen_vertex`-Job in der `controll_status`-Tabelle.
 *
 * Beispiel-Inhalt der Spalte `config`:
 *
 * ```json
 * {
 *   "front":         true,
 *   "rear":          true,
 *   "left":          true,
 *   "right":         true,
 *   "front_left":    true,
 *   "front_right":   true,
 *   "rear_left":     true,
 *   "rear_right":    true,
 *   "steeringwheel": false
 * }
 * ```
 *
 * Validierung:
 * - akzeptiert nur Boolean-Values
 * - Keys werden auf lowercase normiert (case-insensitiver Lookup im FE)
 */

export const GENERATION_VIEWS_SETTING_ID = "generation_views";

/** Map: lowercase-View-Slug → boolean. */
export type GenerationViewsConfig = Record<string, boolean>;

export const DEFAULT_GENERATION_VIEWS_CONFIG: GenerationViewsConfig = {};

export function normalizeGenerationViewsConfig(
  raw: unknown,
): GenerationViewsConfig {
  const out: GenerationViewsConfig = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || !k.trim()) continue;
    if (typeof v !== "boolean") continue;
    out[k.trim().toLowerCase()] = v;
  }
  return out;
}

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
