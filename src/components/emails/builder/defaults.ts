/**
 * Default-Konstruktoren für Body-Einstellungen, Sections, Spalten
 * und alle Content-Block-Typen.
 *
 * Jeder `make...`-Helper erzeugt einen frisch initialisierten Datensatz
 * mit unique `id` (UUID), passenden Default-Werten und sicheren
 * Fallbacks. Beim Hinzufügen eines Blocks/Section in den Editor
 * werden diese Defaults verwendet.
 */
import type {
  AvatarBlock,
  BodySettings,
  ButtonBlock,
  Column,
  ContentBlock,
  ContentBlockType,
  DividerBlock,
  EmailDesign,
  HeadingBlock,
  HtmlBlock,
  ImageBlock,
  ListBlock,
  QuoteBlock,
  Section,
  SectionLayout,
  SocialBlock,
  SocialNetwork,
  SpacerBlock,
  TextBlock,
  VideoBlock,
} from "./types";

/** Generiert einen URL-sicheren, kollisions-armen Identifier. */
export function newId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Email-sichere Fallback-Schriftart. */
export const SAFE_FONT = "Helvetica, Arial, sans-serif";

export function makeBody(): BodySettings {
  return {
    backgroundColor: "#f5f5f7",
    contentBackgroundColor: "#ffffff",
    contentWidth: 600,
    fontFamily: SAFE_FONT,
    color: "#3a3a3d",
    contentPaddingY: 24,
  };
}

export function makeColumn(): Column {
  return { id: newId("col"), blocks: [] };
}

export function makeSection(layout: SectionLayout = "1"): Section {
  const colCount =
    layout === "1" ? 1 : layout === "1-1-1" ? 3 : 2; /* 1-1 / 1-2 / 2-1 */
  const columns: Column[] = [];
  for (let i = 0; i < colCount; i++) columns.push(makeColumn());
  return {
    id: newId("sec"),
    layout,
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
    columns,
  };
}

export function makeText(): TextBlock {
  return {
    id: newId("blk"),
    type: "text",
    padding: { top: 0, right: 0, bottom: 12, left: 0 },
    content:
      "Schreibe hier deinen Text. Du kannst Variablen wie <strong>{{name}}</strong> oder <strong>{{company}}</strong> verwenden.",
    align: "left",
    fontFamily: SAFE_FONT,
    fontSize: 14,
    color: "#3a3a3d",
    lineHeight: 1.6,
  };
}

export function makeHeading(level: 1 | 2 | 3 = 2): HeadingBlock {
  const sizes = { 1: 26, 2: 20, 3: 16 } as const;
  return {
    id: newId("blk"),
    type: "heading",
    padding: { top: 0, right: 0, bottom: 8, left: 0 },
    level,
    content:
      level === 1 ? "Hallo {{name}}," : level === 2 ? "Überschrift" : "Zwischen­titel",
    align: "left",
    fontFamily: SAFE_FONT,
    fontSize: sizes[level],
    fontWeight: 600,
    color: "#0f0f10",
  };
}

export function makeButton(): ButtonBlock {
  return {
    id: newId("blk"),
    type: "button",
    padding: { top: 8, right: 0, bottom: 16, left: 0 },
    text: "Aktion ausführen",
    href: "https://example.com",
    align: "left",
    backgroundColor: "#0f0f10",
    color: "#ffffff",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    paddingX: 20,
    paddingY: 12,
    fullWidth: false,
  };
}

export function makeImage(): ImageBlock {
  return {
    id: newId("blk"),
    type: "image",
    padding: { top: 0, right: 0, bottom: 12, left: 0 },
    src: "https://via.placeholder.com/600x200?text=Bild",
    alt: "",
    width: "100%",
    align: "center",
    borderRadius: 0,
  };
}

export function makeSpacer(): SpacerBlock {
  return {
    id: newId("blk"),
    type: "spacer",
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    height: 24,
  };
}

export function makeDivider(): DividerBlock {
  return {
    id: newId("blk"),
    type: "divider",
    padding: { top: 8, right: 0, bottom: 8, left: 0 },
    color: "#e5e5e7",
    thickness: 1,
    inset: 0,
  };
}

export function makeList(ordered = false): ListBlock {
  return {
    id: newId("blk"),
    type: "list",
    padding: { top: 0, right: 0, bottom: 12, left: 0 },
    ordered,
    items: [
      "Erster Listenpunkt",
      "Zweiter Listenpunkt",
      "Dritter Listenpunkt",
    ],
    align: "left",
    fontFamily: SAFE_FONT,
    fontSize: 14,
    color: "#3a3a3d",
    lineHeight: 1.6,
    itemSpacing: 4,
  };
}

