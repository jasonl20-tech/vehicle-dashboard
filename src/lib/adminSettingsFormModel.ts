/**
 * Parse/Serialize für die Admin-Oberfläche (structured editors).
 * Logik spiegelt die jeweiligen functions/_lib/*-Configs, ohne Functions zu importieren.
 */

import type { ControllButtonsConfig, ControllButtonsModeKey } from "./controllButtonsConfig";
import { DEFAULT_CONTROLL_BUTTONS_CONFIG } from "./controllButtonsConfig";

export const ADMIN_STRUCTURED_SETTING_IDS = new Set<string>([
  "controll_buttons",
  "preview_images",
  "active_controll_mode",
  "generation_views",
  "google_image_search",
  "first_views",
  "image_ai",
  "inside_views",
]);

export function hasStructuredAdminEditor(settingId: string): boolean {
  return ADMIN_STRUCTURED_SETTING_IDS.has(settingId);
}

const ACTIVE_MODES: readonly ControllButtonsModeKey[] = [
  "correction",
  "scaling",
  "shadow",
  "transparency",
] as const;

export const ADMIN_ACTIVE_MODE_LABELS: Record<ControllButtonsModeKey, string> = {
  correction: "Korrektur",
  scaling: "Skalierung",
  shadow: "Schatten",
  transparency: "Transparenz",
};

/** Toggle-Labels pro Action-Key (Controll-Buttons). */
export const ADMIN_CONTROLL_ACTION_LABELS: Record<string, string> = {
  correct: "Correct",
  regen_vertex: "Regen Vertex",
  regen_batch: "Regen Batch",
  regen_transparent: "Regen Transparent",
  regen_scaling: "Regen Skalierung",
  delete: "Löschen",
};

export function mergeControllButtonsFromDb(raw: unknown): ControllButtonsConfig {
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
  for (const mode of ACTIVE_MODES) {
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

/** Keys je Modus in Standard-Reihenfolge; zusätzliche Keys aus den Daten werden angehängt. */
export function controllButtonKeysForMode(
  mode: ControllButtonsModeKey,
  data: ControllButtonsConfig,
): string[] {
  const base = Object.keys(DEFAULT_CONTROLL_BUTTONS_CONFIG.buttons[mode]);
  const extra = Object.keys(data.buttons[mode] ?? {}).filter(
    (k) => !base.includes(k),
  );
  extra.sort();
  return [...base, ...extra];
}

export type ActiveControllModeConfig = Record<ControllButtonsModeKey, boolean>;

export const DEFAULT_ACTIVE_CONTROLL_MODE: ActiveControllModeConfig = {
  correction: true,
  scaling: true,
  shadow: true,
  transparency: true,
};

export function mergeActiveControllModeFromDb(
  raw: unknown,
): ActiveControllModeConfig {
  const out = { ...DEFAULT_ACTIVE_CONTROLL_MODE };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const incoming = raw as Record<string, unknown>;
  for (const key of ACTIVE_MODES) {
    const v = incoming[key];
    if (typeof v === "boolean") out[key] = v;
  }
  return out;
}

export const ADMIN_PREVIEW_IMAGE_SLUGS: readonly string[] = [
  "front",
  "rear",
  "left",
  "right",
  "front_left",
  "front_right",
  "rear_left",
  "rear_right",
  "interior_front",
  "interior_rear",
  "dashboard",
  "wheel",
];

export function isPresetPreviewSlug(slug: string): boolean {
  return (ADMIN_PREVIEW_IMAGE_SLUGS as readonly string[]).includes(slug);
}

export const ADMIN_PREVIEW_SLUG_LABELS: Record<string, string> = {
  front: "Front",
  rear: "Heck",
  left: "Links",
  right: "Rechts",
  front_left: "Vorne links",
  front_right: "Vorne rechts",
  rear_left: "Hinten links",
  rear_right: "Hinten rechts",
  interior_front: "Innenraum vorne",
  interior_rear: "Innenraum hinten",
  dashboard: "Armaturenbrett",
  wheel: "Rad",
};

export function parsePreviewImagesForAdmin(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slug of ADMIN_PREVIEW_IMAGE_SLUGS) out[slug] = "";
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.trim().toLowerCase();
    if (!key) continue;
    if (typeof v === "string") out[key] = v;
    else if (v != null) out[key] = String(v);
  }
  return out;
}

export function serializePreviewImagesForAdmin(
  map: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    const key = k.trim().toLowerCase();
    if (!key) continue;
    const t = v.trim();
    if (t) out[key] = t;
  }
  return out;
}

