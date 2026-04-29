/**
 * Persistiert das Builder-Design **innerhalb** von `body_html`, ohne
 * das D1-Schema zu erweitern. Format:
 *
 *   <!--EMAIL_BUILDER:v1:<base64(JSON)>-->
 *   <!doctype html>...gerendertes HTML...
 *
 * Mail-Clients ignorieren HTML-Kommentare, der externe Mail-Worker
 * schickt body_html unverändert raus. Beim erneuten Öffnen extrahieren
 * wir das JSON und laden den Editor.
 *
 * Templates ohne Marker (manuell angelegtes HTML, alt-Daten) liefern
 * `design === null` zurück — der Editor zeigt dann den Starter-Picker.
 */
import type { EmailDesign } from "../components/emails/builder/types";

const MARKER_PREFIX = "<!--EMAIL_BUILDER:v1:";
const MARKER_SUFFIX = "-->";
/** ~512 KB – realistische Designs liegen bei <50 KB JSON. */
const MAX_DESIGN_BYTES = 512 * 1024;

/** Base64-Encoding für beliebige Unicode-Strings (Umlaute, Emojis). */
function encodeBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function decodeBase64Utf8(input: string): string {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function isValidDesign(value: unknown): value is EmailDesign {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (obj.version !== 1) return false;
  if (!obj.body || typeof obj.body !== "object") return false;
  if (!Array.isArray(obj.sections)) return false;
  return true;
}

export function extractBuilderDesign(bodyHtml: string): {
  design: EmailDesign | null;
  htmlWithoutMarker: string;
} {
  if (!bodyHtml || !bodyHtml.startsWith(MARKER_PREFIX)) {
    return { design: null, htmlWithoutMarker: bodyHtml ?? "" };
  }
  const endIdx = bodyHtml.indexOf(MARKER_SUFFIX, MARKER_PREFIX.length);
  if (endIdx < 0) {
    return { design: null, htmlWithoutMarker: bodyHtml };
  }
  const b64 = bodyHtml.slice(MARKER_PREFIX.length, endIdx);
  if (!b64 || b64.length > MAX_DESIGN_BYTES) {
    return { design: null, htmlWithoutMarker: bodyHtml };
  }
  let json = "";
  try {
    json = decodeBase64Utf8(b64);
  } catch {
    return { design: null, htmlWithoutMarker: bodyHtml };
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { design: null, htmlWithoutMarker: bodyHtml };
  }
  if (!isValidDesign(parsed)) {
    return { design: null, htmlWithoutMarker: bodyHtml };
  }
  let rest = bodyHtml.slice(endIdx + MARKER_SUFFIX.length);
  if (rest.startsWith("\n")) rest = rest.slice(1);
  return { design: parsed, htmlWithoutMarker: rest };
}

export function embedBuilderDesign(
  design: EmailDesign | null,
  html: string,
): string {
  if (!design) return html;
  let json = "";
  try {
    json = JSON.stringify(design);
  } catch {
    return html;
  }
  if (json.length > MAX_DESIGN_BYTES) {
    // Lieber kein Design speichern als die DB-Spalte zu sprengen.
    return html;
  }
  const b64 = encodeBase64Utf8(json);
  return `${MARKER_PREFIX}${b64}${MARKER_SUFFIX}\n${html}`;
}
