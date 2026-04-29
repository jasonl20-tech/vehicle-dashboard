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

/** Wiederverwendbarer Rahmen für Blöcke und Section-Borders. */
export type Border = {
  color: string;
  width: number;
  style: "solid" | "dashed" | "dotted";
};

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
  /** Optionaler Rahmen (z. B. für Outline-Buttons mit Background-Transparent). */
  border?: Border;
};

export type ImageBlock = BaseBlock & {
  type: "image";
  src: string;
  alt: string;
  href?: string;
  /** Pixelbreite oder "100%" für volle Spaltenbreite. */
  width: number | "100%";
  align: Align;
  /** Eckenradius (rendert in mailtauglichem Bereich, ~50% kompatibel). */
  borderRadius: number;
  border?: Border;
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

export type ListBlock = BaseBlock & {
  type: "list";
  ordered: boolean;
  /** Jeder Listeneintrag kann Inline-HTML enthalten (z. B. `<strong>`). */
  items: string[];
  align: Align;
  fontFamily: string;
  fontSize: number;
  color: string;
  lineHeight: number;
  /** Abstand zwischen den Listeneinträgen in Pixeln. */
  itemSpacing: number;
};

export type QuoteBlock = BaseBlock & {
  type: "quote";
  /** Inline-HTML des Zitats. */
  content: string;
  /** Optionaler Quellenhinweis (z. B. „— Max Mustermann"). */
  cite?: string;
  align: Align;
  fontFamily: string;
  fontSize: number;
  color: string;
  /** Linker Akzent-Streifen (Farbe + Breite in Pixeln). */
  accentColor: string;
  accentWidth: number;
};

export type VideoBlock = BaseBlock & {
  type: "video";
  /** Statisches Thumbnail-Bild — Mail-Clients zeigen kein eingebettetes Video. */
  thumbnailUrl: string;
  /** URL, zu der bei Klick gesprungen wird (YouTube/Vimeo/eigene Seite). */
  videoUrl: string;
  alt: string;
  align: Align;
  width: number | "100%";
  /** Soll der Play-Overlay über das Thumbnail gelegt werden? */
  showPlayOverlay: boolean;
  /** Farbe des Play-Buttons (Overlay). */
  playButtonColor: string;
  borderRadius: number;
};

export type SocialNetwork =
  | "facebook"
  | "x"
  | "instagram"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "github"
  | "website"
  | "email";

export type SocialLink = {
  id: string;
  network: SocialNetwork;
  url: string;
};

export type SocialBlock = BaseBlock & {
  type: "social";
  links: SocialLink[];
  align: Align;
  /** Icon-Größe in Pixeln (Quadrat). */
  iconSize: number;
  /** Abstand zwischen den Icons in Pixeln. */
  gap: number;
  /** Farb-Modus der Icons – "color" lädt die offiziellen Brand-Logos,
   *  "mono" rendert einfarbige Icons in `monoColor`. */
  style: "color" | "mono";
  monoColor: string;
};

export type AvatarBlock = BaseBlock & {
  type: "avatar";
  imageUrl: string;
  name: string;
  /** Untertitel (Rolle, Firma, Tagline). */
  subtitle: string;
  /** Layout: Bild + Text horizontal (Bild links) oder vertikal (Bild oben). */
  layout: "horizontal" | "vertical";
  align: Align;
  /** Bildgröße in Pixeln (Quadrat). */
  imageSize: number;
  /** Bild rund (true) oder rechteckig mit `imageBorderRadius` (false). */
  imageRounded: boolean;
  imageBorderRadius: number;
  fontFamily: string;
  nameColor: string;
  subtitleColor: string;
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
  | ListBlock
  | QuoteBlock
  | VideoBlock
  | SocialBlock
  | AvatarBlock
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
  /** Optionale Trennlinien oben und unten (z. B. zwischen Hero und Body). */
  borderTop?: Border;
  borderBottom?: Border;
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
  /** Vertikales Padding **außerhalb** der Content-Box (oben/unten). */
  contentPaddingY: number;
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
