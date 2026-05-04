/**
 * Einbindung von `cms_contents.payload_json` auf der **öffentlichen Webseite**,
 * wenn dieselbe D1-Datenbank (Binding `website`) dort gelesen wird — ohne CMS-Session-API.
 *
 * Verwendung: Payload parsen, Rich-Text mit {@link lexicalRichTextToHtml} ausgeben,
 * Medien-Keys mit {@link publicAssetUrl} auflösen.
 */
import { cmsMediaFieldKey } from "./cmsEntryPayload";
import { publicAssetUrl } from "./assetsApi";
import {
  isProbablyLexicalRichTextField,
  lexicalRichTextToHtml,
} from "./lexicalRichTextHtml";

/** `payload_json`-String → Objekt; bei Fehler leeres Objekt. */
export function parseCmsPayloadJson(payloadJson: string): Record<string, unknown> {
  try {
    const o = JSON.parse(payloadJson) as unknown;
    if (o && typeof o === "object" && !Array.isArray(o)) {
      return o as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

/**
 * Wert eines Rich-Text-Feldes aus dem Payload → statisches HTML (XSS-gehärtet).
 * Akzeptiert JSON-String oder bereits geparstes Objekt.
 */
export function cmsRichTextValueToHtml(value: unknown): string {
  return lexicalRichTextToHtml(value);
}

/** Hilfe für bedingtes Rendering: Feld ist Lexical-JSON (String) oder leer. */
export function cmsIsLexicalRichTextString(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return isProbablyLexicalRichTextField(value.trim());
}

/**
 * Medien-Feld (String-Key oder `{ key, … }`) → öffentliche Asset-URL.
 */
export function cmsMediaFieldToUrl(value: unknown): string {
  const key = cmsMediaFieldKey(value);
  if (!key) return "";
  return publicAssetUrl(key);
}

/** Alt-Text aus Medien-Feld-Snapshot, falls vorhanden. */
export function cmsMediaFieldAltText(value: unknown): string {
  if (value == null || typeof value !== "object" || !("key" in (value as object))) {
    return "";
  }
  const o = value as Record<string, unknown>;
  const alt = o.altText ?? o.alt_text;
  return alt != null ? String(alt).trim() : "";
}
