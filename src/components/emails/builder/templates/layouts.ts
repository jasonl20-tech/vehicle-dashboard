/**
 * Layout-Bibliothek für Section-Vorlagen.
 *
 * Jeder Layout-Builder ist eine reine Funktion `(theme, content) => Section`.
 * Die Kategorie wählt eine Liste von Layout-IDs aus und kombiniert sie
 * mit ihren `Content`-Texten. Themes werden dynamisch angewendet.
 *
 * Hinweise zu E-Mail-Sicherheit:
 *   - Wir nutzen `via.placeholder.com` für Demo-Bilder; im Editor klickt
 *     der User auf "Aus Assets wählen" und ersetzt sie.
 *   - HTML in Text/Heading-Content ist auf einfache Tags beschränkt
 *     (`<a>`, `<strong>`, `<em>`, `<br>`).
 */
import {
  makeAvatar,
  makeButton,
  makeDivider,
  makeHeading,
  makeImage,
  makeList,
  makeQuote,
  makeSection,
  makeSocial,
  makeSpacer,
  makeText,
} from "../defaults";
import type { Section, SectionLayout } from "../types";
import type { Theme } from "./themes";

export type Content = {
  /** Headline — bei Bedarf mit `<br>` mehrzeilig. */
  headline: string;
  /** Subline / Untertitel. */
  subline: string;
  /** Primärer CTA-Text. */
  cta: string;
  /** Optionaler sekundärer CTA-Text. */
  ctaSecondary?: string;
  /** Optionaler kurzer "Eyebrow"-Text über der Headline. */
  eyebrow?: string;
  /** Stichworte für Listen / Features (3 Stück). */
  bullets?: [string, string, string];
  /** Stichworte für Listen / Features (4 Stück). */
  bullets4?: [string, string, string, string];
  /** Drei Karten-Titel. */
  cardTitles?: [string, string, string];
  /** Drei Karten-Texte. */
  cardTexts?: [string, string, string];
  /** Zitat-Inhalt. */
  quote?: string;
  /** Zitat-Quelle. */
  quoteAuthor?: string;
  /** Stat-Trios (Zahl + Beschreibung). */
  stats?: { value: string; label: string }[];
  /** Personen-Trio für Avatar-Grids. */
  people?: { name: string; role: string }[];
  /** Footer-Adresse. */
  address?: string;
  /** Bild-Placeholder-Beschriftung (für die placeholder.com-URL). */
  placeholder?: string;
};

const PH = "via.placeholder.com";

function ph(theme: Theme, w: number, h: number, label: string): string {
  const safe = encodeURIComponent(label.slice(0, 28));
  // Hex ohne "#" für placeholder.com
  return `https://${PH}/${w}x${h}/${theme.placeholderHex}/${theme.fg
    .replace("#", "")
    .padEnd(6, "0")
    .slice(0, 6)}?text=${safe}`;
}

// ─── Helfer ────────────────────────────────────────────────────────────

function applyBg(s: Section, theme: Theme): void {
  s.backgroundColor = theme.bg;
}

function setLayout(s: Section, layout: SectionLayout): Section {
  // makeSection erstellt schon das richtige column-count, wir müssen nichts tun.
  s.layout = layout;
  return s;
}

// ─── Layouts: Header ──────────────────────────────────────────────────

const headerLogoCenter = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 28, right: 24, bottom: 20, left: 24 };
  const logo = makeImage();
  logo.src = ph(theme, 140, 40, c.eyebrow || "Logo");
  logo.width = 140;
  logo.align = "center";
  logo.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [logo];
  return s;
};

const headerLogoLeftMenu = (theme: Theme, c: Content): Section => {
  const s = setLayout(makeSection("1-1"), "1-1");
  applyBg(s, theme);
  s.padding = { top: 20, right: 24, bottom: 20, left: 24 };
  const logo = makeImage();
  logo.src = ph(theme, 120, 36, "Logo");
  logo.width = 120;
  logo.align = "left";
  logo.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [logo];
  const menu = makeText();
  menu.content = `<a href="#" style="color:${theme.fg};text-decoration:none;margin-right:14px;">${c.bullets?.[0] ?? "Produkt"}</a><a href="#" style="color:${theme.fg};text-decoration:none;margin-right:14px;">${c.bullets?.[1] ?? "Preise"}</a><a href="#" style="color:${theme.fg};text-decoration:none;">${c.bullets?.[2] ?? "Kontakt"}</a>`;
  menu.align = "right";
  menu.padding = { top: 8, right: 0, bottom: 0, left: 0 };
  menu.fontSize = 13;
  menu.color = theme.fg;
  s.columns[1]!.blocks = [menu];
  return s;
};

