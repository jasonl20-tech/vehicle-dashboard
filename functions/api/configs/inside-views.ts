/**
 * GET /api/configs/inside-views
 *
 * `settings.config` für `id = 'inside_views'`.
 *
 * ```json
 * {
 *   "views": ["dashboard", "steeringwheel"],
 *   "_meta": { "source": "database" | "default", "configsBound": true }
 * }
 * ```
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import { parseSettingsConfigColumn } from "../../_lib/firstViewsConfig";
import {
  DEFAULT_INSIDE_VIEWS_CONFIG,
  INSIDE_VIEWS_SETTING_ID,
  normalizeInsideViewsConfig,
  type InsideViewsConfig,
} from "../../_lib/insideViewsConfig";

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  let cfg: InsideViewsConfig = DEFAULT_INSIDE_VIEWS_CONFIG;
  let source: "database" | "default" = "default";

  if (env.configs) {
    try {
      const row = await env.configs
        .prepare("SELECT config FROM settings WHERE id = ?")
        .bind(INSIDE_VIEWS_SETTING_ID)
        .first<{ config: unknown }>();
      const parsed = parseSettingsConfigColumn(row?.config ?? null);
      if (parsed != null) {
        cfg = normalizeInsideViewsConfig(parsed);
        source = "database";
      }
    } catch {
      cfg = DEFAULT_INSIDE_VIEWS_CONFIG;
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
