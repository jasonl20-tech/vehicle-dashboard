/**
 * Erlaubte Modelle für E-Mail-HTML-Chat (Allowlist gegen Missbrauch).
 * Mix aus Workers AI (@cf/…) und ggf. weiteren über dasselbe Binding
 * erreichbaren IDs — je nach Cloudflare-Konto und aktivierten Anbietern.
 */
export const WORKERS_AI_EMAIL_MODELS: { id: string; label: string }[] = [
  { id: "anthropic/claude-opus-4.7", label: "Anthropic · Claude Opus 4.7" },
  { id: "openai/gpt-5.5-pro", label: "OpenAI · GPT-5.5 Pro" },
  { id: "openai/gpt-5.5", label: "OpenAI · GPT-5.5" },
  { id: "google/gemini-3-flash", label: "Google · Gemini 3 Flash" },
  { id: "alibaba/qwen3-max", label: "Alibaba · Qwen3 Max" },
  { id: "google/gemini-3.1-pro", label: "Google · Gemini 3.1 Pro" },
  {
    id: "@cf/google/gemma-4-26b-a4b-it",
    label: "CF · Gemma 4 · 26B IT",
  },
  { id: "minimax/m2.7", label: "MiniMax · M2.7" },
  {
    id: "@cf/moonshotai/kimi-k2.5",
    label: "CF · Kimi K2.5",
  },
  {
    id: "@cf/nvidia/nemotron-3-120b-a12b",
    label: "CF · NVIDIA Nemotron 3 · 120B",
  },
];

export const DEFAULT_WORKERS_AI_EMAIL_MODEL = WORKERS_AI_EMAIL_MODELS[0].id;

export function isAllowedEmailAiModel(id: string): boolean {
  return WORKERS_AI_EMAIL_MODELS.some((m) => m.id === id);
}
