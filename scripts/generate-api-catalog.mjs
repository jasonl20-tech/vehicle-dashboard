/**
 * Scannt alle functions/api (rekursiv, .ts) und erzeugt apiCatalog.generated.ts
 * (Routen, HTTP-Methoden, Kurzbeschreibung aus JSDoc + manuelle Ergänzungen).
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

/**
 * Manuelle deutsche Beschreibungen (überschreiben Extrakt aus dem Quellcode).
 * Key = Pfad relativ zum Repo-Root, z. B. functions/api/me.ts
 */
const MANUAL_DESCRIPTIONS = {
  "functions/api/login.ts":
    "Anmeldung mit Benutzername und Passwort. Setzt bei Erfolg das Session-Cookie, oder liefert Hinweise auf ausstehendes TOTP, Passwort-Erstsetup oder Fehler.",
  "functions/api/login-totp.ts":
    "Zweiter Login-Schritt nach TOTP: verifiziert Einmalcode und mfaPendingToken und stellt bei Erfolg die Session ein.",
  "functions/api/logout.ts":
    "Beendet die Sitzung: Session-Cookie wird gelöscht (leerer Wert, abgelaufen).",
  "functions/api/me.ts":
    "Liefert den aktuellen Benutzer (Profilfelder) und die Liste erlaubter SPA-Pfade (`erlaubtePfade`) für die Sicherheitsstufe.",
  "functions/api/mfa/status.ts":
    "Liefert den 2FA-Status des Kontos (TOTP aktiv, Secret vorhanden, Verifizierung, ob Admin 2FA erzwingt).",
  "functions/api/mfa/enroll-start.ts":
    "Startet TOTP-Einrichtung: erzeugt Secret, speichert es vorläufig und liefert Daten für den Authenticator (otpauth-URI).",
  "functions/api/mfa/enroll-confirm.ts":
    "Bestätigt TOTP-Einrichtung: prüft den 6-stelligen Code und aktiviert Zwei-Faktor für das Konto.",
  "functions/api/mfa/disable.ts":
    "Deaktiviert TOTP nach Passwortprüfung (nicht erlaubt, wenn das Konto 2FA verpflichtend hat).",
  "functions/api/analytics/customer-keys.ts":
    "Analytics-Auswertungen zur Kunden-API über Analytics Engine: Parameter kind (z. B. overview, Zeitreihen, Top-Listen, key-detail) und mode customers/oneauto, plus Zeitraum- und Key-Filter.",
};

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

function cleanJsDocBody(raw) {
  return raw
    .replace(/^\s*\* ?/gm, " ")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreBlock(c) {
  if (/\/api\//i.test(c)) return 4;
  if (/\b(GET|POST|PUT|PATCH|DELETE)\s+\//i.test(c)) return 3;
  if (c.length >= 150) return 2;
  if (c.length >= 80) return 1;
  return 0;
}

function extractDescriptionFromComments(fileContent) {
  const re = /\/\*\*([\s\S]*?)\*\//g;
  /** @type {{ c: string; sc: number }[]} */
  const blocks = [];
  let m;
  while ((m = re.exec(fileContent)) !== null) {
    const c = cleanJsDocBody(m[1]);
    if (c.length < 20) continue;
    const sc = scoreBlock(c);
    if (sc === 0 && c.length < 55) continue;
    blocks.push({ c, sc });
  }
  blocks.sort((a, b) => b.sc - a.sc || b.c.length - a.c.length);
  const parts = [];
  const seen = new Set();
  for (const { c } of blocks) {
    if (seen.has(c)) continue;
    let skip = false;
    for (const p of parts) {
      if (p.length >= c.length * 1.2 && p.includes(c)) {
        skip = true;
        break;
      }
    }
    if (skip) continue;
    seen.add(c);
    parts.push(c);
    if (parts.join(" ").length > 480) break;
  }
  return parts.join(" ").slice(0, 520).trim();
}

function resolveDescription(source, fileContent) {
  if (MANUAL_DESCRIPTIONS[source]) return MANUAL_DESCRIPTIONS[source];
  const extracted = extractDescriptionFromComments(fileContent);
  return extracted || "—";
}

function main() {
  const files = walkTsFiles(API_DIR).sort();
  /** @type {{ path: string; methods: string[]; source: string; description: string }[]} */
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
    const source = `functions/api/${rel.replace(/\\/g, "/")}`;
    entries.push({
      path: filePathToUrlPath(rel),
      methods,
      source,
      description: resolveDescription(source, text),
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
    "export type ApiCatalogEntry = {",
    "  /** Vollständiger Pfad inkl. /api",
    "   * Dynamische Segmente: :param (aus [param] im Dateisystem).",
    "   */",
    "  path: string;",
    "  methods: readonly string[];",
    "  /** Quelldatei relativ zum Repo-Root */",
    "  source: string;",
    "  /** Kurzbeschreibung (Deutsch), aus JSDoc und/oder manueller Tabelle */",
    "  description: string;",
    "};",
    "",
    `export const API_CATALOG_GENERATED_AT = ${JSON.stringify(iso)} as const;`,
    "",
    "export const API_CATALOG: readonly ApiCatalogEntry[] = [",
  ];

  for (const e of entries) {
    const meth = e.methods.map((x) => JSON.stringify(x)).join(", ");
    lines.push(
      `  { path: ${JSON.stringify(e.path)}, methods: [${meth}], source: ${JSON.stringify(e.source)}, description: ${JSON.stringify(e.description)} },`,
    );
  }
  lines.push("];", "");
  fs.writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log(
    `[generate-api-catalog] ${entries.length} Einträge → ${path.relative(ROOT, OUT)}`,
  );
}

main();
