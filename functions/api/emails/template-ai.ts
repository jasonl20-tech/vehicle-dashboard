/**
 * Workers AI: Chat-Hilfe für E-Mail-HTML im Dashboard.
 *
 * GET  /api/emails/template-ai
 *   → { models: { id, label }[], defaultModel }
 *
 * POST /api/emails/template-ai
 *   Body: { model?, currentHtml?, messages: { role, content }[] }
 *   → { reply, html|null, model }
 *
 * Binding: Pages → Workers AI als `workersai` oder `AI` (siehe getWorkersAiBinding).
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import { getWorkersAiBinding } from "../../_lib/workersAiBinding";
import {
  DEFAULT_WORKERS_AI_EMAIL_MODEL,
  WORKERS_AI_EMAIL_MODELS,
  isAllowedEmailAiModel,
} from "../../_lib/workersAiEmailModels";

const MAX_HTML_SNIPPET = 100_000;
const MAX_MSG = 28;
const MAX_CONTENT_LEN = 8_000;
const MAX_TOKENS = 2_048;

type ClientMsg = { role?: string; content?: string };

function extractAiText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  const o = result as Record<string, unknown>;
  if (typeof o.response === "string") return o.response;
  if (typeof o.text === "string") return o.text;
  return "";
}

function parseAssistantJson(text: string): {
  reply: string;
  html: string | null;
} {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  const inner = (fenced?.[1] ?? trimmed).trim();
  try {
    const j = JSON.parse(inner) as {
      reply?: unknown;
      html?: unknown;
    };
    const reply =
      typeof j.reply === "string" && j.reply.trim()
        ? j.reply
        : trimmed;
    let html: string | null = null;
    if (typeof j.html === "string" && j.html.trim()) {
      html = j.html.trim();
    }
    return { reply, html };
  } catch {
    return { reply: trimmed, html: null };
  }
}

function buildSystemPrompt(htmlSlice: string): string {
  return [
    "Du hilfst beim Bearbeiten von E-Mail-HTML (E-Mail-Body, typischerweise Tabellen-Layouts, keine vollständige Webseite mit <html> nötig).",
    "Antworte auf Deutsch in gültigem JSON ohne Markdown drumherum:",
    '{"reply":"kurze Antwort an die Person","html":null}',
    'oder wenn du den vollständigen neuen E-Mail-Body ausgeben sollst: {"reply":"Was du geändert hast","html":"<table...>"}',
    "Wenn du nur erklärst oder fragst, setze html auf null.",
    "Wenn du Code lieferst: html muss der komplette ersetzende Body sein (ein zusammenhängendes Fragment oder komplettes HTML).",
    "Erfinde keine externen URLs. Platzhalter wie {{name}} beibehalten.",
    "Keine <script>-Tags. Keine JavaScript-URLs.",
    "",
    "Aktueller HTML-Body der Vorlage (ggf. gekürzt):",
    "```",
    htmlSlice,
    "```",
  ].join("\n");
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const aiConfigured = getWorkersAiBinding(env) !== null;
  return jsonResponse(
    {
      models: WORKERS_AI_EMAIL_MODELS,
      defaultModel: DEFAULT_WORKERS_AI_EMAIL_MODEL,
      aiConfigured,
      ...(aiConfigured
        ? {}
        : {
            hint: 'Workers AI-Binding fehlt: Pages → Functions → Bindings → „Workers AI“ (Variable z. B. `workersai`).',
          }),
    },
    { status: 200 },
  );
};

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const ai = getWorkersAiBinding(env);
  if (!ai) {
    return jsonResponse(
      {
        error:
          "Workers AI-Binding fehlt. Unter Pages → Settings → Functions → Bindings „Workers AI“ hinzufügen (Variable z. B. `workersai` oder `AI`).",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültiges JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return jsonResponse({ error: "Body erwartet" }, { status: 400 });
  }

  const b = body as {
    model?: string;
    currentHtml?: string;
    messages?: ClientMsg[];
  };

  const model =
    typeof b.model === "string" && isAllowedEmailAiModel(b.model)
      ? b.model
      : DEFAULT_WORKERS_AI_EMAIL_MODEL;

  const currentHtml =
    typeof b.currentHtml === "string" ? b.currentHtml : "";
  const htmlSlice =
    currentHtml.length > MAX_HTML_SNIPPET
      ? `${currentHtml.slice(0, MAX_HTML_SNIPPET)}\n\n<!-- … gekürzt … -->`
      : currentHtml;

  const rawMsgs = Array.isArray(b.messages) ? b.messages : [];
  const messages: { role: string; content: string }[] = [];

  for (const m of rawMsgs.slice(-MAX_MSG)) {
    if (!m || typeof m !== "object") continue;
    const role = m.role;
    const content = m.content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string" || !content.trim()) continue;
    messages.push({
      role,
      content:
        content.length > MAX_CONTENT_LEN
          ? `${content.slice(0, MAX_CONTENT_LEN)}…`
          : content,
    });
  }

  if (messages.length === 0) {
    return jsonResponse(
      { error: "Mindestens eine Nutzernachricht (role: user) nötig" },
      { status: 400 },
    );
  }

  const last = messages[messages.length - 1];
  if (last.role !== "user") {
    return jsonResponse(
      { error: "Die letzte Nachricht muss vom Nutzer sein" },
      { status: 400 },
    );
  }

  const sys = buildSystemPrompt(htmlSlice);
  const outMessages: {
    role: "system" | "user" | "assistant";
    content: string;
  }[] = [{ role: "system", content: sys }];
  for (const m of messages) {
    outMessages.push({
      role: m.role as "user" | "assistant",
      content: m.content,
    });
  }

  let result: unknown;
  try {
    result = await ai.run(model, {
      messages: outMessages,
      max_tokens: MAX_TOKENS,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse(
      {
        error: `Workers AI: ${msg}`,
        hint: "Modell-ID prüfen und im Dashboard „Workers AI“ für das Konto aktivieren.",
      },
      { status: 502 },
    );
  }

  const rawText = extractAiText(result);
  if (!rawText.trim()) {
    return jsonResponse(
      {
        error: "Leere Modellantwort",
        rawPreview:
          typeof result === "object" && result !== null
            ? JSON.stringify(result).slice(0, 400)
            : undefined,
      },
      { status: 502 },
    );
  }

  const parsed = parseAssistantJson(rawText);
  return jsonResponse(
    {
      reply: parsed.reply,
      html: parsed.html,
      model,
    },
    { status: 200 },
  );
};
