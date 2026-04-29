/**
 * Speichert/lädt das Unlayer-Design-JSON, **ohne** die D1-Tabelle zu
 * verändern: das Design wird als HTML-Kommentar **vor** das gerenderte
 * `body_html` geschrieben. Mail-Clients ignorieren HTML-Kommentare,
 * der externe Mail-Worker schickt die ganze Zeichenkette so wie sie ist.
 *
 * Format:
 *
 *   <!--UNLAYER_DESIGN:v1:<base64(JSON)>-->
 *   <!doctype html>...gerendertes HTML...
 *
 * Vorteile:
 *  - Kein Schema-Wechsel an `email_templates` notwendig.
 *  - Rückwärtskompatibel: Templates ohne Marker werden als
 *    "kein Design vorhanden" interpretiert (Editor zeigt dann den
 *    Starter / leeren Zustand).
 *  - Forward-kompatibel: Versionsmarker `v1` lässt zukünftige Format-
 *    Änderungen sauber unterscheiden.
 *
 * Sicherheit:
 *  - Base64 enthält weder `--` noch `>` und kann den HTML-Kommentar
 *    nicht versehentlich beenden.
 *  - Wir akzeptieren nur Designs bis MAX_DESIGN_BYTES, um pathologisch
 *    große Strings auszuschließen.
 */

const MARKER_PREFIX = "<!--UNLAYER_DESIGN:v1:";
const MARKER_SUFFIX = "-->";
/** ~512 KB – Unlayer-Designs liegen typisch bei 5–50 KB. */
const MAX_DESIGN_BYTES = 512 * 1024;

/** Base64-Encoding für beliebige Unicode-Strings (auch Umlaute, Emojis). */
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

/**
 * Liest ein eingebettetes Design-JSON aus einem `body_html`. Liefert
 * `null`, wenn der Marker fehlt oder ungültig ist (alte HTML-only
 * Templates).
 */
export function extractDesign(bodyHtml: string): {
  design: unknown | null;
  /** body_html ohne den Design-Marker (für Anzeige & HTML-Modus). */
  htmlWithoutMarker: string;
} {
  if (!bodyHtml) {
    return { design: null, htmlWithoutMarker: "" };
  }
  const startIdx = bodyHtml.indexOf(MARKER_PREFIX);
  if (startIdx !== 0 && startIdx !== -1) {
    // Marker existiert, ist aber nicht ganz vorne — ignorieren.
    return { design: null, htmlWithoutMarker: bodyHtml };
  }
  if (startIdx !== 0) {
    return { design: null, htmlWithoutMarker: bodyHtml };
  }
  const endIdx = bodyHtml.indexOf(
    MARKER_SUFFIX,
    MARKER_PREFIX.length,
  );
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
  // Hinter dem Marker folgt typischerweise ein Zeilenumbruch — entfernen.
  let rest = bodyHtml.slice(endIdx + MARKER_SUFFIX.length);
  if (rest.startsWith("\n")) rest = rest.slice(1);
  return { design: parsed, htmlWithoutMarker: rest };
}

/**
 * Verpackt Design-JSON + gerendertes HTML in einen einzelnen String, der
 * in `body_html` gespeichert werden kann.
 */
export function embedDesign(design: unknown, html: string): string {
  if (design == null) return html;
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
