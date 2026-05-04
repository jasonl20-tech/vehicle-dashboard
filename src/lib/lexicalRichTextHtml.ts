/**
 * Lexical Rich-Text → sicheres HTML für Produktion (SSR/SSG, ohne Lexical-Runtime).
 * Unterstützt dieselben Kernknoten wie der CMS-Editor inkl. `cms-image` / `cms-hr`.
 */

import { EMPTY_LEXICAL_STATE_JSON, isLexicalSerializedJson } from "./lexicalRichText";

const IS_BOLD = 1;
const IS_ITALIC = 2;
const IS_STRIKETHROUGH = 4;
const IS_UNDERLINE = 8;
const IS_CODE = 16;
const IS_SUBSCRIPT = 32;
const IS_SUPERSCRIPT = 64;

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Nur http(s), mailto oder relative Pfade — kein javascript:/data:. */
export function safeHref(href: string): string | null {
  const t = href.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) return null;
  if (t.startsWith("/") && !t.startsWith("//")) return t;
  try {
    const u = new URL(t);
    if (
      u.protocol === "http:" ||
      u.protocol === "https:" ||
      u.protocol === "mailto:"
    ) {
      return t;
    }
  } catch {
    return null;
  }
  return null;
}

export function safeImgSrc(src: string): string | null {
  const t = src.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol === "https:" || u.protocol === "http:") return t;
  } catch {
    return null;
  }
  return null;
}

function applyTextFormats(escapedText: string, format: number): string {
  let s = escapedText;
  if (format & IS_CODE) s = `<code>${s}</code>`;
  if (format & IS_BOLD) s = `<strong>${s}</strong>`;
  if (format & IS_ITALIC) s = `<em>${s}</em>`;
  if (format & IS_UNDERLINE) s = `<u>${s}</u>`;
  if (format & IS_STRIKETHROUGH) s = `<s>${s}</s>`;
  if (format & IS_SUBSCRIPT) s = `<sub>${s}</sub>`;
  if (format & IS_SUPERSCRIPT) s = `<sup>${s}</sup>`;
  return s;
}

function lexicalNodeToHtml(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  const t = n.type;

  if (t === "text") {
    const text = typeof n.text === "string" ? n.text : "";
    const fmt = typeof n.format === "number" ? n.format : 0;
    return applyTextFormats(escapeHtml(text), fmt);
  }

  if (t === "linebreak") return "<br>\n";
  if (t === "tab") return " ";

  if (t === "paragraph") {
    const inner = childrenHtml(n.children);
    return `<p>${inner || ""}</p>\n`;
  }

  if (t === "heading") {
    const tag =
      typeof n.tag === "string" && /^h[1-6]$/.test(n.tag) ? n.tag : "h2";
    const inner = childrenHtml(n.children);
    return `<${tag}>${inner}</${tag}>\n`;
  }

  if (t === "quote") {
    const inner = childrenHtml(n.children);
    return `<blockquote>${inner}</blockquote>\n`;
  }

  if (t === "list") {
    const listType = n.listType === "number" ? "number" : "bullet";
    const Tag = listType === "number" ? "ol" : "ul";
    const inner = childrenHtml(n.children);
    return `<${Tag}>${inner}</${Tag}>\n`;
  }

  if (t === "listitem") {
    const inner = childrenHtml(n.children);
    return `<li>${inner}</li>\n`;
  }

  if (t === "link" || t === "autolink") {
    const url = typeof n.url === "string" ? n.url : "";
    const href = safeHref(url);
    if (!href) {
      return childrenHtml(n.children);
    }
    const inner = childrenHtml(n.children);
    return `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow">${inner || escapeHtml(url)}</a>`;
  }

  if (t === "horizontalrule") {
    return "<hr>\n";
  }

  if (t === "cms-hr") {
    return "<hr>\n";
  }

  if (t === "cms-image") {
    const srcRaw = typeof n.src === "string" ? n.src : "";
    const src = safeImgSrc(srcRaw);
    if (!src) return "";
    const altText =
      typeof n.altText === "string" && n.altText.trim()
        ? n.altText.trim()
        : "";
    const title =
      typeof n.title === "string" && n.title.trim() ? n.title.trim() : "";
    const imgAltAttr = altText || title;
    const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(imgAltAttr)}" loading="lazy" decoding="async">`;
    const cap = title
      ? `<figcaption>${escapeHtml(title)}</figcaption>`
      : "";
    return `<figure class="cms-rich-image">${img}${cap}</figure>\n`;
  }

  if (t === "code") {
    const inner = childrenHtml(n.children);
    return `<pre><code>${inner || ""}</code></pre>\n`;
  }

  if (t === "code-highlight") {
    return childrenHtml(n.children);
  }

  if (t === "table") {
    const inner = childrenHtml(n.children);
    return `<table>${inner}</table>\n`;
  }

  if (t === "tablerow") {
    const inner = childrenHtml(n.children);
    return `<tr>${inner}</tr>\n`;
  }

  if (t === "tablecell") {
    const headerState = typeof n.headerState === "number" ? n.headerState : 0;
    const cellTag = headerState > 0 ? "th" : "td";
    const inner = childrenHtml(n.children);
    return `<${cellTag}>${inner}</${cellTag}>\n`;
  }

  if (Array.isArray(n.children)) {
    return childrenHtml(n.children);
  }

  return "";
}

function childrenHtml(children: unknown): string {
  if (!Array.isArray(children)) return "";
  return children.map((c) => lexicalNodeToHtml(c)).join("");
}

/**Aus gespeichertem Rich-Text-Feldwert (JSON-String wie in `payload_json`) → HTML. */
export function lexicalRichTextToHtml(raw: unknown): string {
  let s =
    raw == null
      ? ""
      : typeof raw === "string"
        ? raw
        : (() => {
            try {
              return JSON.stringify(raw);
            } catch {
              return "";
            }
          })();
  s = s.trim();
  if (!s) return "";
  try {
    const o = JSON.parse(s) as { root?: unknown };
    if (o?.root) {
      const body = lexicalNodeToHtml(o.root);
      return body ? `<div class="cms-rich-text">${body}</div>` : "";
    }
  } catch {
    /* Legacy: reiner Text */
  }
  if (!isLexicalSerializedJson(s)) {
    return `<p>${escapeHtml(s)}</p>`;
  }
  return "";
}

/** Prüft, ob der String wie gespeichertes Lexical aussieht (ohne vollständiges Schema). */
export function isProbablyLexicalRichTextField(s: string): boolean {
  return isLexicalSerializedJson(s) || s === EMPTY_LEXICAL_STATE_JSON;
}
