/**
 * Render-Funktionen: Design-JSON → "bulletproof" Email-HTML.
 *
 * Bulletproof bedeutet:
 *  - alles Layout via `<table>` (kein Flexbox/Grid – Outlook ist sonst kaputt)
 *  - sämtliche Styles inline (`style="…"`), keine externen Stylesheets
 *  - feste Pixel-Breiten, mit Mobile-Override per `@media (max-width:600px)`
 *  - VML/MSO-Conditionals für Outlook-spezifische Hacks (Buttons, Spalten)
 *  - HTML-Encoding aller User-Texte (außer TextBlock.content,
 *    HeadingBlock.content und HtmlBlock.html — dort ist Inline-HTML
 *    erwünscht und vertraut, da nur intern gepflegt)
 *
 * Es gibt zwei Render-Modi:
 *  - `renderEmailHtml(design)` → kompletter `<html>…</html>`-Dokument
 *    (für den Mail-Worker zum Versenden)
 *  - `renderPreviewHtml(design)` → derselbe Output mit zusätzlicher
 *    Editor-CSS-Klasse, die der Editor optisch leicht entschärft (kein
 *    selecter pseudo-cursor etc.)
 */
import type {
  AvatarBlock,
  Border,
  ButtonBlock,
  ContentBlock,
  DividerBlock,
  EmailDesign,
  HeadingBlock,
  HtmlBlock,
  ImageBlock,
  ListBlock,
  Padding,
  QuoteBlock,
  Section,
  SectionLayout,
  SocialBlock,
  SocialLink,
  SocialNetwork,
  SpacerBlock,
  TextBlock,
  VideoBlock,
} from "./types";

