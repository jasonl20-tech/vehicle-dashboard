import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const CONFIG_KEY = "_config_blocked_vehicles";

type BlockedVehiclesValue = { brands: string[]; models: string[] };

function requireBlockedVehiclesKv(
  env: AuthEnv,
): KVNamespace | Response {
  if (!env.blocked_vehicles) {
    return jsonResponse(
      {
        error:
          "KV-Binding `blocked_vehicles` fehlt. Im Cloudflare-Dashboard unter Functions → Bindings eine KV hinzufügen (Variable `blocked_vehicles`).",
      },
      { status: 503 },
    );
  }
  return env.blocked_vehicles;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function normalizeValue(raw: string | null): { value: BlockedVehiclesValue; raw: string | null } {
  if (raw == null) {
    return { value: { brands: [], models: [] }, raw: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { value: { brands: [], models: [] }, raw };
  }
  if (!isRecord(parsed)) {
    return { value: { brands: [], models: [] }, raw };
  }
  const brands = parsed.brands;
  const models = parsed.models;
  const b = Array.isArray(brands) ? brands.filter((x): x is string => typeof x === "string") : [];
  const m = Array.isArray(models) ? models.filter((x): x is string => typeof x === "string") : [];
  return { value: { brands: b, models: m }, raw };
}

/**
 * GET /api/system/blocked-vehicles
 * Liefert die Konfiguration aus KV-Key `_config_blocked_vehicles` (fehlend = leer).
 */
export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const kv = requireBlockedVehiclesKv(env);
  if (kv instanceof Response) return kv;

  const raw = await kv.get(CONFIG_KEY, "text");
  const { value, raw: r } = normalizeValue(raw);
  return jsonResponse({ value, raw: r, key: CONFIG_KEY }, { status: 200 });
};

/**
 * PUT /api/system/blocked-vehicles
 * Body: { "value": { "brands": string[], "models": string[] } }
 */
export const onRequestPut: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const kv = requireBlockedVehiclesKv(env);
  if (kv instanceof Response) return kv;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }
  if (!isRecord(body) || body.value === undefined) {
    return jsonResponse({ error: "value fehlt" }, { status: 400 });
  }
  const v = body.value;
  if (!isRecord(v)) {
    return jsonResponse({ error: "value muss ein Objekt sein" }, { status: 400 });
  }
  const brands = v.brands;
  const models = v.models;
  if (!Array.isArray(brands) || !Array.isArray(models)) {
    return jsonResponse(
      { error: "brands und models müssen Arrays sein" },
      { status: 400 },
    );
  }
  if (!brands.every((x) => typeof x === "string") || !models.every((x) => typeof x === "string")) {
    return jsonResponse(
      { error: "Einträge müssen Strings sein" },
      { status: 400 },
    );
  }

  const text = JSON.stringify({ brands, models } satisfies BlockedVehiclesValue);
  if (text.length > 25 * 1024 * 1024) {
    return jsonResponse({ error: "JSON zu groß" }, { status: 400 });
  }

  await kv.put(CONFIG_KEY, text);
  return jsonResponse({ ok: true, key: CONFIG_KEY }, { status: 200 });
};
