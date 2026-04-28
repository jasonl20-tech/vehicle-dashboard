/**
 * Prüft Prompt-Text auf Zeichen, die bei JSON-Einbettung / Serialisierung stören können.
 * Platzhalter `{{name}}` sind erlaubt und werden ignoriert.
 */

const PLACEHOLDER = /\{\{[^}]+\}\}/g;

/** Zeichen, die nach Entfernen der Variablen oft problematisch sind */
const ASCII_DOUBLE_QUOTE = "\u0022";
const BACKSLASH = "\\";

/** Ohne ASCII " — das wird separat geprüft */
const TYPOGRAPHIC_OR_SMART_QUOTES =
  /[\u201c\u201d\u201e\u201a\u2018\u2019\u2039\u203a\u00ab\u00bb«»„‚‹›❝❞❮❯]/u;

/** Steuerzeichen außer Tab/LF/CR (in JSON-Strings meist ok) */
const CONTROL_EXCEPT_WHITESPACE =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function stripPlaceholders(prompt: string): string {
  return prompt.replace(PLACEHOLDER, "");
}

export type PromptJsonSafetyResult = {
  ok: boolean;
  /** Kurz erklärt, was gefunden wurde (deutsch) */
  reasons: string[];
};

/**
 * Liefert Warnungen, wenn im Text (ohne `{{…}}`) riskante Zeichen vorkommen.
 */
export function analyzePromptJsonSafety(prompt: string): PromptJsonSafetyResult {
  const reasons: string[] = [];
  const t = stripPlaceholders(prompt);

  if (t.includes(ASCII_DOUBLE_QUOTE)) {
    reasons.push(
      `Gerade ASCII-Anführungszeichen (${ASCII_DOUBLE_QUOTE}) im Text: in JSON-Strings muss dieses Zeichen escaped werden und verursacht oft Fehler in Pipelines.`,
    );
  }

  if (t.includes(BACKSLASH)) {
    reasons.push(
      `Backslash (${BACKSLASH}) im Text: In JSON beginnt damit ein Escape; Pfade oder kopierter Text können die Serialisierung stören.`,
    );
  }

  if (TYPOGRAPHIC_OR_SMART_QUOTES.test(t)) {
    reasons.push(
      "Typografische oder geschwungene Anführungszeichen („…“, «…», ‚…‘, Unicode-Quotes): oft aus Word/Docs — können je nach Verarbeitung wie Steuerzeichen wirken. Bevorzugen Sie normalen Text ohne diese Zeichen oder Apostroph (') für Genitiv/Abkürzungen.",
    );
  }

  if (CONTROL_EXCEPT_WHITESPACE.test(t)) {
    reasons.push(
      "Unerwartete Steuer- oder Sonderzeichen (z. B. NULL, versteckte Formatzeichen) im Text.",
    );
  }

  return { ok: reasons.length === 0, reasons };
}
