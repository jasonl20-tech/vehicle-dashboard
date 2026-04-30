/** API: /api/emails/template-ai — Workers AI Chat für E-Mail-HTML. */

export type TemplateAiModelOption = { id: string; label: string };

export type TemplateAiMetaResponse = {
  models: TemplateAiModelOption[];
  defaultModel: string;
  aiConfigured?: boolean;
  hint?: string;
  error?: string;
};

export type TemplateAiChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type TemplateAiChatResponse = {
  reply: string;
  html: string | null;
  model?: string;
  error?: string;
  hint?: string;
};

export async function fetchTemplateAiMeta(): Promise<TemplateAiMetaResponse> {
  const res = await fetch("/api/emails/template-ai", {
    credentials: "include",
  });
  const json = (await res.json().catch(() => ({}))) as TemplateAiMetaResponse &
    Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      (typeof json.error === "string" && json.error) || `HTTP ${res.status}`,
    );
  }
  return json;
}

export async function postTemplateAiChat(body: {
  model: string;
  currentHtml: string;
  messages: TemplateAiChatTurn[];
}): Promise<TemplateAiChatResponse> {
  const res = await fetch("/api/emails/template-ai", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as TemplateAiChatResponse &
    Record<string, unknown>;
  if (!res.ok) {
    const parts: string[] = [];
    if (typeof json.error === "string") parts.push(json.error);
    if (typeof json.hint === "string") parts.push(json.hint);
    throw new Error(parts.length > 0 ? parts.join(" · ") : `HTTP ${res.status}`);
  }
  return json;
}