const headerBanner = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 24, right: 24, bottom: 24, left: 24 };
  const h = makeHeading(2);
  h.content = c.eyebrow || c.headline.replace(/\{\{[^}]+\}\}/g, "").trim() || "Vehicle Imagery";
  h.color = theme.fg;
  h.align = "center";
  h.fontSize = 18;
  h.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h];
  return s;
};

const headerLogoTagline = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 28, right: 24, bottom: 16, left: 24 };
  const img = makeImage();
  img.src = ph(theme, 120, 36, "Logo");
  img.width = 120;
  img.align = "center";
  img.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const tag = makeText();
  tag.content = c.subline;
  tag.align = "center";
  tag.fontSize = 12;
  tag.color = theme.muted;
  tag.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [img, tag];
  return s;
};

const headerHairline = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 16, right: 24, bottom: 16, left: 24 };
  s.borderBottom = { color: theme.hairline, width: 1, style: "solid" };
  const t = makeText();
  t.content = `<strong style="color:${theme.fg};">${c.eyebrow || "Brand"}</strong>`;
  t.align = "center";
  t.color = theme.fg;
  t.fontSize = 13;
  t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [t];
  return s;
};

// ─── Layouts: Hero ────────────────────────────────────────────────────

const heroCenteredCTA = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 56, right: 32, bottom: 56, left: 32 };
  const blocks = [];
  if (c.eyebrow) {
    const eb = makeText();
    eb.content = c.eyebrow.toUpperCase();
    eb.align = "center";
    eb.color = theme.muted;
    eb.fontSize = 11;
    eb.padding = { top: 0, right: 0, bottom: 12, left: 0 };
    blocks.push(eb);
  }
  const h = makeHeading(1);
  h.content = c.headline;
  h.align = "center";
  h.fontSize = 32;
  h.color = theme.fg;
  h.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  blocks.push(h);
  const sub = makeText();
  sub.content = c.subline;
  sub.align = "center";
  sub.fontSize = 15;
  sub.color = theme.muted;
  sub.padding = { top: 0, right: 0, bottom: 20, left: 0 };
  blocks.push(sub);
  const btn = makeButton();
  btn.text = c.cta;
  btn.backgroundColor = theme.accent;
  btn.color = theme.accentFg;
  btn.align = "center";
  btn.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  blocks.push(btn);
  s.columns[0]!.blocks = blocks;
  return s;
};

const heroFullImage = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  const img = makeImage();
  img.src = ph(theme, 600, 320, c.placeholder || "Hero");
  img.width = "100%";
  img.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  img.borderRadius = 0;
  s.columns[0]!.blocks = [img];
  return s;
};

const heroSplitImageLeft = (theme: Theme, c: Content): Section => {
  const s = setLayout(makeSection("1-1"), "1-1");
  applyBg(s, theme);
  s.padding = { top: 32, right: 24, bottom: 32, left: 24 };
  const img = makeImage();
  img.src = ph(theme, 280, 200, c.placeholder || "Bild");
  img.width = "100%";
  img.borderRadius = 8;
  img.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [img];

  const h = makeHeading(2);
  h.content = c.headline;
  h.color = theme.fg;
  h.padding = { top: 0, right: 0, bottom: 6, left: 0 };
  const t = makeText();
  t.content = c.subline;
  t.color = theme.muted;
  t.padding = { top: 0, right: 0, bottom: 16, left: 0 };
  const btn = makeButton();
  btn.text = c.cta;
  btn.backgroundColor = theme.accent;
  btn.color = theme.accentFg;
  btn.align = "left";
  btn.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[1]!.blocks = [h, t, btn];
  return s;
};

const heroSplitImageRight = (theme: Theme, c: Content): Section => {
  const s = setLayout(makeSection("1-1"), "1-1");
  applyBg(s, theme);
  s.padding = { top: 32, right: 24, bottom: 32, left: 24 };

  const h = makeHeading(2);
  h.content = c.headline;
  h.color = theme.fg;
  h.padding = { top: 0, right: 0, bottom: 6, left: 0 };
  const t = makeText();
  t.content = c.subline;
  t.color = theme.muted;
  t.padding = { top: 0, right: 0, bottom: 16, left: 0 };
  const btn = makeButton();
  btn.text = c.cta;
  btn.backgroundColor = theme.accent;
  btn.color = theme.accentFg;
  btn.align = "left";
  btn.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, t, btn];

  const img = makeImage();
  img.src = ph(theme, 280, 200, c.placeholder || "Bild");
  img.width = "100%";
  img.borderRadius = 8;
  img.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[1]!.blocks = [img];
  return s;
};