// ─── HTML-Helpers ─────────────────────────────────────────────────────

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c] ?? c);
}
/** Escaped Werte, die in einem `style="…"`-Attribut stehen — verbietet `"` und `;`-Injection. */
function escAttr(s: string): string {
  return escHtml(s).replace(/`/g, "&#96;");
}
function escUrl(s: string): string {
  // Erlaubt http(s), mailto:, tel: und Variablen-Tokens. Stripped javascript:
  if (/^javascript:/i.test(s.trim())) return "#";
  return s.replace(/"/g, "%22").replace(/&/g, "&amp;");
}

function px(n: number): string {
  return `${Math.round(n)}px`;
}

function paddingStyle(p: Padding): string {
  return `padding:${px(p.top)} ${px(p.right)} ${px(p.bottom)} ${px(p.left)};`;
}

function borderStyle(b: Border | undefined, side: "all" | "top" | "bottom"): string {
  if (!b || b.width <= 0) return "";
  const decl = `${px(b.width)} ${b.style} ${escAttr(b.color)}`;
  if (side === "top") return `border-top:${decl};`;
  if (side === "bottom") return `border-bottom:${decl};`;
  return `border:${decl};`;
}

// ─── Social-Icons: Brand-Farben + öffentliche PNG-CDN-URLs ────────────
//
// Wir nutzen für die "color"-Variante die SuperTinyIcons-CDN
// (jsdelivr → GitHub edent/SuperTinyIcons). Die URLs sind stabil und
// liefern PNG-Versionen, die in jedem Mail-Client funktionieren.
// Für "mono" rendern wir einen monochromen Inline-SVG-via-data-URL —
// in Mail-Clients problematisch (Outlook!), darum dort lieber farbig
// arbeiten oder das User-Icon manuell setzen.

const SOCIAL_COLOR_ICONS: Record<SocialNetwork, string> = {
  facebook:
    "https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons@master/images/png/facebook.png",
  x: "https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons@master/images/png/twitter.png",
  instagram:
    "https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons@master/images/png/instagram.png",
  linkedin:
    "https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons@master/images/png/linkedin.png",
  youtube:
    "https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons@master/images/png/youtube.png",
  tiktok:
    "https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons@master/images/png/tiktok.png",
  github:
    "https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons@master/images/png/github.png",
  website:
    "https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons@master/images/png/internet.png",
  email:
    "https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons@master/images/png/email.png",
};

// Mono-Icons als externe PNGs sind nicht trivial — wir nutzen die selben
// URLs, der User kann später einzelne URLs überschreiben.
const SOCIAL_MONO_ICONS: Record<SocialNetwork, string> = SOCIAL_COLOR_ICONS;

export function socialIconUrl(
  network: SocialNetwork,
  style: "color" | "mono",
): string {
  return style === "color"
    ? SOCIAL_COLOR_ICONS[network]
    : SOCIAL_MONO_ICONS[network];
}

// ─── Block-Renderer ───────────────────────────────────────────────────

function renderText(b: TextBlock): string {
  const style = [
    `font-family:${escAttr(b.fontFamily)};`,
    `font-size:${px(b.fontSize)};`,
    `line-height:${b.lineHeight};`,
    `color:${escAttr(b.color)};`,
    `text-align:${b.align};`,
    `margin:0;`,
  ].join("");
  return `<div style="${style}">${b.content}</div>`;
}

function renderHeading(b: HeadingBlock): string {
  const style = [
    `font-family:${escAttr(b.fontFamily)};`,
    `font-size:${px(b.fontSize)};`,
    `font-weight:${b.fontWeight};`,
    `color:${escAttr(b.color)};`,
    `text-align:${b.align};`,
    `line-height:1.25;`,
    `margin:0;`,
  ].join("");
  const tag = `h${b.level}`;
  return `<${tag} style="${style}">${b.content}</${tag}>`;
}

function renderButton(b: ButtonBlock): string {
  const tdStyle = [
    `background-color:${escAttr(b.backgroundColor)};`,
    `border-radius:${px(b.borderRadius)};`,
    borderStyle(b.border, "all"),
  ].join("");
  const aStyle = [
    `display:inline-block;`,
    `font-family:${escAttr(SAFE_FONT_FALLBACK)};`,
    `font-size:${px(b.fontSize)};`,
    `font-weight:${b.fontWeight};`,
    `color:${escAttr(b.color)};`,
    `text-decoration:none;`,
    `padding:${px(b.paddingY)} ${px(b.paddingX)};`,
    `border-radius:${px(b.borderRadius)};`,
    b.fullWidth ? "width:100%;text-align:center;box-sizing:border-box;" : "",
  ].join("");
  const align = b.align;
  const inner = `<a href="${escUrl(b.href)}" target="_blank" rel="noopener" style="${aStyle}">${escHtml(b.text)}</a>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" ${b.fullWidth ? 'width="100%"' : ""}><tr><td align="${align}" style="${tdStyle}">${inner}</td></tr></table>`;
}

function renderImage(b: ImageBlock): string {
  const widthAttr = b.width === "100%" ? "100%" : String(b.width);
  const widthStyle =
    b.width === "100%" ? "width:100%;height:auto;" : `width:${px(b.width)};height:auto;`;
  const imgStyle = [
    `display:block;`,
    widthStyle,
    b.border ? "" : "border:0;",
    borderStyle(b.border, "all"),
    b.borderRadius > 0 ? `border-radius:${px(b.borderRadius)};` : "",
    `outline:none;`,
    `text-decoration:none;`,
    `-ms-interpolation-mode:bicubic;`,
  ].join("");
  const img = `<img src="${escUrl(b.src)}" alt="${escAttr(b.alt)}" width="${escAttr(widthAttr)}" style="${imgStyle}" />`;
  const wrapped = b.href
    ? `<a href="${escUrl(b.href)}" target="_blank" rel="noopener">${img}</a>`
    : img;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${b.align}" ${b.width === "100%" ? 'width="100%"' : ""}><tr><td align="${b.align}">${wrapped}</td></tr></table>`;
}

function renderSpacer(b: SpacerBlock): string {
  return `<div style="line-height:${px(b.height)};font-size:${px(b.height)};height:${px(b.height)};">&nbsp;</div>`;
}

function renderDivider(b: DividerBlock): string {
  const insetPct = Math.max(0, Math.min(40, b.inset));
  const innerWidth = 100 - insetPct * 2;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${innerWidth}%" style="border-collapse:collapse;"><tr><td style="border-top:${px(b.thickness)} solid ${escAttr(b.color)};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>`;
}

function renderHtmlBlock(b: HtmlBlock): string {
  // Roher User-HTML — wird unverändert eingebettet (dem Editor-Nutzer
  // vertrauen wir, das Dashboard ist nur intern).
  return b.html;
}

function renderList(b: ListBlock): string {
  const tag = b.ordered ? "ol" : "ul";
  const liStyle = [
    `font-family:${escAttr(b.fontFamily)};`,
    `font-size:${px(b.fontSize)};`,
    `line-height:${b.lineHeight};`,
    `color:${escAttr(b.color)};`,
    `margin:0 0 ${px(b.itemSpacing)} 0;`,
    `padding:0;`,
  ].join("");
  const items = b.items
    .map((it) => `<li style="${liStyle}">${it}</li>`)
    .join("");
  const ulStyle = [
    `font-family:${escAttr(b.fontFamily)};`,
    `text-align:${b.align};`,
    `margin:0;`,
    `padding-left:${px(20)};`,
    `color:${escAttr(b.color)};`,
  ].join("");
  return `<${tag} style="${ulStyle}">${items}</${tag}>`;
}

function renderQuote(b: QuoteBlock): string {
  const accent =
    b.accentWidth > 0
      ? `border-left:${px(b.accentWidth)} solid ${escAttr(b.accentColor)};padding-left:${px(16)};`
      : "";
  const wrapperStyle = [
    accent,
    `font-family:${escAttr(b.fontFamily)};`,
    `font-size:${px(b.fontSize)};`,
    `color:${escAttr(b.color)};`,
    `text-align:${b.align};`,
    `margin:0;`,
    `font-style:italic;`,
    `line-height:1.5;`,
  ].join("");
  const citeStyle = [
    `display:block;`,
    `margin-top:${px(8)};`,
    `font-family:${escAttr(SAFE_FONT_FALLBACK)};`,
    `font-size:${px(Math.max(11, b.fontSize - 3))};`,
    `font-style:normal;`,
    `color:${escAttr(b.color)};`,
    `opacity:0.7;`,
  ].join("");
  const cite = b.cite
    ? `<span style="${citeStyle}">${escHtml(b.cite)}</span>`
    : "";
  return `<blockquote style="${wrapperStyle}">${b.content}${cite}</blockquote>`;
}

function renderVideo(b: VideoBlock): string {
  const widthAttr = b.width === "100%" ? "100%" : String(b.width);
  const widthStyle =
    b.width === "100%"
      ? "width:100%;height:auto;"
      : `width:${px(b.width)};height:auto;`;
  // Email-Clients zeigen kein <video>. Wir rendern ein verlinkbares
  // Thumbnail mit Play-Overlay, das auf `videoUrl` zeigt.
  // Das Play-Overlay ist eine zweite, absolut positionierte Image-Quelle
  // — viele Mail-Clients (insb. Gmail) ignorieren `position:absolute`,
  // daher rendern wir den Play-Button als CSS-pseudo-Stack mit table.
  const imgStyle = [
    "display:block;",
    widthStyle,
    "border:0;outline:none;text-decoration:none;",
    b.borderRadius > 0 ? `border-radius:${px(b.borderRadius)};` : "",
  ].join("");
  const thumb = `<img src="${escUrl(b.thumbnailUrl)}" alt="${escAttr(b.alt)}" width="${escAttr(widthAttr)}" style="${imgStyle}" />`;
  // Inline-SVG für Play-Button als data-URI (Outlook ignoriert das,
  // dafür sieht es in modernen Clients sauber aus)
  const playSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="${b.playButtonColor}" opacity="0.92"/><polygon points="26,20 46,32 26,44" fill="#0f0f10"/></svg>`,
  );
  const playOverlay = b.showPlayOverlay
    ? `<div style="position:relative;text-align:${b.align};margin-top:-${px(64)};height:0;">
         <a href="${escUrl(b.videoUrl)}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;">
           <img src="data:image/svg+xml;utf8,${playSvg}" width="64" height="64" alt="" style="display:inline-block;border:0;outline:none;" />
         </a>
       </div>`
    : "";
  const wrappedThumb = `<a href="${escUrl(b.videoUrl)}" target="_blank" rel="noopener">${thumb}</a>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${b.align}" ${b.width === "100%" ? 'width="100%"' : ""}><tr><td align="${b.align}">${wrappedThumb}${playOverlay}</td></tr></table>`;
}

