/**
 * GET /api/configs/active-controll-mode
 *
 * Liest `settings.config` für `id = 'active_controll_mode'` aus D1-Binding
 * `configs`. Liefert eine Map mode → boolean, die im Frontend steuert,
 * welche Modi (Korrektur, Skalierung, …) im Modus-Dropdown sichtbar sind.
 *
 * Antwort:
 * ```json
 * {
 *   "modes": { "correction": true, "scaling": true, "shadow": false, "transparency": false },
 *   "_meta": { "source": "database" | "default", "configsBound": true }
 * }
 * ```
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  ACTIVE_CONTROLL_MODE_SETTING_ID,
  DEFAULT_ACTIVE_CONTROLL_MODE_CONFIG,
  mergeActiveControllModeFromDb,
  parseSettingsConfigColumn,
  type ActiveControllModeConfig,
} from "../../_lib/activeControllModeConfig";

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  let modes: ActiveControllModeConfig = DEFAULT_ACTIVE_CONTROLL_MODE_CONFIG;
  let source: "database" | "default" = "default";

  if (env.configs) {
    try {
      const row = await env.configs
        .prepare("SELECT config FROM settings WHERE id = ?")
        .bind(ACTIVE_CONTROLL_MODE_SETTING_ID)
        .first<{ config: unknown }>();
      const parsed = parseSettingsConfigColumn(row?.config ?? null);
      if (parsed != null) {
        modes = mergeActiveControllModeFromDb(parsed);
        source = "database";
      }
    } catch {
      modes = DEFAULT_ACTIVE_CONTROLL_MODE_CONFIG;
      source = "default";
    }
  }

  return jsonResponse(
    {
      modes,
      _meta: { source, configsBound: Boolean(env.configs) },
    },
    { status: 200 },
  );
};
