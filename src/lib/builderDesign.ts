/**
 * Legacy-Kompatibilität: Früher wurde vor dem sichtbaren HTML ein Kommentar
 * `<!--EMAIL_BUILDER:v1:<base64>-->` gespeichert. Mail-Clients ignorieren das;
 * der Worker schickt `body_html` unverändert. Vorlagen werden jetzt nur noch
 * als reines HTML bearbeitet – beim Laden entfernen wir den Marker, beim
 * Speichern schreibt die UI nur noch den HTML-Body ohne Marker.
 */
const MARKER_PREFIX = "<!--EMAIL_BUILDER:v1:";
const MARKER_SUFFIX = "-->";

/**
 * Liefert den editierbaren HTML-Teil: alles nach dem optionalen
 * EMAIL_BUILDER-Kommentar, sonst den vollen String.
 */
export function stripEmailBuilderMarker(bodyHtml: string): string {
  if (!bodyHtml || !bodyHtml.startsWith(MARKER_PREFIX)) {
    return bodyHtml ?? "";
  }
  const endIdx = bodyHtml.indexOf(MARKER_SUFFIX, MARKER_PREFIX.length);
  if (endIdx < 0) return bodyHtml;
  let rest = bodyHtml.slice(endIdx + MARKER_SUFFIX.length);
  if (rest.startsWith("\n")) rest = rest.slice(1);
  return rest;
}
