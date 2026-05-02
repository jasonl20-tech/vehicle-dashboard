/**
 * Frontend-Typen + API-Pfad für die `google_image_search`-Settings.
 *
 * Liefert ein Template für die Suchanfrage; das Frontend ersetzt darin
 * `{{platzhalter}}`-Tokens und öffnet `https://google.com/search?tbm=isch&q=…`
 * in einem neuen Tab.
 */

export const GOOGLE_IMAGE_SEARCH_SETTINGS_PATH =
  "/api/configs/google-image-search";

export type GoogleImageSearchApiResponse = {
  template: string;
  _meta?: { source: "database" | "default"; configsBound: boolean };
};

/**
 * Akzeptierte Token-Variablen (case-insensitive). Werte sollten bereits
 * als String vorbereitet sein; leere/undefined Felder werden durch leere
 * Strings ersetzt und im Resultat zu einem einfachen `\s+` zusammengefasst.
 */
export type GoogleImageSearchVars = {
  marke?: string | null;
  /** sowohl `model` als auch `modell` werden ersetzt. */
  modell?: string | null;
  jahr?: string | number | null;
  body?: string | null;
  trim?: string | null;
  farbe?: string | null;
  ansicht?: string | null;
};

function asStr(v: string | number | null | undefined): string {
  if (v == null) return "";
  return String(v).trim();
}

/**
 * Ersetzt `{{key}}`-Platzhalter im Template, kollabiert anschließend
 * mehrfache Whitespaces und liefert die fertige Suchanfrage zurück. Bei
 * leerem Template wird `null` geliefert (keine sinnvolle Suche möglich).
 */
export function buildGoogleImageSearchQuery(
  template: string | null | undefined,
  vars: GoogleImageSearchVars,
): string | null {
  const tpl = (template ?? "").trim();
  if (!tpl) return null;

  const map: Record<string, string> = {
    marke: asStr(vars.marke),
    model: asStr(vars.modell),
    modell: asStr(vars.modell),
    jahr: asStr(vars.jahr),
    body: asStr(vars.body),
    trim: asStr(vars.trim),
    farbe: asStr(vars.farbe),
    ansicht: asStr(vars.ansicht),
  };

  const replaced = tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name) => {
    const key = String(name).toLowerCase();
    return key in map ? map[key] : "";
  });

  const collapsed = replaced.replace(/\s+/g, " ").trim();
  return collapsed.length > 0 ? collapsed : null;
}

/** Erzeugt aus einer Suchanfrage die Google-Bildersuche-URL. */
export function googleImageSearchUrl(query: string): string {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}
