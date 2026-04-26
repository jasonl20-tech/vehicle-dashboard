/**
 * Fünf zulässige dynamische Variablen im Prompt (KV / Renderer).
 * Nur diese werden in Blöcke gesplittet; andere {{…}}-Teile bleiben Fließtext.
 */
export const PROMPT_PLACEHOLDER_NAMES = [
  "jahrgang",
  "marke",
  "model",
  "bodytyp",
  "trim",
] as const;

export type PromptPlaceholderName = (typeof PROMPT_PLACEHOLDER_NAMES)[number];

const NAMES_PATTERN = PROMPT_PLACEHOLDER_NAMES.join("|");
const PH_REGEX = new RegExp(`\\{\\{(${NAMES_PATTERN})\\}\\}`, "g");

export type PromptSegment =
  | { kind: "text"; text: string }
  | { kind: "var"; name: PromptPlaceholderName };

function mergeConsecutiveText(segments: PromptSegment[]): PromptSegment[] {
  const out: PromptSegment[] = [];
  for (const seg of segments) {
    const last = out[out.length - 1];
    if (seg.kind === "text" && last?.kind === "text") {
      last.text += seg.text;
    } else {
      out.push(
        seg.kind === "text" ? { kind: "text", text: seg.text } : { ...seg },
      );
    }
  }
  return out;
}

/** Zerlegt den gespeicherten String in Fließtext- und Var-Segmente. */
export function parsePromptWithPlaceholders(value: string): PromptSegment[] {
  if (!value) return [{ kind: "text", text: "" }];
  const parts: PromptSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(PH_REGEX.source, "g");
  while ((m = re.exec(value)) !== null) {
    if (m.index > last) {
      parts.push({ kind: "text", text: value.slice(last, m.index) });
    }
    const name = m[1] as PromptPlaceholderName;
    parts.push({ kind: "var", name });
    last = m.index + m[0].length;
  }
  if (last < value.length) {
    parts.push({ kind: "text", text: value.slice(last) });
  }
  if (parts.length === 0) {
    return [{ kind: "text", text: value }];
  }
  return mergeConsecutiveText(parts);
}

export function serializePromptWithPlaceholders(
  segments: PromptSegment[],
): string {
  return segments
    .map((s) => (s.kind === "var" ? `{{${s.name}}}` : s.text))
    .join("");
}

/**
 * Setzt an Segment-Index (volle `parse`-Reihe) neuen Fließtext; splittet ggf. neu
 * eingetippte `{{name}}` wieder in Var-Blöcke.
 */
export function setPromptTextAtSegment(
  value: string,
  segmentIndex: number,
  newText: string,
): string {
  const segs = parsePromptWithPlaceholders(value);
  if (!segs[segmentIndex] || segs[segmentIndex].kind !== "text") {
    return value;
  }
  const merged = segs.map((s, j) =>
    j === segmentIndex && s.kind === "text" ? { kind: "text" as const, text: newText } : s,
  ) as PromptSegment[];
  return serializePromptWithPlaceholders(
    parsePromptWithPlaceholders(serializePromptWithPlaceholders(merged)),
  );
}
