/**
 * System-Prompts (KV `prompts`): pro Ansicht ein Key, Wert = JSON.
 */

export const SYSTEM_PROMPTS_URL = "/api/system/prompts";

export type PromptsListResponse = { keys: string[] };

export type PromptOneResponse = {
  key: string;
  value: unknown;
  raw: string;
};

export type SystemPromptValue = {
  prompt: string;
  aspect_ratio: string;
  output_format: string;
  resolution: string;
  google_search: boolean;
  image_search: boolean;
};

export function promptsUrlOne(key: string): string {
  return `${SYSTEM_PROMPTS_URL}?key=${encodeURIComponent(key)}`;
}

export function defaultSystemPrompt(): SystemPromptValue {
  return {
    prompt: "",
    aspect_ratio: "3:2",
    output_format: "png",
    resolution: "1K",
    google_search: false,
    image_search: true,
  };
}

export function parsePromptValue(v: unknown): SystemPromptValue {
  const d = defaultSystemPrompt();
  if (!v || typeof v !== "object" || Array.isArray(v)) return d;
  const o = v as Record<string, unknown>;
  if (typeof o.prompt === "string") d.prompt = o.prompt;
  if (typeof o.aspect_ratio === "string") d.aspect_ratio = o.aspect_ratio;
  if (typeof o.output_format === "string") d.output_format = o.output_format;
  if (typeof o.resolution === "string") d.resolution = o.resolution;
  if (typeof o.google_search === "boolean") d.google_search = o.google_search;
  if (typeof o.image_search === "boolean") d.image_search = o.image_search;
  return d;
}

export async function putSystemPrompt(
  key: string,
  value: SystemPromptValue,
): Promise<void> {
  const res = await fetch(SYSTEM_PROMPTS_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ key, value }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
}
