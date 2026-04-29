/**
 * Section-Templates: vorgefertigte Section-Bausteine, die der User per
 * Klick in seine Mail einfügt. Jede Vorlage ist eine reine Daten-
 * Funktion und liefert ein frisches `Section`-Objekt mit eindeutigen
 * IDs zurück, sodass mehrfaches Einfügen kollisionsfrei ist.
 *
 * Kategorien:
 *   - "header"   Logo-Bänder, Titel-Bänder
 *   - "hero"     große Aufmacher mit Bild + CTA
 *   - "content"  Text/Zitat/Liste/Karten zwischen Header und Footer
 *   - "cta"      Call-to-Action-Banner
 *   - "footer"   Abschluss mit Social, Adresse, Abmelde-Link
 *
 * Achtung: Wir bauen die Sections direkt aus den `make…`-Defaults und
 * passen einzelne Felder an — so bleibt das Modell erweiterbar (neue
 * Default-Felder werden automatisch übernommen).
 */
import {
  makeAvatar,
  makeButton,
  makeHeading,
  makeImage,
  makeList,
  makeQuote,
  makeSection,
  makeSocial,
  makeText,
  newId,
} from "./defaults";
import type { Section, SectionLayout } from "./types";

export type SectionCategory = "header" | "hero" | "content" | "cta" | "footer";

export type SectionTemplate = {
  id: string;
  category: SectionCategory;
  label: string;
  description: string;
  build: () => Section;
};

// ─── Header ───────────────────────────────────────────────────────────

const headerLogoCenter = (): Section => {
  const s = makeSection("1");
  s.padding = { top: 28, right: 24, bottom: 20, left: 24 };
  const img = makeImage();
  img.src = "https://via.placeholder.com/140x40?text=Logo";
  img.width = 140;
  img.align = "center";
  img.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [img];
  return s;
};

const headerLogoLeftMenuRight = (): Section => {
  const s = makeSection("1-1");
  s.padding = { top: 20, right: 24, bottom: 20, left: 24 };

  const logo = makeImage();
  logo.src = "https://via.placeholder.com/120x36?text=Logo";
  logo.width = 120;
  logo.align = "left";
  logo.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [logo];

  const menu = makeText();
  menu.content =
    '<a href="#" style="color:inherit;text-decoration:none;margin-right:14px;">Produkt</a><a href="#" style="color:inherit;text-decoration:none;margin-right:14px;">Preise</a><a href="#" style="color:inherit;text-decoration:none;">Kontakt</a>';
  menu.align = "right";
  menu.padding = { top: 8, right: 0, bottom: 0, left: 0 };
  menu.fontSize = 13;
  s.columns[1]!.blocks = [menu];
  return s;
};

const headerDarkBanner = (): Section => {
  const s = makeSection("1");
  s.backgroundColor = "#0f0f10";
  s.padding = { top: 24, right: 24, bottom: 24, left: 24 };
  const h = makeHeading(2);
  h.content = "Vehicle Imagery";
  h.color = "#ffffff";
  h.align = "center";
  h.fontSize = 18;
  h.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h];
  return s;
};

const headerLogoTagline = (): Section => {
  const s = makeSection("1");
  s.padding = { top: 28, right: 24, bottom: 16, left: 24 };
  const img = makeImage();
  img.src = "https://via.placeholder.com/120x36?text=Logo";
  img.width = 120;
  img.align = "center";
  img.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const tagline = makeText();
  tagline.content = "Premium-Fahrzeugbilder, automatisch erzeugt.";
  tagline.align = "center";
  tagline.fontSize = 12;
  tagline.color = "#6a6a70";
  tagline.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [img, tagline];
  return s;
};

// ─── Hero ─────────────────────────────────────────────────────────────

const heroFullImage = (): Section => {
  const s = makeSection("1");
  s.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  const img = makeImage();
  img.src = "https://via.placeholder.com/600x320?text=Hero";
  img.width = "100%";
  img.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  img.borderRadius = 0;
  s.columns[0]!.blocks = [img];
  return s;
};

