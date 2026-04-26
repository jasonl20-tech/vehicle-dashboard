import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

/**
 * Kunden-Keys haben das Format `VI-<32–48 hex>`. Wir akzeptieren defensiv
 * jeden Key zwischen 1 und 200 Zeichen aus einem konservativen Alphabet,
 * damit auch Legacy- oder andere Prefixes funktionieren.
 */
const KEY_RE = /^[A-Za-z0-9_.\-]{1,200}$/;

/**
 * Maximale Anzahl an parallel gefetchten KV-Werten pro Batch. Cloudflare
 * Workers können viele Subrequests parallel ausführen, aber wir wollen
 * weder die KV-API drosseln noch den Worker zu lange offen halten.
 */
const FETCH_BATCH = 32;

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
 * Komprimierte Übersicht eines Kunden-Keys. Reicht für Sidebar, Suche
 * und das „Email statt Key"-Mapping in der API-Analytics.
 */
type CustomerKeySummary = {
  key: string;
  status: string | null;
  email: string | null;
  plan_id: string | null;
  plan_name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string | null;
  is_test_mode: boolean | null;
  /**
   * Test-Key: `plan_id` oder eingebetteter `plan_name` enthält (Groß/Klein egal)
   * die Zeichenkette "test" (z. B. `plan_test`, `my_test_api`).
   */
  is_test_key: boolean;
  /**
   * Geschätzter oder expliziter Ablaufzeitpunkt (ISO 8601 UTC), falls ermittelbar.
   * Quellen: `expire` / `expires_at` am Root, `metadata.expire` / `expires_at`,
   * sonst `created_at` + `plan.expires_in_seconds`.
   */
  expires_at: string | null;
};

/**
 * Liest Ablaufdatum aus flexiblen Feldern; Fallback: Erstellung + Plan-TTL.
 */
function pickExpiresAtIso(
  parsed: Record<string, unknown>,
  metadata: Record<string, unknown>,
  plan: Record<string, unknown> | null | undefined,
): string | null {
  const tryParse = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v === "string" && v.trim()) {
      const t = Date.parse(v.trim());
      if (!isNaN(t)) return new Date(t).toISOString();
    }
    if (typeof v === "number" && v > 0) {
      const ms = v < 1e12 ? v * 1000 : v;
      return new Date(ms).toISOString();
    }
    return null;
  };

  const fromFields = tryParse(parsed.expire) ?? tryParse(parsed.expires_at);
  if (fromFields) return fromFields;
  const fromMeta =
    tryParse(metadata.expire) ??
    tryParse(metadata.expires_at) ??
    tryParse((metadata as Record<string, unknown>).expired_at);
  if (fromMeta) return fromMeta;

  const created =
    typeof metadata.created_at === "string" ? metadata.created_at : null;
  const sec = plan?.expires_in_seconds;
  if (created && typeof sec === "number" && sec > 0) {
    const t0 = Date.parse(created);
    if (!isNaN(t0)) {
      return new Date(t0 + sec * 1000).toISOString();
    }
  }
  return null;
}

/** True, wenn `test` in `plan_id` oder im Plan-Namen vorkommt (Kundentest-Keys). */
function isTestKeyPlanName(
  planId: string | null,
  planName: string | null,
): boolean {
  const a = (planId ?? "").toLowerCase();
  const b = (planName ?? "").toLowerCase();
  return a.includes("test") || b.includes("test");
}

function summarize(
  key: string,
  raw: string | null,
): CustomerKeySummary | null {
  if (!raw) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      key,
      status: null,
      email: null,
      plan_id: null,
      plan_name: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      created_at: null,
      is_test_mode: null,
      is_test_key: false,
      expires_at: null,
    };
  }
  const customer =
    (parsed?.customer as Record<string, unknown> | null | undefined) ?? null;
  const metadata =
    (parsed?.metadata as Record<string, unknown> | null | undefined) ?? {};
  const plan =
    (parsed?.plan as Record<string, unknown> | null | undefined) ?? null;
  const restrictions =
    (plan?.content_restrictions as Record<string, unknown> | null | undefined) ??
    null;
  const planId =
    typeof parsed?.plan_id === "string" ? (parsed.plan_id as string) : null;
  const planNameFromPlan =
    typeof plan?.plan_name === "string" ? (plan.plan_name as string) : null;
  const expiresAt = pickExpiresAtIso(
    parsed,
    metadata,
    plan ?? undefined,
  );
  const isTestKey = isTestKeyPlanName(planId, planNameFromPlan);

  return {
    key,
    status: typeof parsed?.status === "string" ? (parsed.status as string) : null,
    email:
      typeof customer?.email === "string" ? (customer.email as string) : null,
    plan_id: planId,
    plan_name: planNameFromPlan,
    stripe_customer_id:
      typeof customer?.stripe_customer_id === "string"
        ? (customer.stripe_customer_id as string)
        : null,
    stripe_subscription_id:
      typeof customer?.stripe_subscription_id === "string"
        ? (customer.stripe_subscription_id as string)
        : null,
    created_at:
      typeof metadata?.created_at === "string"
        ? (metadata.created_at as string)
        : null,
    is_test_mode:
      typeof restrictions?.is_test_mode === "boolean"
        ? (restrictions.is_test_mode as boolean)
        : null,
    is_test_key: isTestKey,
    expires_at: expiresAt,
  };
}

async function fetchAllSummaries(
  kv: KVNamespace,
): Promise<CustomerKeySummary[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: "", limit: 1000, cursor });
    for (const e of page.keys) names.push(e.name);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const out: CustomerKeySummary[] = [];
  for (let i = 0; i < names.length; i += FETCH_BATCH) {
    const slice = names.slice(i, i + FETCH_BATCH);
    const settled = await Promise.all(
      slice.map(async (name) => {
        try {
          const raw = await kv.get(name, "text");
          return summarize(name, raw);
        } catch {
          return null;
        }
      }),
    );
    for (const s of settled) if (s) out.push(s);
  }
  return out;
}

/**
 * GET /api/customers/keys
 *   `?key=VI-…`: vollständigen Wert lesen.
 *   `?map=email`: Map { [key]: email } (alle Keys, ungefiltert).
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
    for (const s of summaries) {
      if (s.email) out[s.key] = s.email;
    }
    return jsonResponse({ map: out }, { status: 200 });
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
