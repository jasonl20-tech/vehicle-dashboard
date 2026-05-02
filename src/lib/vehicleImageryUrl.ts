import type { VehicleImageryRowLike } from "./vehicleImageryPublicApi";

/** Dateiendung aus dem DB-Feld `format` (jpg, png, …); Standard `png`. */
function fileExtFromRowFormat(format: string | null | undefined): string {
  const f = (format ?? "").trim().toLowerCase().replace(/^\./, "");
  if (!f) return "png";
  return f;
}

/**
 * Dateiname wie im CDN-Pfad (`buildVehicleImageUrl`): vollständiger
 * `view_token` inkl. `#…`, z. B. `front#skaliert_weiß.png`.
 */
export function viewTokenImageFileName(
  viewToken: string,
  format: string | null | undefined,
): string {
  const ext = fileExtFromRowFormat(format);
  const view = (viewToken ?? "").trim();
  if (!view) return `.${ext}`;
  return `${view}.${ext}`;
}

/**
 * Letztes Segment: `{view}.{format}` (z. B. `left.png`), danach `?key=…`.
 * `/v1/{format}/{resolution}/marke/…/farbe/left.png?key=…`
 */
export function buildVehicleImageUrl(
  cdnBase: string,
  row: VehicleImageryRowLike,
  viewToken: string,
  imageUrlQuery = "",
): string {
  const b = cdnBase.replace(/\/$/, "");
  const seg = (s: string | number | null | undefined) =>
    encodeURIComponent(String(s ?? "").trim());
  const view = (viewToken ?? "").trim();
  const q = (imageUrlQuery ?? "").trim();
  if (!view) {
    return b + q;
  }
  const ext = fileExtFromRowFormat(row.format);
  const fileName = `${view}.${ext}`;
  const path = `${b}/v1/${seg(row.format)}/${seg(row.resolution)}/${seg(row.marke)}/${seg(row.modell)}/${seg(row.jahr)}/${seg(row.body)}/${seg(row.trim)}/${seg(row.farbe)}/${encodeURIComponent(fileName)}`;
  return path + q;
}

/** `views` aus der DB: getrennt durch `;` */
export function parseViewTokens(views: string | null | undefined): string[] {
  if (!views?.trim()) return [];
  return views
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Dateiname-Basis ohne Modifier nach `#` (z. B. `right` aus `right#trp`). */
export function viewPathSlug(raw: string): string {
  const t = (raw ?? "").trim();
  const i = t.indexOf("#");
  return (i === -1 ? t : t.slice(0, i)).trim() || t;
}

/** Eine gespeicherte View-Zeichenkette (z. B. `rear_left#trp`) für die UI. */
export function parseViewSlot(raw: string): {
  raw: string;
  slug: string;
  /** Modifier `trp` (Transparenz). */
  hasTransparencyHint: boolean;
  /** Modifier enthält `skaliert` (z. B. `#skaliert`, `#skaliert_weiß`). */
  hasScalingHint: boolean;
  /** Modifier `shadow` / Schatten-Variante. */
  hasShadowHint: boolean;
} {
  const t = (raw ?? "").trim();
  const i = t.indexOf("#");
  if (i === -1) {
    return {
      raw: t,
      slug: t,
      hasTransparencyHint: false,
      hasScalingHint: false,
      hasShadowHint: false,
    };
  }
  const slug = t.slice(0, i).trim();
  const mods = t.slice(i + 1).trim().toLowerCase();
  return {
    raw: t,
    slug: slug || t,
    hasTransparencyHint: mods.includes("trp"),
    hasScalingHint: mods.includes("skaliert"),
    hasShadowHint: mods.includes("shadow"),
  };
}

/**
 * Im Skalierungs-Modus zählen und anzeigen wir nur Views, deren Modifier
 * nach `#` exakt `skaliert` oder `skaliert_weiß` ist (nicht z. B. `#skaliert_foo`).
 */
export function isScalingControlViewToken(raw: string): boolean {
  const t = (raw ?? "").trim();
  const i = t.indexOf("#");
  if (i === -1) return false;
  const mod = t.slice(i + 1).trim().toLowerCase();
  return mod === "skaliert" || mod === "skaliert_weiß";
}