const heroEyebrowHeadline = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 64, right: 32, bottom: 48, left: 32 };
  const eb = makeText();
  eb.content = (c.eyebrow || "Neu").toUpperCase();
  eb.color = theme.muted;
  eb.fontSize = 11;
  eb.align = "center";
  eb.padding = { top: 0, right: 0, bottom: 12, left: 0 };
  const h = makeHeading(1);
  h.content = c.headline;
  h.color = theme.fg;
  h.align = "center";
  h.fontSize = 36;
  h.padding = { top: 0, right: 0, bottom: 12, left: 0 };
  const sub = makeText();
  sub.content = c.subline;
  sub.color = theme.muted;
  sub.align = "center";
  sub.padding = { top: 0, right: 0, bottom: 24, left: 0 };
  const btn = makeButton();
  btn.text = c.cta;
  btn.backgroundColor = theme.accent;
  btn.color = theme.accentFg;
  btn.align = "center";
  btn.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [eb, h, sub, btn];
  return s;
};

const heroMinimalText = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 48, right: 32, bottom: 48, left: 32 };
  const h = makeHeading(1);
  h.content = c.headline;
  h.color = theme.fg;
  h.align = "left";
  h.fontSize = 30;
  h.padding = { top: 0, right: 0, bottom: 12, left: 0 };
  const sub = makeText();
  sub.content = c.subline;
  sub.color = theme.muted;
  sub.align = "left";
  sub.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, sub];
  return s;
};

// ─── Layouts: Content/Cards ───────────────────────────────────────────

const contentTextBlock = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 24, right: 32, bottom: 24, left: 32 };
  const h = makeHeading(2);
  h.content = c.headline;
  h.color = theme.fg;
  h.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const t = makeText();
  t.content = c.subline;
  t.color = theme.muted;
  t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, t];
  return s;
};

const contentTwoCards = (theme: Theme, c: Content): Section => {
  const s = setLayout(makeSection("1-1"), "1-1");
  applyBg(s, theme);
  s.padding = { top: 16, right: 24, bottom: 24, left: 24 };
  const card = (title: string, sub: string) => {
    const img = makeImage();
    img.src = ph(theme, 280, 160, title);
    img.width = "100%";
    img.borderRadius = 8;
    img.padding = { top: 0, right: 0, bottom: 8, left: 0 };
    const h = makeHeading(3);
    h.content = title;
    h.color = theme.fg;
    h.padding = { top: 4, right: 0, bottom: 4, left: 0 };
    const t = makeText();
    t.content = sub;
    t.color = theme.muted;
    t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    return [img, h, t];
  };
  s.columns[0]!.blocks = card(
    c.cardTitles?.[0] ?? "Karte 1",
    c.cardTexts?.[0] ?? "Kurzer Beschreibungstext.",
  );
  s.columns[1]!.blocks = card(
    c.cardTitles?.[1] ?? "Karte 2",
    c.cardTexts?.[1] ?? "Kurzer Beschreibungstext.",
  );
  return s;
};

const contentThreeFeatures = (theme: Theme, c: Content): Section => {
  const s = setLayout(makeSection("1-1-1"), "1-1-1");
  applyBg(s, theme);
  s.padding = { top: 16, right: 24, bottom: 24, left: 24 };
  const titles = c.bullets ?? ["Schnell", "Sicher", "Skaliert"];
  const texts = c.cardTexts ?? [
    "Eine Zeile zum Feature.",
    "Eine Zeile zum Feature.",
    "Eine Zeile zum Feature.",
  ];
  const feature = (title: string, sub: string) => {
    const h = makeHeading(3);
    h.content = title;
    h.color = theme.fg;
    h.padding = { top: 0, right: 0, bottom: 4, left: 0 };
    h.fontSize = 14;
    const t = makeText();
    t.content = sub;
    t.color = theme.muted;
    t.fontSize = 12;
    t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    return [h, t];
  };
  s.columns[0]!.blocks = feature(titles[0]!, texts[0]!);
  s.columns[1]!.blocks = feature(titles[1]!, texts[1]!);
  s.columns[2]!.blocks = feature(titles[2]!, texts[2]!);
  return s;
};

