/**
 * Erlaubte Workers-AI-Modelle für E-Mail-HTML-Chat (Allowlist gegen Missbrauch).
 * Neue Modelle: Eintrag hier + Deploy. Siehe https://developers.cloudflare.com/workers-ai/models/
 */
export const WORKERS_AI_EMAIL_MODELS: { id: string; label: string }[] = [
  {
    id: "@cf/meta/llama-3.1-8b-instruct",
    label: "Llama 3.1 · 8B Instruct",
  },
  {
    id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    label: "Llama 3.3 · 70B (schnell)",
  },
  {
    id: "@cf/mistral/mistral-7b-instruct-v0.2",
    label: "Mistral · 7B Instruct",
  },
  {
    id: "@cf/qwen/qwen2.5-coder-32b-instruct",
    label: "Qwen 2.5 Coder · 32B (HTML/Code)",
  },
  {
    id: "@cf/google/gemma-2-9b-it",
    label: "Gemma 2 · 9B IT",
  },
];

export const DEFAULT_WORKERS_AI_EMAIL_MODEL = WORKERS_AI_EMAIL_MODELS[0].id;

export function isAllowedEmailAiModel(id: string): boolean {
  return WORKERS_AI_EMAIL_MODELS.some((m) => m.id === id);
}
