/**
 * Frontend-Typen + API-Pfad für die `active_controll_mode`-Settings.
 *
 * Steuert, welche Modi der Control-Platform im Modus-Dropdown angezeigt
 * werden. Modi mit Wert `false` werden ausgeblendet.
 */

import {
  type ControlPlatformViewsMode,
  CONTROL_PLATFORM_MODES,
} from "./controlPlatformModeContext";
import { CONTROL_PLATFORM_MODE_TO_SETTING } from "./controllButtonsConfig";

export const ACTIVE_CONTROLL_MODE_SETTINGS_PATH =
  "/api/configs/active-controll-mode";

export type ActiveControllModeKey =
  | "correction"
  | "scaling"
  | "shadow"
  | "transparency";

export type ActiveControllModeConfig = Record<ActiveControllModeKey, boolean>;

export type ActiveControllModeApiResponse = {
  modes: ActiveControllModeConfig;
  _meta?: { source: "database" | "default"; configsBound: boolean };
};

/** Default = alle Modi aktiv (bisheriges Verhalten, wenn keine Config da). */
export const DEFAULT_ACTIVE_CONTROLL_MODE_CONFIG: ActiveControllModeConfig = {
  correction: true,
  scaling: true,
  shadow: true,
  transparency: true,
};

/** Prüft, ob ein Frontend-`viewsMode` (deutsch) laut Settings aktiv ist. */
export function isViewsModeActive(
  config: ActiveControllModeConfig | null | undefined,
  viewsMode: ControlPlatformViewsMode,
): boolean {
  const cfg = config ?? DEFAULT_ACTIVE_CONTROLL_MODE_CONFIG;
  const settingKey = CONTROL_PLATFORM_MODE_TO_SETTING[viewsMode];
  return cfg[settingKey] === true;
}

/**
 * Liefert die Liste der aktiven Frontend-Modi in der Reihenfolge von
 * `CONTROL_PLATFORM_MODES`.
 */
export function activeViewsModes(
  config: ActiveControllModeConfig | null | undefined,
): readonly ControlPlatformViewsMode[] {
  return CONTROL_PLATFORM_MODES.filter((m) => isViewsModeActive(config, m));
}
