/**
 * GET /api/configs/google-image-search
 *
 * Liest `settings.config` für `id = 'google_image_search'`. Liefert das
 * Template, das im Frontend zur Erzeugung der Google-Bildersuche-URL
 * benutzt wird.
 *
 * Antwort:
 * ```json
 * {
 *   "template": "Schaue mir bilder von einem {{marke}} {{model}} …",
 *   "_meta":    { "source": "database" | "default", "configsBound": true }
 * }
 * ```
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  DEFAULT_GOOGLE_IMAGE_SEARCH_CONFIG,
  GOOGLE_IMAGE_SEARCH_SETTING_ID,
  normalizeGoogleImageSearchConfig,
  parseSettingsConfigColumn,
  type GoogleImageSearchConfig,
} from "../../_lib/googleImageSearchConfig";

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  let cfg: GoogleImageSearchConfig = DEFAULT_GOOGLE_IMAGE_SEARCH_CONFIG;
  let source: "database" | "default" = "default";

  if (env.configs) {
    try {
      const row = await env.configs
        .prepare("SELECT config FROM settings WHERE id = ?")
        .bind(GOOGLE_IMAGE_SEARCH_SETTING_ID)
        .first<{ config: unknown }>();
      const parsed = parseSettingsConfigColumn(row?.config ?? null);
      if (parsed != null) {
        cfg = normalizeGoogleImageSearchConfig(parsed);
        source = "database";
      }
    } catch {
      cfg = DEFAULT_GOOGLE_IMAGE_SEARCH_CONFIG;
      source = "default";
    }
  }

  return jsonResponse(
    {
      template: cfg.template,
      _meta: { source, configsBound: Boolean(env.configs) },
    },
    { status: 200 },
  );
};
