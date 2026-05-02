/**
 * GET /api/configs/first-views
 *
 * Liest `settings.config` für `id = 'first_views'`. Liefert die Liste
 * der Ansichten, die zuerst bearbeitet werden müssen.
 *
 * Antwort:
 * ```json
 * {
 *   "views": ["front","rear","right","left", …],
 *   "_meta": { "source": "database" | "default", "configsBound": true }
 * }
 * ```
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  DEFAULT_FIRST_VIEWS_CONFIG,
  FIRST_VIEWS_SETTING_ID,
  normalizeFirstViewsConfig,
  parseSettingsConfigColumn,
  type FirstViewsConfig,
} from "../../_lib/firstViewsConfig";

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  let cfg: FirstViewsConfig = DEFAULT_FIRST_VIEWS_CONFIG;
  let source: "database" | "default" = "default";

  if (env.configs) {
    try {
      const row = await env.configs
        .prepare("SELECT config FROM settings WHERE id = ?")
        .bind(FIRST_VIEWS_SETTING_ID)
        .first<{ config: unknown }>();
      const parsed = parseSettingsConfigColumn(row?.config ?? null);
      if (parsed != null) {
        cfg = normalizeFirstViewsConfig(parsed);
        source = "database";
      }
    } catch {
      cfg = DEFAULT_FIRST_VIEWS_CONFIG;
      source = "default";
    }
  }

  return jsonResponse(
    {
      views: cfg.views,
      _meta: { source, configsBound: Boolean(env.configs) },
    },
    { status: 200 },
  );
};
