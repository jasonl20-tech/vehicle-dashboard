/**
 * `settings`-Eintrag `controll_buttons` (D1 `configs`) — Control-Platform-Aktionsschaltflächen pro Modus.
 */

export const CONTROLL_BUTTONS_SETTING_ID = "controll_buttons";

export type ControllButtonsModeKey =
  | "correction"
  | "scaling"
  | "shadow"
  | "transparency";

export type ControllButtonsConfig = {
  buttons: Record<ControllButtonsModeKey, Record<string, boolean>>;
};

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

export function mergeControllButtonsFromDb(
  raw: unknown,
): ControllButtonsConfig {
  const out: ControllButtonsConfig = {
    buttons: {
      correction: { ...DEFAULT_CONTROLL_BUTTONS_CONFIG.buttons.correction },
      scaling: { ...DEFAULT_CONTROLL_BUTTONS_CONFIG.buttons.scaling },
      shadow: { ...DEFAULT_CONTROLL_BUTTONS_CONFIG.buttons.shadow },
      transparency: {
        ...DEFAULT_CONTROLL_BUTTONS_CONFIG.buttons.transparency,
      },
    },
  };
  if (!raw || typeof raw !== "object") return out;
  const incoming = raw as { buttons?: Record<string, Record<string, unknown>> };
  if (!incoming.buttons || typeof incoming.buttons !== "object") return out;
  for (const mode of [
    "correction",
    "scaling",
    "shadow",
    "transparency",
  ] as const) {
    const patch = incoming.buttons[mode];
    if (!patch || typeof patch !== "object") continue;
    for (const [k, v] of Object.entries(patch)) {
      if (typeof v === "boolean") {
        out.buttons[mode][k] = v;
      }
    }
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
