/**
 * Datenmodell des selbst gebauten Email-Builders.
 *
 * Aufbau (von außen nach innen):
 *   EmailDesign  →  Section[]  →  Column[]  →  ContentBlock[]
 *
 * Eine Section ist eine horizontale Reihe (volle Breite). Jede Section
 * hat 1–3 Spalten, jede Spalte enthält eine vertikale Liste von
 * Content-Blöcken (Text, Button, Bild, …).
 *
 * Das Modell wird beim Speichern als JSON serialisiert und als HTML-
 * Kommentar in `body_html` mitgespeichert (siehe `lib/builderDesign.ts`).
 *
 * Versionierung: Schema-Änderungen erhöhen `version`. Decoder können
 * dadurch zwischen Versionen unterscheiden, alte Designs lesen ältere
 * Renderpfade. Aktuell `version: 1`.
 */

export type Padding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type Align = "left" | "center" | "right";

// ─── Content-Blöcke ────────────────────────────────────────────────────

type BaseBlock = {
  id: string;
  /** Padding um den Block-Inhalt **innerhalb** der Spalte. */
  padding: Padding;
  /** Optionaler Block-Hintergrund (sonst durchsichtig). */
  backgroundColor?: string;
};

export type TextBlock = BaseBlock & {
  type: "text";
  /** Inline-HTML-Inhalt (`<strong>`, `<em>`, `<a>`, `<br>` werden gerendert). */
  content: string;
  align: Align;
  fontFamily: string;
  fontSize: number;
  color: string;
  lineHeight: number;
};

export type HeadingBlock = BaseBlock & {
  type: "heading";
  level: 1 | 2 | 3;
  content: string;
  align: Align;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  color: string;
};

export type ButtonBlock = BaseBlock & {
  type: "button";
  text: string;
  href: string;
  align: Align;
  backgroundColor: string;
  color: string;
  borderRadius: number;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  paddingX: number;
  paddingY: number;
  fullWidth: boolean;
};

export type ImageBlock = BaseBlock & {
  type: "image";
  src: string;
  alt: string;
  href?: string;
  /** Pixelbreite oder "100%" für volle Spaltenbreite. */
  width: number | "100%";
  align: Align;
};

export type SpacerBlock = BaseBlock & {
  type: "spacer";
  /** Höhe in Pixeln. */
  height: number;
};

export type DividerBlock = BaseBlock & {
  type: "divider";
  color: string;
  thickness: number;
  /** Innerer Abstand links/rechts (in Prozent der Spaltenbreite). */
  inset: number;
};

export type HtmlBlock = BaseBlock & {
  type: "html";
  /** Roher HTML-Schnipsel — wird ungeprüft eingebettet. */
  html: string;
};

export type ContentBlock =
  | TextBlock
  | HeadingBlock
  | ButtonBlock
  | ImageBlock
  | SpacerBlock
  | DividerBlock
  | HtmlBlock;

export type ContentBlockType = ContentBlock["type"];

// ─── Spalten + Sections ───────────────────────────────────────────────

export type Column = {
  id: string;
  blocks: ContentBlock[];
};

export type SectionLayout =
  | "1"
  | "1-1"
  | "1-2"
  | "2-1"
  | "1-1-1";

export type Section = {
  id: string;
  /** Layout-Schlüssel: bestimmt Anzahl + Verhältnis der Spalten. */
  layout: SectionLayout;
  backgroundColor?: string;
  padding: Padding;
  columns: Column[];
};

// ─── Globale Body-Optionen ────────────────────────────────────────────

export type BodySettings = {
  /** Hintergrund **außerhalb** der Content-Box (Email-Body). */
  backgroundColor: string;
  /** Hintergrund der Content-Box (innerhalb der 600px-Wrapper). */
  contentBackgroundColor: string;
  /** Maximalbreite der Content-Box in Pixeln (typisch 600). */
  contentWidth: number;
  /** Default-Schriftfamilie für Text-Blöcke (kann pro Block überschrieben werden). */
  fontFamily: string;
  /** Default-Textfarbe. */
  color: string;
};

// ─── Top-Level ────────────────────────────────────────────────────────

export type EmailDesign = {
  version: 1;
  body: BodySettings;
  sections: Section[];
};

/** Pfad zu einem Block im Design (Section-Index → Spalten-Index → Block-Index). */
export type BlockPath = {
  sectionIndex: number;
  columnIndex: number;
  blockIndex: number;
};

export type SelectionTarget =
  | { kind: "block"; path: BlockPath }
  | { kind: "section"; sectionIndex: number }
  | { kind: "body" }
  | null;