const contentNumberedSteps = (theme: Theme, c: Content): Section => {
  const s = setLayout(makeSection("1-1-1"), "1-1-1");
  applyBg(s, theme);
  s.padding = { top: 24, right: 24, bottom: 24, left: 24 };
  const titles = c.bullets ?? ["Anmelden", "Einrichten", "Loslegen"];
  const texts = c.cardTexts ?? [
    "Erstelle deinen Account.",
    "Konfiguriere die Basics.",
    "Starte deine erste Aktion.",
  ];
  const step = (n: number, title: string, sub: string) => {
    const num = makeText();
    num.content = `<strong style="color:${theme.fg};font-size:18px;">${n}</strong>`;
    num.padding = { top: 0, right: 0, bottom: 6, left: 0 };
    num.color = theme.muted;
    num.fontSize = 12;
    const h = makeHeading(3);
    h.content = title;
    h.color = theme.fg;
    h.fontSize = 14;
    h.padding = { top: 0, right: 0, bottom: 4, left: 0 };
    const t = makeText();
    t.content = sub;
    t.color = theme.muted;
    t.fontSize = 12;
    t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    return [num, h, t];
  };
  s.columns[0]!.blocks = step(1, titles[0]!, texts[0]!);
  s.columns[1]!.blocks = step(2, titles[1]!, texts[1]!);
  s.columns[2]!.blocks = step(3, titles[2]!, texts[2]!);
  return s;
};

const contentBulletList = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 8, right: 32, bottom: 24, left: 32 };
  const h = makeHeading(3);
  h.content = c.headline;
  h.color = theme.fg;
  h.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const list = makeList(false);
  list.color = theme.fg;
  list.items = (c.bullets4 || c.bullets || [
    "Erster Punkt",
    "Zweiter Punkt",
    "Dritter Punkt",
  ]) as string[];
  list.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, list];
  return s;
};

const contentNumberedList = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 8, right: 32, bottom: 24, left: 32 };
  const h = makeHeading(3);
  h.content = c.headline;
  h.color = theme.fg;
  h.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const list = makeList(true);
  list.color = theme.fg;
  list.items = (c.bullets4 || c.bullets || [
    "Erster Punkt",
    "Zweiter Punkt",
    "Dritter Punkt",
  ]) as string[];
  list.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, list];
  return s;
};

const contentImageText = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 24, right: 32, bottom: 24, left: 32 };
  const img = makeImage();
  img.src = ph(theme, 600, 240, c.placeholder || "Bild");
  img.width = "100%";
  img.borderRadius = 8;
  img.padding = { top: 0, right: 0, bottom: 16, left: 0 };
  const h = makeHeading(2);
  h.content = c.headline;
  h.color = theme.fg;
  h.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const t = makeText();
  t.content = c.subline;
  t.color = theme.muted;
  t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [img, h, t];
  return s;
};

const contentVideoPreview = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 16, right: 32, bottom: 24, left: 32 };
  const h = makeHeading(3);
  h.content = c.headline;
  h.color = theme.fg;
  h.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const v = makeImage();
  v.src = ph(theme, 600, 340, "Video");
  v.borderRadius = 8;
  v.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, v];
  return s;
};

// ─── Layouts: Quote / Testimonial ─────────────────────────────────────

const quoteCentered = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  s.backgroundColor = theme.card;
  s.padding = { top: 32, right: 32, bottom: 32, left: 32 };
  const q = makeQuote();
  q.content = c.quote
    ? `„${c.quote}\u201d`
    : "„Das beste Produkt, das ich seit Jahren benutzt habe.\u201d";
  q.cite = c.quoteAuthor || "— Max Mustermann, CTO @ Beispiel GmbH";
  q.color = theme.fg;
  q.accentColor = theme.accent;
  q.align = "center";
  q.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [q];
  return s;
};

const quoteLargeBlock = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 40, right: 40, bottom: 40, left: 40 };
  const t = makeText();
  t.content = `<span style="font-size:24px;line-height:1.4;font-weight:500;color:${theme.fg};">„${c.quote || "Großartiges Erlebnis von Anfang bis Ende."}\u201d</span>`;
  t.color = theme.fg;
  t.padding = { top: 0, right: 0, bottom: 16, left: 0 };
  const cite = makeText();
  cite.content = c.quoteAuthor || "— Max Mustermann, CTO @ Beispiel GmbH";
  cite.color = theme.muted;
  cite.fontSize = 13;
  cite.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [t, cite];
  return s;
};

