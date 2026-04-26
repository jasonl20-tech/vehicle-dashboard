import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  fetchAllSummaries,
  type CustomerKeySummary,
} from "../../_lib/kvCustomerKeySummaries";

/**
 * Kunden-Keys haben das Format `VI-<32–48 hex>`. Wir akzeptieren defensiv
 * jeden Key zwischen 1 und 200 Zeichen aus einem konservativen Alphabet,
 * damit auch Legacy- oder andere Prefixes funktionieren.
 */
const KEY_RE = /^[A-Za-z0-9_.\-]{1,200}$/;

function requireKv(env: AuthEnv): KVNamespace | Response {
  if (!env.customer_keys) {
    return jsonResponse(
      {
        error:
          "KV-Binding `customer_keys` fehlt. Im Cloudflare-Dashboard unter Functions → Bindings eine KV hinzufügen (Variable `customer_keys`).",
      },
      { status: 503 },
    );
  }
  return env.customer_keys;
}

/**
 * GET /api/customers/keys
 *   `?key=VI-…`: vollständigen Wert lesen.
 *   `?map=email`: { map: { [key]: email }, is_test_key: { [key]: boolean } }
 *   (alle Keys in `is_test_key`; in `map` nur Keys mit E-Mail).
 *   `?view=customer`: nur Keys ohne Kundentest-Plan (kein "test" in plan_id / plan_name).
 *   `?view=test`: nur Kundentest-Keys (s. `isTestKeyPlanName`).
 *   `?view=all` oder ohne view: vollständige Liste (Rückwärtskompatibilität).
 *   Ohne `key`/`map`: Keys + Summary (Email, plan_id, …) gemäß `view`.
 */
export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const kv = requireKv(env);
  if (kv instanceof Response) return kv;

  const url = new URL(request.url);
  const key = (url.searchParams.get("key") || "").trim();
  const map = (url.searchParams.get("map") || "").trim();

  if (key) {
    if (!KEY_RE.test(key)) {
      return jsonResponse({ error: "Ungültiger Key" }, { status: 400 });
    }
    const raw = await kv.get(key, "text");
    if (raw == null) {
      return jsonResponse({ error: "Nicht gefunden" }, { status: 404 });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return jsonResponse(
        { error: "Gespeicherter Wert ist kein gültiges JSON" },
        { status: 500 },
      );
    }
    return jsonResponse({ key, value: parsed, raw }, { status: 200 });
  }

  let summaries = await fetchAllSummaries(kv);
  summaries.sort((a, b) => {
    const ea = (a.email || "~").toLowerCase();
    const eb = (b.email || "~").toLowerCase();
    if (ea !== eb) return ea < eb ? -1 : 1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  if (map === "email") {
    const out: Record<string, string> = {};
    const is_test_key: Record<string, boolean> = {};
    for (const s of summaries) {
      if (s.email) out[s.key] = s.email;
      is_test_key[s.key] = s.is_test_key;
    }
    return jsonResponse({ map: out, is_test_key }, { status: 200 });
  }

  const view = (url.searchParams.get("view") || "all").trim().toLowerCase();
  if (view === "customer") {
    summaries = summaries.filter((s) => !s.is_test_key);
  } else if (view === "test") {
    summaries = summaries.filter((s) => s.is_test_key);
  } else if (view !== "all") {
    return jsonResponse(
      {
        error: `Unbekannter view=${view}. Erlaubt: all, customer, test`,
      },
      { status: 400 },
    );
  }

  return jsonResponse({ keys: summaries }, { status: 200 });
};

type PutBody = { key?: string; value?: unknown };

/**
 * PUT /api/customers/keys
 *   Body: { "key": "VI-…", "value": { ... full kunden-key value … } }
 *   Ersetzt den KV-Wert. Wir prüfen nur Grundstruktur — den eingebetteten
 *   Plan validiert das Frontend (Form), und das Backend speichert das JSON
 *   so, wie es kommt, damit ältere/neue Felder kompatibel bleiben.
 */
export const onRequestPut: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const kv = requireKv(env);
  if (kv instanceof Response) return kv;

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key || !KEY_RE.test(key)) {
    return jsonResponse(
      { error: "key muss 1–200 Zeichen sein (a-z, A-Z, 0-9, _, -, .)" },
      { status: 400 },
    );
  }
  if (
    body.value == null ||
    typeof body.value !== "object" ||
    Array.isArray(body.value)
  ) {
    return jsonResponse(
      { error: "value muss ein Objekt sein" },
      { status: 400 },
    );
  }

  let text: string;
  try {
    text = JSON.stringify(body.value);
  } catch {
    return jsonResponse(
      { error: "value ist nicht serialisierbar" },
      { status: 400 },
    );
  }
  if (text.length > 25 * 1024 * 1024) {
    return jsonResponse({ error: "JSON zu groß (KV-Limit)" }, { status: 400 });
  }

  await kv.put(key, text);
  return jsonResponse({ ok: true, key }, { status: 200 });
};
