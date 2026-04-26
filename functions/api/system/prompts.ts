import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

/** Ansichts-Key, z. B. `front_right` */
const KEY_RE = /^[a-zA-Z0-9_.-]{1,200}$/;

function requirePromptsKv(
  env: AuthEnv,
): KVNamespace | Response {
  if (!env.prompts) {
    return jsonResponse(
      {
        error:
          "KV-Binding `prompts` fehlt. Im Cloudflare-Dashboard unter Functions → Bindings eine KV hinzufügen (Variable `prompts`).",
      },
      { status: 503 },
    );
  }
  return env.prompts;
}

/**
 * GET /api/system/prompts
 * Ohne Query: alle Keys auflisten.
 * ?key=front_right: JSON lesen.
 */
export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const kv = requirePromptsKv(env);
  if (kv instanceof Response) return kv;

  const url = new URL(request.url);
  const key = (url.searchParams.get("key") || "").trim();

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

  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: "", limit: 1000, cursor });
    for (const e of page.keys) keys.push(e.name);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  keys.sort();
  return jsonResponse({ keys }, { status: 200 });
};

type PutBody = { key?: string; value?: unknown };

/**
 * PUT /api/system/prompts
 * Body: { "key": "front_right", "value": { ... } }
 */
export const onRequestPut: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const kv = requirePromptsKv(env);
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
  if (body.value === undefined) {
    return jsonResponse({ error: "value fehlt" }, { status: 400 });
  }

  let text: string;
  try {
    text = JSON.stringify(body.value);
  } catch {
    return jsonResponse({ error: "value ist nicht serialisierbar" }, { status: 400 });
  }
  if (text.length > 25 * 1024 * 1024) {
    return jsonResponse({ error: "JSON zu groß (KV-Limit)" }, { status: 400 });
  }

  await kv.put(key, text);
  return jsonResponse({ ok: true, key }, { status: 200 });
};
