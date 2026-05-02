/**
 * GET /api/configs/generation-views
 *
 * Liest `settings.config` für `id = 'generation_views'` aus D1-Binding
 * `configs`. Liefert eine Map view-slug → boolean. Slugs mit `true`
 * dürfen im UI als „+"-Button erscheinen, wenn das Fahrzeug die Ansicht
 * noch nicht hat.
 *
 * Antwort:
 * ```json
 * {
 *   "views": { "front": true, "rear": true, "steeringwheel": false, … },
 *   "_meta": { "source": "database" | "default", "configsBound": true }
 * }
 * ```
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  DEFAULT_GENERATION_VIEWS_CONFIG,
  GENERATION_VIEWS_SETTING_ID,
  normalizeGenerationViewsConfig,
  parseSettingsConfigColumn,
  type GenerationViewsConfig,
} from "../../_lib/generationViewsConfig";

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  let views: GenerationViewsConfig = DEFAULT_GENERATION_VIEWS_CONFIG;
  let source: "database" | "default" = "default";

  if (env.configs) {
    try {
      const row = await env.configs
        .prepare("SELECT config FROM settings WHERE id = ?")
        .bind(GENERATION_VIEWS_SETTING_ID)
        .first<{ config: unknown }>();
      const parsed = parseSettingsConfigColumn(row?.config ?? null);
      if (parsed != null) {
        views = normalizeGenerationViewsConfig(parsed);
        source = "database";
      }
    } catch {
      views = DEFAULT_GENERATION_VIEWS_CONFIG;
      source = "default";
    }
  }

  return jsonResponse(
    {
      views,
      _meta: { source, configsBound: Boolean(env.configs) },
    },
    { status: 200 },
  );
};
