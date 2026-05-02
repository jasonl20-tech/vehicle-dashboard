import type { ControlPlatformViewsMode } from "./controlPlatformModeContext";

/** Antwort von `GET /api/configs/controll-buttons` */
export type ControllButtonsModeKey =
  | "correction"
  | "scaling"
  | "shadow"
  | "transparency";

export type ControllButtonsConfig = {
  buttons: Record<ControllButtonsModeKey, Record<string, boolean>>;
};

export type ControllButtonsSettingsApiResponse = ControllButtonsConfig & {
  _meta?: {
    source: "database" | "default";
    configsBound: boolean;
  };
};

export const CONTROLL_BUTTONS_SETTINGS_PATH = "/api/configs/controll-buttons";

/** Fallback, wenn die API fehlt oder noch nicht gebunden ist. */
export const DEFAULT_CONTROLL_BUTTONS_CONFIG: ControllButtonsConfig = {
  buttons: {
    correction: {
      correct: true,
      regen_vertex: true,
      regen_batch: false,
      delete: true,
    },
    scaling: {
      correct: true,
      regen_transparent: true,
      regen_scaling: true,
      delete: false,
    },
    shadow: {
      correct: true,
      regen_vertex: true,
      regen_batch: true,
      delete: true,
    },
    transparency: {
      correct: false,
      regen_vertex: false,
      regen_batch: false,
      delete: false,
    },
  },
};

export const CONTROL_PLATFORM_MODE_TO_SETTING: Record<
  ControlPlatformViewsMode,
  ControllButtonsModeKey
> = {
  korrektur: "correction",
  transparenz: "transparency",
  skalierung: "scaling",
  schatten: "shadow",
};

export type ControllActionStub =
  | "richtig"
  | "vertex"
  | "batch"
  | "loeschen"
  | "regen_transparent"
  | "regen_scaling";
