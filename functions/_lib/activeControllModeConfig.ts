/**
 * `settings`-Eintrag `active_controll_mode` (D1 `configs`) — gibt an, welche
 * Modi der Control-Platform überhaupt im UI angeboten werden.
 *
 * Beispiel-Inhalt der Spalte `config`:
 *
 * ```json
 * {
 *   "correction":   true,
 *   "scaling":      true,
 *   "shadow":       false,
 *   "transparency": false
 * }
 * ```
 *
 * Modi mit `false` werden im Modus-Dropdown (und damit auch implizit als
 * View-Mode auf der Liste) ausgeblendet.
 */

export const ACTIVE_CONTROLL_MODE_SETTING_ID = "active_controll_mode";

export type ActiveControllModeKey =
  | "correction"
  | "scaling"
  | "shadow"
  | "transparency";

export const ACTIVE_CONTROLL_MODE_KEYS: readonly ActiveControllModeKey[] = [
  "correction",
  "scaling",
  "shadow",
  "transparency",
] as const;

export type ActiveControllModeConfig = Record<ActiveControllModeKey, boolean>;

/** Default: alle Modi aktiv (= bisheriges Verhalten, wenn die Zeile fehlt). */
export const DEFAULT_ACTIVE_CONTROLL_MODE_CONFIG: ActiveControllModeConfig = {
  correction: true,
  scaling: true,
  shadow: true,
  transparency: true,
};

/**
 * Validiert/normalisiert das aus `config` geparste Objekt.
 * - akzeptiert nur Boolean-Values
 * - unbekannte Keys werden ignoriert
 * - fehlende Keys übernehmen den Default-Wert (`true`)
 */
export function mergeActiveControllModeFromDb(
  raw: unknown,
): ActiveControllModeConfig {
  const out: ActiveControllModeConfig = {
    ...DEFAULT_ACTIVE_CONTROLL_MODE_CONFIG,
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const incoming = raw as Record<string, unknown>;
  for (const key of ACTIVE_CONTROLL_MODE_KEYS) {
    const v = incoming[key];
    if (typeof v === "boolean") {
      out[key] = v;
    }
  }
  return out;
}

/** Reuse: gleicher JSON-Parser wie bei den anderen Settings. */
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