const quoteAvatar = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  s.backgroundColor = theme.card;
  s.padding = { top: 32, right: 32, bottom: 32, left: 32 };
  const av = makeAvatar();
  av.imageUrl = ph(theme, 96, 96, "Foto");
  av.name = c.quoteAuthor?.replace(/^—\s*/, "").split(",")[0] ?? "Max Mustermann";
  av.subtitle = c.quoteAuthor?.split(",")[1]?.trim() ?? "CTO @ Beispiel GmbH";
  av.layout = "horizontal";
  av.imageSize = 56;
  av.nameColor = theme.fg;
  av.subtitleColor = theme.muted;
  av.padding = { top: 0, right: 0, bottom: 12, left: 0 };
  const t = makeText();
  t.content = `„${c.quote || "Wir sind seit dem Tag 1 begeistert."}\u201d`;
  t.color = theme.fg;
  t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [av, t];
  return s;
};

// ─── Layouts: CTA ─────────────────────────────────────────────────────

const ctaBanner = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 36, right: 32, bottom: 36, left: 32 };
  const h = makeHeading(2);
  h.content = c.headline;
  h.color = theme.fg;
  h.align = "center";
  h.padding = { top: 0, right: 0, bottom: 12, left: 0 };
  const btn = makeButton();
  btn.text = c.cta;
  btn.backgroundColor = theme.accent;
  btn.color = theme.accentFg;
  btn.align = "center";
  btn.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, btn];
  return s;
};

const ctaTwoButtons = (theme: Theme, c: Content): Section => {
  const s = setLayout(makeSection("1-1"), "1-1");
  applyBg(s, theme);
  s.padding = { top: 28, right: 24, bottom: 28, left: 24 };
  const left = makeButton();
  left.text = c.cta;
  left.backgroundColor = theme.accent;
  left.color = theme.accentFg;
  left.align = "right";
  left.padding = { top: 0, right: 6, bottom: 0, left: 0 };
  const right = makeButton();
  right.text = c.ctaSecondary || "Mehr erfahren";
  right.backgroundColor = "transparent";
  right.color = theme.outline;
  right.border = { color: theme.outline, width: 1, style: "solid" };
  right.align = "left";
  right.padding = { top: 0, right: 0, bottom: 0, left: 6 };
  s.columns[0]!.blocks = [left];
  s.columns[1]!.blocks = [right];
  return s;
};

const ctaWithSubline = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 36, right: 32, bottom: 36, left: 32 };
  const h = makeHeading(2);
  h.content = c.headline;
  h.color = theme.fg;
  h.align = "center";
  h.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const sub = makeText();
  sub.content = c.subline;
  sub.color = theme.muted;
  sub.align = "center";
  sub.padding = { top: 0, right: 0, bottom: 16, left: 0 };
  const btn = makeButton();
  btn.text = c.cta;
  btn.backgroundColor = theme.accent;
  btn.color = theme.accentFg;
  btn.align = "center";
  btn.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, sub, btn];
  return s;
};

const ctaCard = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  s.backgroundColor = theme.card;
  s.padding = { top: 32, right: 32, bottom: 32, left: 32 };
  const h = makeHeading(2);
  h.content = c.headline;
  h.color = theme.fg;
  h.align = "left";
  h.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const sub = makeText();
  sub.content = c.subline;
  sub.color = theme.muted;
  sub.padding = { top: 0, right: 0, bottom: 16, left: 0 };
  const btn = makeButton();
  btn.text = c.cta;
  btn.backgroundColor = theme.accent;
  btn.color = theme.accentFg;
  btn.align = "left";
  btn.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, sub, btn];
  return s;
};

// ─── Layouts: Stats ───────────────────────────────────────────────────

const statsThree = (theme: Theme, c: Content): Section => {
  const s = setLayout(makeSection("1-1-1"), "1-1-1");
  applyBg(s, theme);
  s.padding = { top: 32, right: 24, bottom: 32, left: 24 };
  const items = c.stats ?? [
    { value: "10x", label: "schneller" },
    { value: "99.9%", label: "Uptime" },
    { value: "1M+", label: "Bilder" },
  ];
  const stat = (v: string, l: string) => {
    const big = makeText();
    big.content = `<strong style="font-size:32px;color:${theme.fg};">${v}</strong>`;
    big.color = theme.fg;
    big.align = "center";
    big.padding = { top: 0, right: 0, bottom: 4, left: 0 };
    const lab = makeText();
    lab.content = l;
    lab.color = theme.muted;
    lab.fontSize = 12;
    lab.align = "center";
    lab.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    return [big, lab];
  };
  s.columns[0]!.blocks = stat(items[0]!.value, items[0]!.label);
  s.columns[1]!.blocks = stat(items[1]!.value, items[1]!.label);
  s.columns[2]!.blocks = stat(items[2]!.value, items[2]!.label);
  return s;
};

