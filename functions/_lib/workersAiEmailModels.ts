/**
 * Erlaubte Workers-AI-Modelle für E-Mail-HTML-Chat (Allowlist gegen Missbrauch).
 * Nur @cf/… — direkt über Workers AI; je nach Konto/Region verfügbar.
 */
export const WORKERS_AI_EMAIL_MODELS: { id: string; label: string }[] = [
  { id: "@cf/openai/gpt-oss-120b", label: "OpenAI GPT-OSS · 120B" },
  { id: "@cf/openai/gpt-oss-20b", label: "OpenAI GPT-OSS · 20B" },
  { id: "@cf/moonshotai/kimi-k2.6", label: "Moonshot · Kimi K2.6" },
  { id: "@cf/google/gemma-4-26b-a4b-it", label: "Google · Gemma 4 · 26B IT" },
  {
    id: "@cf/nvidia/nemotron-3-120b-a12b",
    label: "NVIDIA · Nemotron 3 · 120B",
  },
  { id: "@cf/zai-org/glm-4.7-flash", label: "Z.ai · GLM 4.7 Flash" },
  {
    id: "@cf/ibm-granite/granite-4.0-h-micro",
    label: "IBM · Granite 4.0 H Micro",
  },
  { id: "@cf/moonshotai/kimi-k2.5", label: "Moonshot · Kimi K2.5" },
  {
    id: "@cf/aisingapore/gemma-sea-lion-v4-27b-it",
    label: "AI Singapore · Sea-Lion v4 · 27B IT",
  },
  {
    id: "@cf/meta/llama-4-scout-17b-16e-instruct",
    label: "Meta · Llama 4 Scout · 17B",
  },
  {
    id: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    label: "Mistral · Small 3.1 · 24B Instruct",
  },
  {
    id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    label: "DeepSeek R1 · Distill Qwen · 32B",
  },
];

export const DEFAULT_WORKERS_AI_EMAIL_MODEL = WORKERS_AI_EMAIL_MODELS[0].id;

export function isAllowedEmailAiModel(id: string): boolean {
  return WORKERS_AI_EMAIL_MODELS.some((m) => m.id === id);
}
