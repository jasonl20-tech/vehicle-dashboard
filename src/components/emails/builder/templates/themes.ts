/**
 * Farbschemata für Section-Vorlagen.
 *
 * Jede Vorlage existiert in mehreren Themes (Hell, Soft, Dark, Brand).
 * Layouts in `layouts.ts` lesen die Werte aus dem aktiven Theme — so
 * lassen sich aus 5 Layouts × 4 Themes = 20 visuell unterschiedliche
 * Vorlagen pro Kategorie erzeugen, ohne Duplikat-Code.
 */

export type Theme = {
  id: string;
  label: string;
  /** Section-Hintergrund. */
  bg: string;
  /** Headline / starker Text. */
  fg: string;
  /** Sekundär-Text (z. B. Subline). */
  muted: string;
  /** Primärer CTA-Hintergrund. */
  accent: string;
  /** Primärer CTA-Textfarbe. */
  accentFg: string;
  /** Sekundärer (outlined) CTA-Border und Text. */
  outline: string;
  /** Trennlinien & dezente Hairlines (z. B. card-Borders). */
  hairline: string;
  /** Hintergrund für Karten / Boxen innerhalb der Section. */
  card: string;
  /** Inverses Bild-Placeholder-Farbschema (z. B. für Generierung). */
  placeholderHex: string;
};

export const THEMES: Theme[] = [
  {
    id: "light",
    label: "Hell",
    bg: "#ffffff",
    fg: "#0f0f10",
    muted: "#6a6a70",
    accent: "#0f0f10",
    accentFg: "#ffffff",
    outline: "#0f0f10",
    hairline: "#e5e5e7",
    card: "#f7f7f9",
    placeholderHex: "f5f5f7",
  },
  {
    id: "soft",
    label: "Soft",
    bg: "#f7f7f9",
    fg: "#0f0f10",
    muted: "#6a6a70",
    accent: "#0f0f10",
    accentFg: "#ffffff",
    outline: "#0f0f10",
    hairline: "#dedee2",
    card: "#ffffff",
    placeholderHex: "e8e8ed",
  },
  {
    id: "dark",
    label: "Dunkel",
    bg: "#0f0f10",
    fg: "#ffffff",
    muted: "#a0a0a8",
    accent: "#ffffff",
    accentFg: "#0f0f10",
    outline: "#ffffff",
    hairline: "#28282b",
    card: "#1a1a1c",
    placeholderHex: "1a1a1c",
  },
  {
    id: "brand",
    label: "Brand",
    bg: "#1d4ed8",
    fg: "#ffffff",
    muted: "#bfd2ff",
    accent: "#ffffff",
    accentFg: "#1d4ed8",
    outline: "#ffffff",
    hairline: "rgba(255,255,255,0.18)",
    card: "rgba(255,255,255,0.10)",
    placeholderHex: "1d4ed8",
  },
];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}