const heroCenteredCTA = (): Section => {
  const s = makeSection("1");
  s.padding = { top: 56, right: 32, bottom: 56, left: 32 };
  s.backgroundColor = "#f7f7f9";
  const h = makeHeading(1);
  h.content = "Willkommen, {{name}}";
  h.align = "center";
  h.fontSize = 32;
  h.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const sub = makeText();
  sub.content =
    "Schön, dass du da bist. Hier ist alles, was du für den Start brauchst.";
  sub.align = "center";
  sub.fontSize = 15;
  sub.color = "#6a6a70";
  sub.padding = { top: 0, right: 0, bottom: 20, left: 0 };
  const btn = makeButton();
  btn.text = "Jetzt loslegen";
  btn.align = "center";
  btn.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, sub, btn];
  return s;
};

const heroSplit = (): Section => {
  const s = makeSection("1-1");
  s.padding = { top: 32, right: 24, bottom: 32, left: 24 };

  const img = makeImage();
  img.src = "https://via.placeholder.com/280x200?text=Bild";
  img.width = "100%";
  img.borderRadius = 8;
  img.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [img];

  const h = makeHeading(2);
  h.content = "Neu für dich";
  h.padding = { top: 0, right: 0, bottom: 6, left: 0 };
  const t = makeText();
  t.content =
    "Eine kurze Zusammenfassung, warum diese Mail relevant ist und was als Nächstes passiert.";
  t.padding = { top: 0, right: 0, bottom: 16, left: 0 };
  const btn = makeButton();
  btn.text = "Mehr erfahren";
  btn.align = "left";
  btn.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[1]!.blocks = [h, t, btn];
  return s;
};

const heroDarkOverlay = (): Section => {
  const s = makeSection("1");
  s.backgroundColor = "#0f0f10";
  s.padding = { top: 56, right: 32, bottom: 56, left: 32 };
  const h = makeHeading(1);
  h.content = "Großer Schritt voraus";
  h.color = "#ffffff";
  h.align = "center";
  h.fontSize = 30;
  h.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const sub = makeText();
  sub.content =
    "Eine kurze, einprägsame Zeile, die dein Angebot zusammenfasst.";
  sub.align = "center";
  sub.color = "#a0a0a8";
  sub.fontSize = 14;
  sub.padding = { top: 0, right: 0, bottom: 20, left: 0 };
  const btn = makeButton();
  btn.text = "Jetzt entdecken";
  btn.backgroundColor = "#ffffff";
  btn.color = "#0f0f10";
  btn.align = "center";
  btn.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, sub, btn];
  return s;
};

// ─── Content ──────────────────────────────────────────────────────────

const contentTextBlock = (): Section => {
  const s = makeSection("1");
  s.padding = { top: 24, right: 32, bottom: 24, left: 32 };
  const h = makeHeading(2);
  h.content = "Worum es geht";
  h.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const t = makeText();
  t.content =
    "Hier kommt der Hauptinhalt. Du kannst Variablen wie <strong>{{name}}</strong> oder <strong>{{company}}</strong> verwenden, um die Mail zu personalisieren.";
  t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, t];
  return s;
};

const contentTwoCards = (): Section => {
  const s = makeSection("1-1");
  s.padding = { top: 16, right: 24, bottom: 24, left: 24 };

  const buildCard = (title: string, subtitle: string) => {
    const img = makeImage();
    img.src = `https://via.placeholder.com/280x160?text=${encodeURIComponent(title)}`;
    img.width = "100%";
    img.borderRadius = 8;
    img.padding = { top: 0, right: 0, bottom: 8, left: 0 };
    const h = makeHeading(3);
    h.content = title;
    h.padding = { top: 4, right: 0, bottom: 4, left: 0 };
    const t = makeText();
    t.content = subtitle;
    t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    return [img, h, t];
  };

  s.columns[0]!.blocks = buildCard("Karte 1", "Kurzer Beschreibungstext.");
  s.columns[1]!.blocks = buildCard("Karte 2", "Kurzer Beschreibungstext.");
  return s;
};

