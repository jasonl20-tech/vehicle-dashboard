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
  ButtonBlock,
  ContentBlock,
  DividerBlock,
  EmailDesign,
  HeadingBlock,
  HtmlBlock,
  ImageBlock,
  Padding,
  Section,
  SectionLayout,
  SpacerBlock,
  TextBlock,
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
  // Bulletproof Button: <table align=…>+ <a> mit explizitem Padding.
  // Outlook 2007–2019 ignoriert padding auf <a>, daher VML-Fallback.
  const tdStyle = [
    `background-color:${escAttr(b.backgroundColor)};`,
    `border-radius:${px(b.borderRadius)};`,
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
    `border:0;`,
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
    <td align="center" style="padding:0;">
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
