/**
 * Variable Namen für Prompt-Templates (Einfüge-Buttons, KV / Renderer).
 */
export const PROMPT_PLACEHOLDER_NAMES = [
  "jahrgang",
  "marke",
  "model",
  "bodytyp",
  "trim",
] as const;

export type PromptPlaceholderName = (typeof PROMPT_PLACEHOLDER_NAMES)[number];
