/**
 * Leerer Cheerio-Stub für Browser-Builds.
 *
 * `mjml-browser` zieht cheerio als CommonJS-External rein (Build-Tooling
 * lässt einen toten Code-Pfad stehen, der zur Laufzeit nicht erreicht wird).
 * Vite würde sonst beim Bundling versuchen, cheerio aufzulösen — was
 * scheitert (Node-only) oder Sicherheits-Warnings produziert.
 *
 * Wir aliassen `cheerio` daher auf dieses Stub. Falls etwas zur Laufzeit
 * doch eine Cheerio-Funktion aufruft, wirft `load()` einen klaren Fehler.
 */

export function load(): never {
  throw new Error(
    "cheerio.load() ist im Browser-Bundle nicht verfügbar. Wenn du diesen Fehler siehst, hat eine Library versucht, Cheerio im Browser zu nutzen.",
  );
}

export default { load };
