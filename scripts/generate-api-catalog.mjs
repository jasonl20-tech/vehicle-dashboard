/**
 * Scannt alle functions/api (rekursiv, .ts) und erzeugt apiCatalog.generated.ts
 * (Routen + HTTP-Methoden aus export const onRequest*).
 *
 * Ausführen: node scripts/generate-api-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const API_DIR = path.join(ROOT, "functions", "api");
const OUT = path.join(ROOT, "src", "lib", "apiCatalog.generated.ts");

const METHOD_FROM_EXPORT = {
  onRequestGet: "GET",
  onRequestPost: "POST",
  onRequestPut: "PUT",
  onRequestPatch: "PATCH",
  onRequestDelete: "DELETE",
  onRequestOptions: "OPTIONS",
};

const METHOD_ORDER = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

function walkTsFiles(dir, relBase = "") {
  /** @type {string[]} */
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = relBase ? `${relBase}/${name.name}` : name.name;
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      out.push(...walkTsFiles(full, rel));
    } else if (
      name.isFile() &&
      name.name.endsWith(".ts") &&
      name.name !== "_middleware.ts"
    ) {
      out.push(rel);
    }
  }
  return out;
}

/** functions/api-relative path → /api/... URL */
function filePathToUrlPath(relFromApi) {
  let s = relFromApi.replace(/\\/g, "/").replace(/\.ts$/, "");
  if (s.endsWith("/index")) {
    s = s.slice(0, -"/index".length);
  }
  const segments = s.split("/").map((seg) =>
    /^\[[^/]+\]$/.test(seg) ? `:${seg.slice(1, -1)}` : seg,
  );
  return `/api/${segments.join("/")}`;
}

function stripStubExports(fileContent) {
  return fileContent.replace(
    /export const onRequest(?:Get|Post|Put|Patch|Delete|Options):\s*PagesFunction(?:<[^>]+>)?\s*=\s*async\s*\(\s*\)\s*=>\s*notAllowed\s*\(\s*\)\s*;\s*/g,
    "",
  );
}

function extractMethods(fileContent) {
  const cleaned = stripStubExports(fileContent);
  const re =
    /export const (onRequestGet|onRequestPost|onRequestPut|onRequestPatch|onRequestDelete|onRequestOptions)\b/g;
  const found = new Set();
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const key = m[1];
    const verb = METHOD_FROM_EXPORT[key];
    if (verb) found.add(verb);
  }
  return [...found].sort(
    (a, b) => METHOD_ORDER.indexOf(a) - METHOD_ORDER.indexOf(b),
  );
}

function escapeString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function main() {
  const files = walkTsFiles(API_DIR).sort();
  /** @type {{ path: string; methods: string[]; source: string }[]} */
  const entries = [];

  for (const rel of files) {
    const abs = path.join(API_DIR, rel);
    const text = fs.readFileSync(abs, "utf8");
    const methods = extractMethods(text);
    if (methods.length === 0) {
      console.warn(
        `[generate-api-catalog] keine onRequest* in functions/api/${rel} — übersprungen`,
      );
      continue;
    }
    entries.push({
      path: filePathToUrlPath(rel),
      methods,
      source: `functions/api/${rel.replace(/\\/g, "/")}`,
    });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));

  const iso = new Date().toISOString();
  const lines = [
    "/**",
    " * API-Katalog — automatisch generiert.",
    " * `node scripts/generate-api-catalog.mjs` oder `npm run generate:api-catalog`",
    " */",
    "",
    'export type ApiCatalogEntry = {',
    "  /** Vollständiger Pfad inkl. /api",
    "   * Dynamische Segmente: :param (aus [param] im Dateisystem).",
    "   */",
    "  path: string;",
    "  methods: readonly string[];",
    "  /** Quelldatei relativ zum Repo-Root */",
    "  source: string;",
    "};",
    "",
    `export const API_CATALOG_GENERATED_AT = "${escapeString(iso)}" as const;`,
    "",
    `export const API_CATALOG: readonly ApiCatalogEntry[] = [`,
  ];

  for (const e of entries) {
    const meth = e.methods.map((m) => `"${m}"`).join(", ");
    lines.push(
      `  { path: "${escapeString(e.path)}", methods: [${meth}], source: "${escapeString(e.source)}" },`,
    );
  }
  lines.push("];", "");
  fs.writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log(
    `[generate-api-catalog] ${entries.length} Einträge → ${path.relative(ROOT, OUT)}`,
  );
}

main();