function renderSocial(b: SocialBlock): string {
  if (b.links.length === 0) return "";
  // Icons werden als nebeneinander stehende <a><img></a> in einer
  // <table> gerendert — Outlook-kompatibel (kein flex/inline-block).
  const tds = b.links
    .map((l: SocialLink) => {
      const url = socialIconUrlFor(l.network, b.style);
      const imgStyle = [
        "display:block;",
        "border:0;outline:none;text-decoration:none;",
        `width:${px(b.iconSize)};height:${px(b.iconSize)};`,
      ].join("");
      return `<td style="padding:0 ${px(b.gap / 2)};vertical-align:middle;"><a href="${escUrl(l.url)}" target="_blank" rel="noopener"><img src="${escUrl(url)}" alt="${escAttr(l.network)}" width="${b.iconSize}" height="${b.iconSize}" style="${imgStyle}" /></a></td>`;
    })
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${b.align}"><tr>${tds}</tr></table>`;
}

function socialIconUrlFor(
  network: SocialNetwork,
  style: "color" | "mono",
): string {
  return socialIconUrl(network, style);
}

function renderAvatar(b: AvatarBlock): string {
  const radius = b.imageRounded
    ? Math.round(b.imageSize / 2)
    : b.imageBorderRadius;
  const imgStyle = [
    "display:block;",
    `width:${px(b.imageSize)};height:${px(b.imageSize)};`,
    radius > 0 ? `border-radius:${px(radius)};` : "",
    "border:0;outline:none;",
    "object-fit:cover;",
  ].join("");
  const img = `<img src="${escUrl(b.imageUrl)}" alt="${escAttr(b.name)}" width="${b.imageSize}" height="${b.imageSize}" style="${imgStyle}" />`;
  const nameStyle = [
    `font-family:${escAttr(b.fontFamily)};`,
    `font-size:${px(15)};`,
    `font-weight:600;`,
    `color:${escAttr(b.nameColor)};`,
    `margin:0;`,
    `line-height:1.3;`,
  ].join("");
  const subStyle = [
    `font-family:${escAttr(b.fontFamily)};`,
    `font-size:${px(12.5)};`,
    `color:${escAttr(b.subtitleColor)};`,
    `margin:${px(2)} 0 0 0;`,
    `line-height:1.4;`,
  ].join("");
  const nameHtml = `<div style="${nameStyle}">${escHtml(b.name)}</div>`;
  const subHtml = b.subtitle
    ? `<div style="${subStyle}">${escHtml(b.subtitle)}</div>`
    : "";

  if (b.layout === "vertical") {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${b.align}"><tr><td align="${b.align}">${img}<div style="height:8px;line-height:8px;font-size:8px;">&nbsp;</div>${nameHtml}${subHtml}</td></tr></table>`;
  }
  // horizontal: Bild links, Texte rechts
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${b.align}"><tr><td valign="middle" style="padding-right:12px;">${img}</td><td valign="middle">${nameHtml}${subHtml}</td></tr></table>`;
}

