/**
 * Für `style={{ fontFamily: … }}` und CSS — mit `tailwind.config.js` `fontFamily` abgleichen.
 * Auf Apple-Geräten: San Francisco (über `-apple-system`); sonst system-ui / Helvetica-Fallbacks.
 */
export const APPLE_SANS_STACK =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, ui-sans-serif, system-ui, sans-serif';

/** Wie `APPLE_SANS_STACK`, mit einfachen Anführungszeichen für Darstellung in `style="…"`. */
export const APPLE_SANS_STACK_HTML =
  "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, ui-sans-serif, system-ui, sans-serif";

export const APPLE_MONO_STACK =
  "SF Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";
