/**
 * GET /api/databases/test-key-activate?go=1
 *
 * EINMALIG — legt einen manuellen Test-Key in der KV `customer_keys` an, mit
 * harter Ablaufzeit (native KV-Expiration) heute 22:00 deutscher Zeit. Wird
 * gebraucht, weil das CLI-Cloudflare-Token gerade nicht verfügbar ist; der
 * eingeloggte Nutzer aktiviert den Key per Klick. Danach wieder entfernen.
 *
 * Voll-Zugriff (alle Ansichten/Farben/Formate/Marken) zum Testen der API.
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const KEY = "VI-f298564dbeb8dcfbdad63a0d30750d559f460cc9c5500f98";
// Heute 2026-06-25, 22:00 Europe/Berlin (CEST, UTC+2) = 20:00 UTC.
const EXPIRES_EPOCH = 1782417600;
const EXPIRES_ISO = "2026-06-25T20:00:00Z";

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const kv = env.customer_keys;
  if (!kv) {
    return jsonResponse(
      { error: "KV-Binding `customer_keys` fehlt." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  if (url.searchParams.get("go") !== "1") {
    return jsonResponse({
      info: "Mit ?go=1 öffnen, um den Test-Key zu aktivieren.",
      key: KEY,
      expires_at: EXPIRES_ISO,
    });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (EXPIRES_EPOCH <= nowSec + 60) {
    return jsonResponse(
      { error: "Ablaufzeit liegt (fast) in der Vergangenheit — nicht angelegt." },
      { status: 400 },
    );
  }

  const value = {
    status: "granted",
    customer: {
      email: "test@vehicleimagery.com",
      stripe_customer_id: "manual-test",
      stripe_subscription_id: "manual-test",
    },
    metadata: {
      created_at: new Date().toISOString(),
      expires_at: EXPIRES_ISO,
      note: "Manueller Test-Key — läuft heute 22:00 (DE) automatisch ab.",
    },
    plan_id: "test_temp",
    plan: {
      plan_name: "Test-Key (22:00 Ablauf)",
      features: {
        allow_shadow: true,
        allow_transparent: true,
        allow_getall: true,
        allow_debug: false,
        allow_fallbacks: true,
        watermark_images: false,
      },
      asset_rules: {
        allowed_formats: ["png", "jpg", "jpeg", "webp"],
        allowed_resolutions: ["default", "*"],
        allowed_views: ["*"],
        allowed_colors: ["*"],
      },
      content_restrictions: {
        is_test_mode: false,
        allowed_vehicle_ids: ["*"],
        year_range: { min: 1800, max: 2077 },
        allowed_brands: ["*"],
        blocked_brands: [],
        blocked_models: {},
      },
      infrastructure: {
        custom_cdn: "images.vehicleimagery.com",
        analytics_env_name: "production",
        cache_ttl_seconds: 3600,
      },
    },
  };

  await kv.put(KEY, JSON.stringify(value), { expiration: EXPIRES_EPOCH });

  return jsonResponse({
    ok: true,
    key: KEY,
    expires_at: EXPIRES_ISO,
    expires_local: "2026-06-25 22:00 (Europe/Berlin)",
  });
};