const contentThreeFeatures = (): Section => {
  const s = makeSection("1-1-1");
  s.padding = { top: 16, right: 24, bottom: 24, left: 24 };
  const buildFeature = (title: string) => {
    const h = makeHeading(3);
    h.content = title;
    h.padding = { top: 0, right: 0, bottom: 4, left: 0 };
    h.fontSize = 14;
    const t = makeText();
    t.content = "Eine Zeile zum Feature.";
    t.fontSize = 12;
    t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    return [h, t];
  };
  s.columns[0]!.blocks = buildFeature("Schnell");
  s.columns[1]!.blocks = buildFeature("Sicher");
  s.columns[2]!.blocks = buildFeature("Skaliert");
  return s;
};

const contentQuote = (): Section => {
  const s = makeSection("1");
  s.backgroundColor = "#f7f7f9";
  s.padding = { top: 32, right: 32, bottom: 32, left: 32 };
  const q = makeQuote();
  q.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [q];
  return s;
};

const contentBulletList = (): Section => {
  const s = makeSection("1");
  s.padding = { top: 8, right: 32, bottom: 24, left: 32 };
  const h = makeHeading(3);
  h.content = "Das ist neu";
  h.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const list = makeList(false);
  list.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, list];
  return s;
};

const contentBioCard = (): Section => {
  const s = makeSection("1");
  s.padding = { top: 24, right: 24, bottom: 24, left: 24 };
  s.backgroundColor = "#f7f7f9";
  const av = makeAvatar();
  av.layout = "horizontal";
  av.imageSize = 48;
  av.padding = { top: 0, right: 0, bottom: 12, left: 0 };
  const t = makeText();
  t.content =
    "Eine kurze persönliche Note, geschrieben von einem Menschen statt einer Marketing-Maschine.";
  t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [av, t];
  return s;
};

const contentVideo = (): Section => {
  const s = makeSection("1");
  s.padding = { top: 16, right: 32, bottom: 24, left: 32 };
  const h = makeHeading(3);
  h.content = "Schau dir das Video an";
  h.padding = { top: 0, right: 0, bottom: 8, left: 0 };
  const v = makeImage();
  // Wir nutzen Image-Block + Padding statt Video-Block, damit das
  // Template auch in alten Mail-Clients sauber aussieht. (User kann
  // das Bild durch seinen Video-Block ersetzen, wenn er Play-Overlay
  // möchte.)
  v.src = "https://via.placeholder.com/600x340?text=Video+Thumbnail";
  v.borderRadius = 8;
  v.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, v];
  return s;
};

// ─── CTA ──────────────────────────────────────────────────────────────

const ctaBanner = (): Section => {
  const s = makeSection("1");
  s.backgroundColor = "#0f0f10";
  s.padding = { top: 36, right: 32, bottom: 36, left: 32 };
  const h = makeHeading(2);
  h.content = "Bereit für den nächsten Schritt?";
  h.color = "#ffffff";
  h.align = "center";
  h.padding = { top: 0, right: 0, bottom: 12, left: 0 };
  const btn = makeButton();
  btn.text = "Jetzt starten";
  btn.backgroundColor = "#ffffff";
  btn.color = "#0f0f10";
  btn.align = "center";
  btn.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [h, btn];
  return s;
};

const ctaTwoButtons = (): Section => {
  const s = makeSection("1-1");
  s.padding = { top: 28, right: 24, bottom: 28, left: 24 };

  const left = makeButton();
  left.text = "Primäre Aktion";
  left.align = "right";
  left.padding = { top: 0, right: 6, bottom: 0, left: 0 };
  const right = makeButton();
  right.text = "Sekundäre Aktion";
  right.backgroundColor = "transparent";
  right.color = "#0f0f10";
  right.border = { color: "#0f0f10", width: 1, style: "solid" };
  right.align = "left";
  right.padding = { top: 0, right: 0, bottom: 0, left: 6 };
  s.columns[0]!.blocks = [left];
  s.columns[1]!.blocks = [right];
  return s;
};

// ─── Footer ───────────────────────────────────────────────────────────

