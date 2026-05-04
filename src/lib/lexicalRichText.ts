/**
 * Lexical Rich Text: leerer Editor-State, Heuristiken für API/Payload.
 * Werte im Payload sind JSON-Strings (SerializedEditorState).
 */

export const EMPTY_LEXICAL_STATE_JSON =
  '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"","type":"text","version":1}],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';

export function isLexicalSerializedJson(s: string): boolean {
  try {
    const o = JSON.parse(s) as { root?: { type?: string } };
    return o?.root?.type === "root";
  } catch {
    return false;
  }
}

/** Plain-Text-Länge (Unicode-sicher) für Validierung / Zähler. */
export function richTextPlainTextLength(value: unknown): number {
  if (value == null) return 0;
  const s = typeof value === "string" ? value : "";
  if (!s.trim()) return 0;
  try {
    const o = JSON.parse(s) as { root?: unknown };
    if (o?.root) {
      return [...lexicalJsonToPlainString(o.root)].length;
    }
    return [...s.trim()].length;
  } catch {
    return [...s.trim()].length;
  }
}

export function lexicalJsonToPlainString(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (n.type === "linebreak") return "\n";
  if (n.type === "tab") return "\t";
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (n.type === "cms-hr") return "\n";
  if (n.type === "cms-image" && typeof n.altText === "string" && n.altText)
    return `\n[${n.altText}]\n`;
  if (n.type === "cms-image") return "\n";
  if (Array.isArray(n.children)) {
    return n.children.map((c) => lexicalJsonToPlainString(c)).join("");
  }
  return "";
}

/** Erster Editor-Zustand aus DB-Wert (Lexical-JSON oder Legacy-Klartext). */
export function richTextInitialSerialized(raw: string): string {
  const t = raw.trim();
  if (!t) return EMPTY_LEXICAL_STATE_JSON;
  if (isLexicalSerializedJson(t)) return t;
  return legacyPlainTextToLexicalJson(t);
}

function legacyPlainTextToLexicalJson(text: string): string {
  return JSON.stringify({
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text,
              type: "text",
              version: 1,
            },
          ],
          direction: null,
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        },
      ],
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}

/** Für API-Body: immer gültiger Lexical-JSON-String. */
export function richTextToApiString(value: unknown): string {
  if (value == null) return EMPTY_LEXICAL_STATE_JSON;
  if (typeof value === "object" && value !== null) {
    try {
      const s = JSON.stringify(value);
      return isLexicalSerializedJson(s) ? s : EMPTY_LEXICAL_STATE_JSON;
    } catch {
      return EMPTY_LEXICAL_STATE_JSON;
    }
  }
  const s = String(value);
  if (!s.trim()) return EMPTY_LEXICAL_STATE_JSON;
  if (isLexicalSerializedJson(s)) return s;
  return legacyPlainTextToLexicalJson(s);
}

export function extractPlainFromLexicalOrText(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw !== "string") return "";
  const t = raw.trim();
  if (!t) return "";
  try {
    const o = JSON.parse(t) as { root?: unknown };
    if (o?.root) return lexicalJsonToPlainString(o.root);
    return t;
  } catch {
    return t;
  }
}