// ─── Layouts: Avatar / Team ───────────────────────────────────────────

const avatarSingle = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 24, right: 24, bottom: 24, left: 24 };
  const av = makeAvatar();
  const p = c.people?.[0] ?? { name: "Max Mustermann", role: "CEO" };
  av.imageUrl = ph(theme, 96, 96, "Foto");
  av.name = p.name;
  av.subtitle = p.role;
  av.layout = "horizontal";
  av.imageSize = 56;
  av.nameColor = theme.fg;
  av.subtitleColor = theme.muted;
  av.padding = { top: 0, right: 0, bottom: 12, left: 0 };
  const t = makeText();
  t.content = c.subline;
  t.color = theme.muted;
  t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [av, t];
  return s;
};

const avatarThreeTeam = (theme: Theme, c: Content): Section => {
  const s = setLayout(makeSection("1-1-1"), "1-1-1");
  applyBg(s, theme);
  s.padding = { top: 24, right: 24, bottom: 24, left: 24 };
  const people = c.people ?? [
    { name: "Anna", role: "Founder" },
    { name: "Ben", role: "CTO" },
    { name: "Cara", role: "Lead Design" },
  ];
  const make = (p: { name: string; role: string }) => {
    const av = makeAvatar();
    av.imageUrl = ph(theme, 96, 96, p.name);
    av.name = p.name;
    av.subtitle = p.role;
    av.layout = "vertical";
    av.imageSize = 64;
    av.align = "center";
    av.nameColor = theme.fg;
    av.subtitleColor = theme.muted;
    av.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    return [av];
  };
  s.columns[0]!.blocks = make(people[0]!);
  s.columns[1]!.blocks = make(people[1]!);
  s.columns[2]!.blocks = make(people[2]!);
  return s;
};

// ─── Layouts: Footer ──────────────────────────────────────────────────

const footerSocial = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 24, right: 24, bottom: 24, left: 24 };
  s.borderTop = { color: theme.hairline, width: 1, style: "solid" };
  const social = makeSocial();
  social.align = "center";
  social.padding = { top: 0, right: 0, bottom: 12, left: 0 };
  const addr = makeText();
  addr.content = c.address || "Beispiel GmbH · Musterstraße 1 · 12345 Berlin";
  addr.align = "center";
  addr.color = theme.muted;
  addr.fontSize = 11;
  addr.padding = { top: 0, right: 0, bottom: 6, left: 0 };
  const unsub = makeText();
  unsub.content = `Du erhältst diese Mail, weil du dich registriert hast. <a href="{{unsubscribe_url}}" style="color:${theme.muted};text-decoration:underline;">Abmelden</a>`;
  unsub.align = "center";
  unsub.color = theme.muted;
  unsub.fontSize = 11;
  unsub.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [social, addr, unsub];
  return s;
};

const footerColumns = (theme: Theme, c: Content): Section => {
  const s = setLayout(makeSection("1-1-1"), "1-1-1");
  applyBg(s, theme);
  s.padding = { top: 24, right: 24, bottom: 24, left: 24 };
  s.borderTop = { color: theme.hairline, width: 1, style: "solid" };
  const titles = c.cardTitles ?? ["Produkt", "Firma", "Rechtliches"];
  const items = c.cardTexts ?? [
    "Features|Preise",
    "Über uns|Kontakt",
    "Impressum|Abmelden",
  ];
  const col = (title: string, links: string) => {
    const t = makeText();
    const linksHtml = links
      .split("|")
      .map(
        (l) =>
          `<a href="#" style="color:${theme.muted};text-decoration:none;">${l}</a>`,
      )
      .join("<br>");
    t.content = `<strong style="color:${theme.fg};">${title}</strong><br>${linksHtml}`;
    t.fontSize = 12;
    t.color = theme.muted;
    t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    return [t];
  };
  s.columns[0]!.blocks = col(titles[0]!, items[0]!);
  s.columns[1]!.blocks = col(titles[1]!, items[1]!);
  s.columns[2]!.blocks = col(titles[2]!, items[2]!);
  return s;
};