const footerSocialAddress = (): Section => {
  const s = makeSection("1");
  s.padding = { top: 24, right: 24, bottom: 24, left: 24 };
  s.borderTop = { color: "#e5e5e7", width: 1, style: "solid" };

  const social = makeSocial();
  social.align = "center";
  social.padding = { top: 0, right: 0, bottom: 12, left: 0 };

  const addr = makeText();
  addr.content = "Beispiel GmbH · Musterstraße 1 · 12345 Berlin";
  addr.align = "center";
  addr.color = "#9999a0";
  addr.fontSize = 11;
  addr.padding = { top: 0, right: 0, bottom: 6, left: 0 };

  const unsub = makeText();
  unsub.content =
    'Du erhältst diese Mail, weil du dich registriert hast. <a href="{{unsubscribe_url}}" style="color:#9999a0;text-decoration:underline;">Abmelden</a>';
  unsub.align = "center";
  unsub.color = "#9999a0";
  unsub.fontSize = 11;
  unsub.padding = { top: 0, right: 0, bottom: 0, left: 0 };

  s.columns[0]!.blocks = [social, addr, unsub];
  return s;
};

const footerColumns = (): Section => {
  const s = makeSection("1-1-1");
  s.padding = { top: 24, right: 24, bottom: 24, left: 24 };
  s.borderTop = { color: "#e5e5e7", width: 1, style: "solid" };

  const col1 = makeText();
  col1.content =
    '<strong style="color:#3a3a3d;">Produkt</strong><br><a href="#" style="color:#9999a0;text-decoration:none;">Features</a><br><a href="#" style="color:#9999a0;text-decoration:none;">Preise</a>';
  col1.fontSize = 12;
  col1.color = "#9999a0";
  col1.padding = { top: 0, right: 0, bottom: 0, left: 0 };

  const col2 = makeText();
  col2.content =
    '<strong style="color:#3a3a3d;">Firma</strong><br><a href="#" style="color:#9999a0;text-decoration:none;">Über uns</a><br><a href="#" style="color:#9999a0;text-decoration:none;">Kontakt</a>';
  col2.fontSize = 12;
  col2.color = "#9999a0";
  col2.padding = { top: 0, right: 0, bottom: 0, left: 0 };

  const col3 = makeText();
  col3.content =
    '<strong style="color:#3a3a3d;">Rechtliches</strong><br><a href="#" style="color:#9999a0;text-decoration:none;">Impressum</a><br><a href="{{unsubscribe_url}}" style="color:#9999a0;text-decoration:none;">Abmelden</a>';
  col3.fontSize = 12;
  col3.color = "#9999a0";
  col3.padding = { top: 0, right: 0, bottom: 0, left: 0 };

  s.columns[0]!.blocks = [col1];
  s.columns[1]!.blocks = [col2];
  s.columns[2]!.blocks = [col3];
  return s;
};

const footerMinimal = (): Section => {
  const s = makeSection("1");
  s.padding = { top: 16, right: 24, bottom: 16, left: 24 };
  const t = makeText();
  t.content =
    'Beispiel GmbH · <a href="{{unsubscribe_url}}" style="color:#9999a0;">Abmelden</a>';
  t.align = "center";
  t.color = "#9999a0";
  t.fontSize = 11;
  t.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  s.columns[0]!.blocks = [t];
  return s;
};

// ─── Liste aller Templates ────────────────────────────────────────────

