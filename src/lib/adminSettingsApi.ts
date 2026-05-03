/**
 * D1 `configs.settings` — Admin-API unter `/api/admin/settings`.
 */

export const ADMIN_SETTINGS_URL = "/api/admin/settings";

export type AdminSettingRow = {
  id: string;
  config: unknown;
  description: string | null;
};

export type AdminSettingsListResponse = {
  rows: AdminSettingRow[];
  configsBound?: boolean;
};

export type AdminSettingsPutResponse = {
  ok: boolean;
  row: AdminSettingRow;
};

/** Feste Reihenfolge bekannter Keys; weitere alphabetisch danach. */
export const ADMIN_SETTINGS_DISPLAY_ORDER: readonly string[] = [
  "controll_buttons",
  "preview_images",
  "active_controll_mode",
  "generation_views",
  "google_image_search",
  "first_views",
  "image_ai",
  "inside_views",
];

export const ADMIN_SETTINGS_LABELS: Record<string, string> = {
  controll_buttons: "Controll-Buttons",
  preview_images: "Preview-Bilder",
  active_controll_mode: "Aktive Controll-Modi",
  generation_views: "Generation-Ansichten",
  google_image_search: "Google-Bildsuche",
  first_views: "First Views",
  image_ai: "Image-AI",
  inside_views: "Inside Views",
};

/** Kurzbeschreibung unter dem Formulartitel (wie in der DB-Spalte description). */
export const ADMIN_SETTINGS_HINTS: Record<string, string> = {
  controll_buttons:
    "Aktiviert die Buttons der Control Platform pro Modus (Correct, Regenerieren, Löschen, …).",
  preview_images:
    "Referenz-URLs pro Ansicht für die Vorschau-Lightbox in der Control Platform.",
  active_controll_mode:
    "Welche Modi (Korrektur, Skalierung, Schatten, Transparenz) im Modus-Dropdown erscheinen.",
  generation_views:
    "Welche fehlenden Ansichten per „+“ / Dashboard-Generierung angeboten werden dürfen.",
  google_image_search:
    "Suchvorlage für den Google-Bilder-Button; Platzhalter wie {{marke}}, {{ansicht}}.",
  first_views:
    "Ansichten, die zuerst als „correct“ abgeschlossen sein müssen, bevor andere freigeschaltet sind.",
  image_ai:
    "0 = Nano banana (Vertex), 1 = Nano banana (Kie.ai).",
  inside_views:
    "Inside-Ansichten: bei „correct“ wie Skalierung-Correct behandelt (siehe Control-Flow).",
};

export function sortAdminSettingRows(rows: AdminSettingRow[]): AdminSettingRow[] {
  const order = new Map(
    ADMIN_SETTINGS_DISPLAY_ORDER.map((id, i) => [id, i] as const),
  );
  return [...rows].sort((a, b) => {
    const ia = order.get(a.id);
    const ib = order.get(b.id);
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return a.id.localeCompare(b.id);
  });
}

export function configToAdminEditorText(config: unknown): string {
  return JSON.stringify(config ?? null, null, 2);
}

export async function fetchAdminSettings(): Promise<AdminSettingsListResponse> {
  const res = await fetch(ADMIN_SETTINGS_URL, { credentials: "include" });
  const j = (await res.json().catch(() => ({}))) as AdminSettingsListResponse & {
    error?: string;
  };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

export async function putAdminSetting(row: {
  id: string;
  config: unknown;
  description: string | null;
}): Promise<AdminSettingsPutResponse> {
  const res = await fetch(ADMIN_SETTINGS_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(row),
  });
  const j = (await res.json().catch(() => ({}))) as AdminSettingsPutResponse & {
    error?: string;
  };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}