const footerMinimal = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 16, right: 24, bottom: 16, left: 24 };
  const t = makeText();
  t.content = `${c.address || "Beispiel GmbH"} · <a href="{{unsubscribe_url}}" style="color:${theme.muted};">Abmelden</a>`;
  t.align = "center";
  t.color = theme.muted;
  t.fontSize = 11;
  t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [t];
  return s;
};

const footerCopyright = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 24, right: 24, bottom: 24, left: 24 };
  s.borderTop = { color: theme.hairline, width: 1, style: "solid" };
  const t = makeText();
  t.content = `© ${new Date().getFullYear()} ${c.address || "Beispiel GmbH"} · Alle Rechte vorbehalten.<br><a href="{{unsubscribe_url}}" style="color:${theme.muted};">Abmelden</a> · <a href="#" style="color:${theme.muted};">Datenschutz</a>`;
  t.align = "center";
  t.color = theme.muted;
  t.fontSize = 11;
  t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [t];
  return s;
};

// ─── Layouts: Spezielle Inhalte ───────────────────────────────────────

const noticeBox = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 16, right: 24, bottom: 16, left: 24 };
  const inner = makeText();
  inner.content = `<strong style="color:${theme.fg};">${c.headline}</strong><br><span style="color:${theme.muted};">${c.subline}</span>`;
  inner.color = theme.fg;
  inner.padding = { top: 16, right: 16, bottom: 16, left: 16 };
  inner.backgroundColor = theme.card;
  inner.fontSize = 13;
  s.columns[0]!.blocks = [inner];
  return s;
};

const dividerWithLabel = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 24, right: 32, bottom: 24, left: 32 };
  const top = makeText();
  top.content = (c.eyebrow || c.headline || "Trennung").toUpperCase();
  top.color = theme.muted;
  top.align = "center";
  top.fontSize = 11;
  top.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const div = makeDivider();
  div.color = theme.hairline;
  div.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [top, div];
  return s;
};

const receiptList = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 24, right: 32, bottom: 24, left: 32 };
  const h = makeHeading(3);
  h.content = c.headline;
  h.color = theme.fg;
  h.padding = { top: 0, right: 0, bottom: 12, left: 0 };
  const items = c.bullets4 || c.bullets || [
    "Plan Pro · 49,00 €",
    "Onboarding · 0,00 €",
    "Steuer (19%) · 9,31 €",
  ];
  const rows = items
    .map(
      (line) => {
        const [name, price] = line.split("·");
        return `<tr><td style="padding:8px 0;border-bottom:1px solid ${theme.hairline};color:${theme.fg};font-family:Helvetica,Arial,sans-serif;font-size:13px;">${name?.trim() ?? ""}</td><td style="padding:8px 0;border-bottom:1px solid ${theme.hairline};color:${theme.fg};font-family:Helvetica,Arial,sans-serif;font-size:13px;text-align:right;">${price?.trim() ?? ""}</td></tr>`;
      },
    )
    .join("");
  // Wir nutzen einen Text-Block mit Inline-Tabelle (E-Mail-tauglich).
  const t = makeText();
  t.content = `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">${rows}</table>`;
  t.color = theme.fg;
  t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, t];
  return s;
};

const pricingSingle = (theme: Theme, c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 32, right: 32, bottom: 32, left: 32 };
  const eb = makeText();
  eb.content = (c.eyebrow || "Pro").toUpperCase();
  eb.color = theme.muted;
  eb.fontSize = 11;
  eb.align = "center";
  eb.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const price = makeText();
  price.content = `<strong style="font-size:36px;color:${theme.fg};">${c.headline || "49 €"}</strong> <span style="color:${theme.muted};font-size:14px;">/Monat</span>`;
  price.align = "center";
  price.padding = { top: 0, right: 0, bottom: 12, left: 0 };
  const list = makeList(false);
  list.items = (c.bullets4 || c.bullets || [
    "Alle Features",
    "Premium-Support",
    "Volle Skalierung",
  ]) as string[];
  list.color = theme.fg;
  list.padding = { top: 0, right: 0, bottom: 16, left: 0 };
  list.align = "left";
  const btn = makeButton();
  btn.text = c.cta;
  btn.backgroundColor = theme.accent;
  btn.color = theme.accentFg;
  btn.align = "center";
  btn.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [eb, price, list, btn];
  return s;
};

