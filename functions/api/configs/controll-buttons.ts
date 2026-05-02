/**
 * GET /api/configs/controll-buttons
 *
 * Liest `settings.config` für `id = 'controll_buttons'` aus D1-Binding `configs`.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  CONTROLL_BUTTONS_SETTING_ID,
  DEFAULT_CONTROLL_BUTTONS_CONFIG,
  mergeControllButtonsFromDb,
  parseSettingsConfigColumn,
} from "../../_lib/controllButtonsConfig";

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  let merged = DEFAULT_CONTROLL_BUTTONS_CONFIG;
  let source: "database" | "default" = "default";

  if (env.configs) {
    try {
      const row = await env.configs
        .prepare("SELECT config FROM settings WHERE id = ?")
        .bind(CONTROLL_BUTTONS_SETTING_ID)
        .first<{ config: unknown }>();
      const parsed = parseSettingsConfigColumn(row?.config ?? null);
      if (parsed != null) {
        merged = mergeControllButtonsFromDb(parsed);
        source = "database";
      }
    } catch {
      merged = DEFAULT_CONTROLL_BUTTONS_CONFIG;
      source = "default";
    }
  }

  return jsonResponse(
    {
      ...merged,
      _meta: { source, configsBound: Boolean(env.configs) },
    },
    { status: 200 },
  );
};
