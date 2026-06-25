/**
 * GET /api/databases/test-key-activate?go=1
 *
 * EINMALIG — legt einen manuellen Test-Key in der KV `customer_keys` an, mit
 * hartem Ablauf heute 22:00 deutscher Zeit (native KV-Expiration). Der Umfang
 * wird von den ECHTEN automatischen Test-Keys GEKLONT (häufigste Umfang-
 * Signatur unter allen „test"-Keys) — so passt der Umfang exakt, ohne die
 * Vorlage des Keymanager-Workers zu kennen.
 *
 * Gebraucht, weil das CLI-Cloudflare-Token gerade fehlt; der eingeloggte
 * Nutzer aktiviert per Klick. Danach wieder entfernen.
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const KEY = "VI-f298564dbeb8dcfbdad63a0d30750d559f460cc9c5500f98";
// Heute 2026-06-25, 22:00 Europe/Berlin (CEST) = 20:00 UTC.
const EXPIRES_EPOCH = 1782417600;
const EXPIRES_ISO = "2026-06-25T20:00:00Z";

function isTest(planId: unknown, planName: unknown): boolean {
  const a = String(planId ?? "").toLowerCase();
  const b = String(planName ?? "").toLowerCase();
  return a.includes("test") || b.includes("test");
}

const FALLBACK_PLAN: Record<string, unknown> = {
  plan_name: "Test-Key",
  features: {
    allow_shadow: false,
    allow_transparent: false,
    allow_getall: false,
    allow_debug: false,
    allow_fallbacks: true,
    watermark_images: false,
  },
  asset_rules: {
    allowed_formats: ["png"],
    allowed_resolutions: ["default"],
    allowed_views: ["front"],
    allowed_colors: ["default"],
  },
  content_restrictions: {
    is_test_mode: false,
    allowed_vehicle_ids: [],
    year_range: { min: 2010, max: 2015 },
    allowed_brands: [],
    blocked_brands: [],
    blocked_models: {},
  },
  infrastructure: {
    custom_cdn: "images.vehicleimagery.com",
    analytics_env_name: "production",
    cache_ttl_seconds: 604800,
  },
};

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

  const go = new URL(request.url).searchParams.get("go") === "1";

  // Key-Namen sammeln (paginiert).
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ limit: 1000, cursor });
    for (const k of page.keys) names.push(k.name);
    cursor = page.list_complete ? undefined : (page.cursor ?? undefined);
  } while (cursor);

  // Echte Test-Keys lesen (begrenzt), Umfang-Signaturen zählen.
  type Rec = { plan: Record<string, unknown>; planId: string; sig: string };
  const testPlans: Rec[] = [];
  let scanned = 0;
  for (const name of names) {
    if (name === KEY) continue;
    if (scanned >= 300 || testPlans.length >= 25) break;
    scanned++;
    let parsed: Record<string, unknown> | null = null;
    try {
      const raw = await kv.get(name, "text");
      parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      parsed = null;
    }
    if (!parsed) continue;
    const plan = (parsed.plan as Record<string, unknown>) || {};
    const planId = String(parsed.plan_id ?? "");
    const planName = String(plan.plan_name ?? "");
    if (!isTest(planId, planName)) continue;
    const sig = JSON.stringify({
      ar: plan.asset_rules ?? null,
      ft: plan.features ?? null,
      cr: plan.content_restrictions ?? plan.content ?? null,
    });
    testPlans.push({ plan, planId, sig });
  }

  // Häufigste Umfang-Signatur = die automatisch ausgestellten Test-Keys.
  let chosen: Rec | null = null;
  if (testPlans.length) {
    const counts = new Map<string, number>();
    for (const p of testPlans) counts.set(p.sig, (counts.get(p.sig) ?? 0) + 1);
    let bestSig = "";
    let bestN = -1;
    for (const [sig, n] of counts) {
      if (n > bestN) {
        bestSig = sig;
        bestN = n;
      }
    }
    chosen = testPlans.find((p) => p.sig === bestSig) ?? null;
  }

  const scope = chosen
    ? {
        from_plan_id: chosen.planId,
        asset_rules: chosen.plan.asset_rules,
        features: chosen.plan.features,
        content_restrictions:
          chosen.plan.content_restrictions ?? chosen.plan.content,
      }
    : { fallback: true, ...FALLBACK_PLAN };

  if (!go) {
    return jsonResponse({
      info: "Mit ?go=1 öffnen, um den Test-Key anzulegen (Umfang = automatische Test-Keys).",
      key: KEY,
      test_keys_gescannt: testPlans.length,
      umfang_vorschau: scope,
    });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (EXPIRES_EPOCH <= nowSec + 60) {
    return jsonResponse(
      { error: "Ablaufzeit liegt (fast) in der Vergangenheit — nicht angelegt." },
      { status: 400 },
    );
  }

  const clonedPlan: Record<string, unknown> = chosen
    ? { ...chosen.plan }
    : { ...FALLBACK_PLAN };
  clonedPlan.plan_name = "Test-Key (22:00 Ablauf)";

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
      note: "Manueller Test-Key — Umfang wie automatische Test-Keys, läuft heute 22:00 (DE) automatisch ab.",
    },
    plan_id: "test_temp",
    plan: clonedPlan,
  };

  await kv.put(KEY, JSON.stringify(value), { expiration: EXPIRES_EPOCH });

  return jsonResponse({
    ok: true,
    key: KEY,
    expires_at: EXPIRES_ISO,
    expires_local: "2026-06-25 22:00 (Europe/Berlin)",
    umfang_geklont_von: chosen ? chosen.planId : "(kein Test-Key gefunden → Default)",
    umfang: scope,
  });
};