export const SECTION_TEMPLATES: SectionTemplate[] = [
  // Header
  {
    id: "header_logo_center",
    category: "header",
    label: "Logo zentriert",
    description: "Schmaler Header mit zentriertem Logo.",
    build: headerLogoCenter,
  },
  {
    id: "header_logo_menu",
    category: "header",
    label: "Logo + Menü",
    description: "Logo links, drei Text-Links rechts.",
    build: headerLogoLeftMenuRight,
  },
  {
    id: "header_dark_banner",
    category: "header",
    label: "Dunkler Banner",
    description: "Schwarzer Header mit weißem Titel.",
    build: headerDarkBanner,
  },
  {
    id: "header_logo_tagline",
    category: "header",
    label: "Logo + Tagline",
    description: "Logo zentriert, mit kurzer Untertitel-Zeile.",
    build: headerLogoTagline,
  },

  // Hero
  {
    id: "hero_full_image",
    category: "hero",
    label: "Großes Bild",
    description: "Vollflächiges Hero-Bild ohne Padding.",
    build: heroFullImage,
  },
  {
    id: "hero_centered_cta",
    category: "hero",
    label: "Zentrierter CTA",
    description: "Headline + Untertitel + Button, mittig.",
    build: heroCenteredCTA,
  },
  {
    id: "hero_split",
    category: "hero",
    label: "Bild + Text Split",
    description: "Bild links, Headline + Button rechts.",
    build: heroSplit,
  },
  {
    id: "hero_dark_overlay",
    category: "hero",
    label: "Dunkler Hero",
    description: "Dunkles Banner mit hellem CTA-Button.",
    build: heroDarkOverlay,
  },

  // Content
  {
    id: "content_text",
    category: "content",
    label: "Text-Block",
    description: "Überschrift + Absatztext.",
    build: contentTextBlock,
  },
  {
    id: "content_two_cards",
    category: "content",
    label: "2 Karten",
    description: "Zwei Karten mit Bild + Titel + Text.",
    build: contentTwoCards,
  },
  {
    id: "content_three_features",
    category: "content",
    label: "3 Features",
    description: "Drei kurze Feature-Spalten.",
    build: contentThreeFeatures,
  },
  {
    id: "content_quote",
    category: "content",
    label: "Zitat",
    description: "Großes Zitat auf hellem Hintergrund.",
    build: contentQuote,
  },
  {
    id: "content_bullet_list",
    category: "content",
    label: "Bullet-Liste",
    description: "Überschrift + Liste mit Stichpunkten.",
    build: contentBulletList,
  },
  {
    id: "content_bio_card",
    category: "content",
    label: "Persönliche Notiz",
    description: "Avatar mit Person + kurzem Text.",
    build: contentBioCard,
  },
  {
    id: "content_video",
    category: "content",
    label: "Video-Vorschau",
    description: "Überschrift + großes Video-Thumbnail.",
    build: contentVideo,
  },

  // CTA
  {
    id: "cta_banner",
    category: "cta",
    label: "CTA-Banner",
    description: "Dunkles Banner mit Headline + Button.",
    build: ctaBanner,
  },
  {
    id: "cta_two_buttons",
    category: "cta",
    label: "2 Buttons",
    description: "Primärer + sekundärer Button nebeneinander.",
    build: ctaTwoButtons,
  },

  // Footer
  {
    id: "footer_social_address",
    category: "footer",
    label: "Social + Adresse",
    description: "Social-Icons, Adresse, Abmelde-Link.",
    build: footerSocialAddress,
  },
  {
    id: "footer_columns",
    category: "footer",
    label: "Drei Spalten",
    description: "Footer-Links in 3 Spalten + Trennlinie.",
    build: footerColumns,
  },
  {
    id: "footer_minimal",
    category: "footer",
    label: "Minimal",
    description: "Einzeiliger Footer mit Abmelde-Link.",
    build: footerMinimal,
  },
];

export const SECTION_CATEGORIES: { id: SectionCategory; label: string }[] = [
  { id: "header", label: "Header" },
  { id: "hero", label: "Hero" },
  { id: "content", label: "Inhalt" },
  { id: "cta", label: "CTA" },
  { id: "footer", label: "Footer" },
];

/**
 * Erzeugt eine frische Kopie der Section mit eindeutigen IDs.
 * Wird beim Einfügen ins Design genutzt — sonst gäbe es ID-
 * Kollisionen, wenn dieselbe Vorlage mehrfach eingefügt wird.
 */
export function freshSection(s: Section): Section {
  const cloned: Section = JSON.parse(JSON.stringify(s));
  cloned.id = newId("sec");
  cloned.columns.forEach((c) => {
    c.id = newId("col");
    c.blocks.forEach((b) => {
      b.id = newId("blk");
    });
  });
  return cloned;
}

// Wir exportieren auch Layout-Konstanten, damit der UI-Layer die
// Vorschau-Spaltenproportionen rendern kann, ohne den Renderer zu
// importieren.
export const SECTION_LAYOUT_RATIOS: Record<SectionLayout, number[]> = {
  "1": [100],
  "1-1": [50, 50],
  "1-2": [33, 67],
  "2-1": [67, 33],
  "1-1-1": [33, 33, 34],
};
