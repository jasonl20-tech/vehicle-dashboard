/**
 * GET /api/configs/preview-images
 *
 * Liest `settings.config` für `id = 'preview_images'` aus D1-Binding `configs`.
 * Liefert eine Map view-slug → URL.
 *
 * Antwort:
 * ```json
 * {
 *   "images": { "front": "https://…", "rear": "https://…", … },
 *   "_meta": { "source": "database" | "default", "configsBound": true }
 * }
 * ```
 *
 * Das Frontend lädt die Map einmalig pro Session (lazy beim ersten
 * Preview-Click) und hält sie im React-State; ein zusätzlicher HTTP-Cache
 * ist daher nicht nötig.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  DEFAULT_PREVIEW_IMAGES_CONFIG,
  normalizePreviewImagesConfig,
  parseSettingsConfigColumn,
  PREVIEW_IMAGES_SETTING_ID,
  type PreviewImagesConfig,
} from "../../_lib/previewImagesConfig";

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  let images: PreviewImagesConfig = DEFAULT_PREVIEW_IMAGES_CONFIG;
  let source: "database" | "default" = "default";

  if (env.configs) {
    try {
      const row = await env.configs
        .prepare("SELECT config FROM settings WHERE id = ?")
        .bind(PREVIEW_IMAGES_SETTING_ID)
        .first<{ config: unknown }>();
      const parsed = parseSettingsConfigColumn(row?.config ?? null);
      if (parsed != null) {
        images = normalizePreviewImagesConfig(parsed);
        source = "database";
      }
    } catch {
      images = DEFAULT_PREVIEW_IMAGES_CONFIG;
      source = "default";
    }
  }

  return jsonResponse(
    {
      images,
      _meta: { source, configsBound: Boolean(env.configs) },
    },
    { status: 200 },
  );
};