export function previewImageSlugOrder(map: Record<string, string>): string[] {
  const extra = Object.keys(map).filter(
    (k) => !ADMIN_PREVIEW_IMAGE_SLUGS.includes(k),
  );
  extra.sort();
  return [...ADMIN_PREVIEW_IMAGE_SLUGS, ...extra];
}

/** Typische Generation-Slugs; weitere Keys aus der DB werden ergänzt. */
export const ADMIN_GENERATION_SLUG_PRESET: readonly string[] = [
  "front",
  "rear",
  "left",
  "right",
  "front_right",
  "front_left",
  "rear_left",
  "rear_right",
  "dashboard",
  "steeringwheel",
];

export const ADMIN_GENERATION_SLUG_LABELS: Record<string, string> = {
  front: "Front",
  rear: "Heck",
  left: "Links",
  right: "Rechts",
  front_right: "Vorne rechts",
  front_left: "Vorne links",
  rear_left: "Hinten links",
  rear_right: "Hinten rechts",
  dashboard: "Armaturenbrett",
  steeringwheel: "Lenkrad",
};

export function parseGenerationViewsForAdmin(raw: unknown): Record<string, boolean> {
  let obj = raw;
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const w = (obj as Record<string, unknown>).views;
    if (w && typeof w === "object" && !Array.isArray(w)) obj = w;
  }
  const out: Record<string, boolean> = {};
  for (const slug of ADMIN_GENERATION_SLUG_PRESET) out[slug] = false;
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = k.trim().toLowerCase();
    if (!key) continue;
    out[key] = v === true;
  }
  return out;
}

export function generationSlugOrder(map: Record<string, boolean>): string[] {
  const keys = Object.keys(map);
  const preset = new Set(ADMIN_GENERATION_SLUG_PRESET);
  const first = ADMIN_GENERATION_SLUG_PRESET.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !preset.has(k)).sort();
  return [...first, ...rest];
}

export function normalizeGoogleTemplateForAdmin(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const t = (raw as Record<string, unknown>).template;
    if (typeof t === "string") return t;
  }
  return "";
}

export function viewsListFromSettingRaw(raw: unknown): string[] {
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw
      .map((v) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
      .filter(Boolean);
  }
  if (raw && typeof raw === "object") {
    const v = (raw as Record<string, unknown>).views;
    if (Array.isArray(v)) {
      return v
        .map((x) => (typeof x === "string" ? x.trim().toLowerCase() : ""))
        .filter(Boolean);
    }
    if (typeof v === "string") {
      return v
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }
  }
  return [];
}

/** Speichert als Objekt `{ views: string[] }` — von allen bestehenden Parsern unterstützt. */
export function serializeViewsListForSetting(views: readonly string[]): {
  views: string[];
} {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of views) {
    const s = v.trim().toLowerCase();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return { views: out };
}

export function parseImageAiForAdmin(raw: unknown): 0 | 1 {
  if (typeof raw === "number" && (raw === 0 || raw === 1)) return raw;
  if (typeof raw === "string") {
    const n = Number(raw.trim());
    if (n === 0 || n === 1) return n;
  }
  return 1;
}

/** Ladezustand für die strukturierten Admin-Editoren. */
export function adminInitialDraft(settingId: string, raw: unknown): unknown {
  switch (settingId) {
    case "controll_buttons":
      return mergeControllButtonsFromDb(raw);
    case "active_controll_mode":
      return mergeActiveControllModeFromDb(raw);
    case "preview_images":
      return parsePreviewImagesForAdmin(raw);
    case "generation_views":
      return parseGenerationViewsForAdmin(raw);
    case "google_image_search":
      return normalizeGoogleTemplateForAdmin(raw);
    case "first_views":
    case "inside_views":
      return viewsListFromSettingRaw(raw);
    case "image_ai":
      return parseImageAiForAdmin(raw);
    default:
      return raw;
  }
}

/** Payload für `PUT /api/admin/settings` aus dem Formularzustand. */
export function adminSerializeForPut(settingId: string, draft: unknown): unknown {
  switch (settingId) {
    case "first_views":
    case "inside_views":
      return serializeViewsListForSetting(draft as string[]);
    case "preview_images":
      return serializePreviewImagesForAdmin(
        draft as Record<string, string>,
      );
    case "google_image_search":
      return draft as string;
    default:
      return draft;
  }
}