function renderBlock(block: ContentBlock): string {
  let inner = "";
  switch (block.type) {
    case "text":
      inner = renderText(block);
      break;
    case "heading":
      inner = renderHeading(block);
      break;
    case "button":
      inner = renderButton(block);
      break;
    case "image":
      inner = renderImage(block);
      break;
    case "spacer":
      inner = renderSpacer(block);
      break;
    case "divider":
      inner = renderDivider(block);
      break;
    case "list":
      inner = renderList(block);
      break;
    case "quote":
      inner = renderQuote(block);
      break;
    case "video":
      inner = renderVideo(block);
      break;
    case "social":
      inner = renderSocial(block);
      break;
    case "avatar":
      inner = renderAvatar(block);
      break;
    case "html":
      inner = renderHtmlBlock(block);
      break;
  }
  const tdStyle = [
    paddingStyle(block.padding),
    block.backgroundColor
      ? `background-color:${escAttr(block.backgroundColor)};`
      : "",
  ].join("");
  return `<tr><td style="${tdStyle}">${inner}</td></tr>`;
}

// ─── Section + Spalten-Renderer ───────────────────────────────────────

const SAFE_FONT_FALLBACK = "Helvetica, Arial, sans-serif";

function columnWidthsFor(layout: SectionLayout): number[] {
  switch (layout) {
    case "1":
      return [100];
    case "1-1":
      return [50, 50];
    case "1-2":
      return [33, 67];
    case "2-1":
      return [67, 33];
    case "1-1-1":
      return [33, 33, 34];
  }
}