export function makeQuote(): QuoteBlock {
  return {
    id: newId("blk"),
    type: "quote",
    padding: { top: 8, right: 0, bottom: 12, left: 0 },
    content:
      "„Das beste Produkt, das ich seit Jahren benutzt habe – wirklich beeindruckend.\u201d",
    cite: "— Max Mustermann, CTO @ Beispiel GmbH",
    align: "left",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 16,
    color: "#3a3a3d",
    accentColor: "#0f0f10",
    accentWidth: 4,
  };
}

export function makeVideo(): VideoBlock {
  return {
    id: newId("blk"),
    type: "video",
    padding: { top: 0, right: 0, bottom: 12, left: 0 },
    thumbnailUrl: "https://via.placeholder.com/600x340?text=Video+Thumbnail",
    videoUrl: "https://example.com/video",
    alt: "Video ansehen",
    align: "center",
    width: "100%",
    showPlayOverlay: true,
    playButtonColor: "#ffffff",
    borderRadius: 6,
  };
}

const SOCIAL_NETWORK_DEFAULTS: Record<
  SocialNetwork,
  { label: string; defaultUrl: string }
> = {
  facebook: { label: "Facebook", defaultUrl: "https://facebook.com/" },
  x: { label: "X / Twitter", defaultUrl: "https://x.com/" },
  instagram: { label: "Instagram", defaultUrl: "https://instagram.com/" },
  linkedin: { label: "LinkedIn", defaultUrl: "https://linkedin.com/in/" },
  youtube: { label: "YouTube", defaultUrl: "https://youtube.com/@" },
  tiktok: { label: "TikTok", defaultUrl: "https://tiktok.com/@" },
  github: { label: "GitHub", defaultUrl: "https://github.com/" },
  website: { label: "Website", defaultUrl: "https://example.com" },
  email: { label: "E-Mail", defaultUrl: "mailto:hello@example.com" },
};

export const SOCIAL_NETWORKS = Object.keys(
  SOCIAL_NETWORK_DEFAULTS,
) as SocialNetwork[];

export function socialLabel(n: SocialNetwork): string {
  return SOCIAL_NETWORK_DEFAULTS[n].label;
}
export function socialDefaultUrl(n: SocialNetwork): string {
  return SOCIAL_NETWORK_DEFAULTS[n].defaultUrl;
}

export function makeSocial(): SocialBlock {
  const networks: SocialNetwork[] = ["facebook", "instagram", "x", "linkedin"];
  return {
    id: newId("blk"),
    type: "social",
    padding: { top: 0, right: 0, bottom: 12, left: 0 },
    links: networks.map((n) => ({
      id: newId("sn"),
      network: n,
      url: SOCIAL_NETWORK_DEFAULTS[n].defaultUrl,
    })),
    align: "center",
    iconSize: 28,
    gap: 12,
    style: "color",
    monoColor: "#3a3a3d",
  };
}

export function makeAvatar(): AvatarBlock {
  return {
    id: newId("blk"),
    type: "avatar",
    padding: { top: 8, right: 0, bottom: 12, left: 0 },
    imageUrl: "https://via.placeholder.com/96x96?text=Foto",
    name: "Vor- und Nachname",
    subtitle: "Rolle · Firma",
    layout: "horizontal",
    align: "left",
    imageSize: 56,
    imageRounded: true,
    imageBorderRadius: 8,
    fontFamily: SAFE_FONT,
    nameColor: "#0f0f10",
    subtitleColor: "#6a6a70",
  };
}

export function makeHtml(): HtmlBlock {
  return {
    id: newId("blk"),
    type: "html",
    padding: { top: 0, right: 0, bottom: 12, left: 0 },
    html: "<p style=\"margin:0;font-family:Helvetica,Arial,sans-serif;\">Custom-HTML hier.</p>",
  };
}

const BLOCK_FACTORIES: Record<ContentBlockType, () => ContentBlock> = {
  text: makeText,
  heading: () => makeHeading(2),
  button: makeButton,
  image: makeImage,
  spacer: makeSpacer,
  divider: makeDivider,
  list: () => makeList(false),
  quote: makeQuote,
  video: makeVideo,
  social: makeSocial,
  avatar: makeAvatar,
  html: makeHtml,
};

export function makeBlock(type: ContentBlockType): ContentBlock {
  return BLOCK_FACTORIES[type]();
}

/** Komplett leeres Design. Wird verwendet, wenn keine Vorlage gewählt wurde. */
export function makeEmptyDesign(): EmailDesign {
  return {
    version: 1,
    body: makeBody(),
    sections: [],
  };
}

/** Einfaches "Hallo, Text, Button"-Default für neue Vorlagen. */
export function makeDefaultDesign(): EmailDesign {
  const section = makeSection("1");
  section.columns[0]!.blocks = [
    makeHeading(1),
    makeText(),
    makeButton(),
  ];
  return {
    version: 1,
    body: makeBody(),
    sections: [section],
  };
}