const galleryTwoByOne = (theme: Theme, c: Content): Section => {
  const s = setLayout(makeSection("1-1"), "1-1");
  applyBg(s, theme);
  s.padding = { top: 16, right: 16, bottom: 16, left: 16 };
  const a = makeImage();
  a.src = ph(theme, 280, 200, c.placeholder ? c.placeholder + " 1" : "Bild 1");
  a.width = "100%";
  a.borderRadius = 6;
  a.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  const b = makeImage();
  b.src = ph(theme, 280, 200, c.placeholder ? c.placeholder + " 2" : "Bild 2");
  b.width = "100%";
  b.borderRadius = 6;
  b.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [a];
  s.columns[1]!.blocks = [b];
  return s;
};

const spacerBlock = (theme: Theme, _c: Content): Section => {
  const s = makeSection("1");
  applyBg(s, theme);
  s.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  const sp = makeSpacer();
  sp.height = 32;
  sp.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [sp];
  return s;
};

// ─── Registry ─────────────────────────────────────────────────────────

export type LayoutBuilder = (theme: Theme, content: Content) => Section;

export const LAYOUTS: Record<string, { label: string; build: LayoutBuilder }> =
  {
    // Header
    header_logo_center: { label: "Logo zentriert", build: headerLogoCenter },
    header_logo_menu: { label: "Logo + Menü", build: headerLogoLeftMenu },
    header_banner: { label: "Titel-Banner", build: headerBanner },
    header_logo_tagline: { label: "Logo + Tagline", build: headerLogoTagline },
    header_hairline: { label: "Hairline-Header", build: headerHairline },

    // Hero
    hero_centered_cta: { label: "Zentrierter CTA", build: heroCenteredCTA },
    hero_full_image: { label: "Volles Bild", build: heroFullImage },
    hero_split_left: { label: "Bild links", build: heroSplitImageLeft },
    hero_split_right: { label: "Bild rechts", build: heroSplitImageRight },
    hero_eyebrow: { label: "Eyebrow + Headline", build: heroEyebrowHeadline },
    hero_minimal: { label: "Minimal Headline", build: heroMinimalText },

    // Content / Cards
    content_text: { label: "Text-Block", build: contentTextBlock },
    content_two_cards: { label: "2 Karten", build: contentTwoCards },
    content_three_features: { label: "3 Features", build: contentThreeFeatures },
    content_numbered_steps: { label: "3 Steps", build: contentNumberedSteps },
    content_bullet_list: { label: "Bullet-Liste", build: contentBulletList },
    content_numbered_list: { label: "Nummerierte Liste", build: contentNumberedList },
    content_image_text: { label: "Bild + Text", build: contentImageText },
    content_video_preview: { label: "Video-Vorschau", build: contentVideoPreview },

    // Quote
    quote_centered: { label: "Zentriertes Zitat", build: quoteCentered },
    quote_large_block: { label: "Großes Zitat", build: quoteLargeBlock },
    quote_avatar: { label: "Zitat + Avatar", build: quoteAvatar },

    // CTA
    cta_banner: { label: "CTA-Banner", build: ctaBanner },
    cta_two_buttons: { label: "Zwei Buttons", build: ctaTwoButtons },
    cta_with_subline: { label: "CTA + Subline", build: ctaWithSubline },
    cta_card: { label: "CTA-Karte", build: ctaCard },

    // Stats
    stats_three: { label: "3 Stats", build: statsThree },

    // Avatar / Team
    avatar_single: { label: "Avatar + Text", build: avatarSingle },
    avatar_three_team: { label: "Team (3)", build: avatarThreeTeam },

    // Footer
    footer_social: { label: "Footer + Social", build: footerSocial },
    footer_columns: { label: "Footer 3-Spaltig", build: footerColumns },
    footer_minimal: { label: "Footer minimal", build: footerMinimal },
    footer_copyright: { label: "Footer Copyright", build: footerCopyright },

    // Spezial
    notice_box: { label: "Hinweis-Box", build: noticeBox },
    divider_with_label: { label: "Trenner + Label", build: dividerWithLabel },
    receipt_list: { label: "Rechnungsposten", build: receiptList },
    pricing_single: { label: "Preis-Karte", build: pricingSingle },
    gallery_two_by_one: { label: "Bilder-Galerie", build: galleryTwoByOne },
    spacer_block: { label: "Leer-Spacer", build: spacerBlock },
  };

export type LayoutId = keyof typeof LAYOUTS;