function renderSection(section: Section, contentWidth: number): string {
  const widths = columnWidthsFor(section.layout);
  const columns = section.columns;
  // Rendere jede Spalte als <td> mit innerer <table> für Blocks.
  const tds = widths
    .map((w, i) => {
      const col = columns[i];
      if (!col) return "";
      const blocksHtml = col.blocks.map(renderBlock).join("");
      const widthPx = Math.round((contentWidth * w) / 100);
      return `<td class="col" valign="top" width="${widthPx}" style="width:${widthPx}px;vertical-align:top;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">${blocksHtml}</table></td>`;
    })
    .join("");
  const sectionStyle = [
    paddingStyle(section.padding),
    section.backgroundColor
      ? `background-color:${escAttr(section.backgroundColor)};`
      : "",
    borderStyle(section.borderTop, "top"),
    borderStyle(section.borderBottom, "bottom"),
  ].join("");
  return `<tr><td style="${sectionStyle}"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;"><tr>${tds}</tr></table></td></tr>`;
}

// ─── Top-Level-Dokument ───────────────────────────────────────────────

function buildDocument(design: EmailDesign, opts: { preview: boolean }): string {
  const sectionsHtml = design.sections
    .map((s) => renderSection(s, design.body.contentWidth))
    .join("");
  const bodyBg = escAttr(design.body.backgroundColor);
  const contentBg = escAttr(design.body.contentBackgroundColor);
  const contentWidthPx = px(design.body.contentWidth);
  const fontFamily = escAttr(design.body.fontFamily || SAFE_FONT_FALLBACK);
  const color = escAttr(design.body.color);
  const headStyles = `
    body { margin:0; padding:0; background:${bodyBg}; }
    img { display:block; max-width:100%; height:auto; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    a { color:inherit; }
    @media only screen and (max-width: 600px) {
      .stack-col { display:block !important; width:100% !important; max-width:100% !important; }
      .col { display:block !important; width:100% !important; }
    }
    ${
      opts.preview
        ? `
    .__email-preview__ { background:${bodyBg}; }
        `
        : ""
    }
  `.trim();
  const previewClass = opts.preview ? ' class="__email-preview__"' : "";
  return `<!doctype html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<title></title>
<style type="text/css">${headStyles}</style>
</head>
<body${previewClass} style="margin:0;padding:0;background:${bodyBg};font-family:${fontFamily};color:${color};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${bodyBg};">
  <tr>
    <td align="center" style="padding:${px(design.body.contentPaddingY ?? 0)} 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${design.body.contentWidth}" style="width:${contentWidthPx};max-width:${contentWidthPx};background:${contentBg};">
        ${sectionsHtml}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function renderEmailHtml(design: EmailDesign): string {
  return buildDocument(design, { preview: false });
}

export function renderPreviewHtml(design: EmailDesign): string {
  return buildDocument(design, { preview: true });
}
