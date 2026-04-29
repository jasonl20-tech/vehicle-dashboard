/**
 * Gemeinsame Helpers für die Asset-Manager-API.
 *
 * Konventionen:
 *  - Pfade sind POSIX-Style (`/`-getrennt), case-sensitive, ohne führenden
 *    oder schließenden Slash.
 *  - Erlaubte Zeichen in Path-Segmenten: `[a-zA-Z0-9._-]`. Leerzeichen
 *    werden bei Bedarf vom Frontend zu `-` konvertiert.
 *  - Ordnernamen entsprechen der Pfad-Segmentierung; `email/team` ist
 *    der Ordner `team` innerhalb von `email`.
 *  - R2 hat keine echten Ordner. Wir rendern leere Ordner über einen
 *    `kind='folder'`-Eintrag in D1, der KEIN R2-Objekt referenziert.
 *
 * Limits:
 *  - Maximale Datei-Größe: 25 MB (Schutz gegen Versehen, Cloudflare
 *    Workers haben 100 MB Body-Limit, R2 selbst kann TB).
 *  - Maximale Pfadlänge: 1024 Zeichen.
 */
import { jsonResponse, type AuthEnv } from "./auth";

export const ASSETS_DEFAULT_PUBLIC_BASE = "https://assets.vehicleimagery.com";

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_PATH_LEN = 1024;
/** Schwarzliste: Marker-Dateien, die intern verwendet werden und in der
 *  UI nicht als echte Datei zählen sollen. */
export const HIDDEN_NAMES = new Set<string>([".keep", ".placeholder"]);

const SEGMENT_RE = /^[a-zA-Z0-9._-]+$/;

/**
 * Bereinigt einen Folder-Pfad (`email/team` → `email/team`,
 * `/email/` → `email`, `..` → fehler). Ungültige Pfade werfen.
 */
export function normalizeFolder(input: unknown): string {
  if (input == null) return "";
  if (typeof input !== "string") {
    throw new Error("folder muss ein String sein");
  }
  let s = input.trim();
  if (!s) return "";
  // Slashes vorne/hinten entfernen.
  s = s.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!s) return "";
  if (s.length > MAX_PATH_LEN) {
    throw new Error("folder zu lang");
  }
  const segs = s.split("/");
  for (const seg of segs) {
    if (!seg || seg === "." || seg === "..") {
      throw new Error("folder enthält ungültige Segmente");
    }
    if (!SEGMENT_RE.test(seg)) {
      throw new Error(
        `folder-Segment "${seg}" enthält ungültige Zeichen (erlaubt: a-z A-Z 0-9 . _ -)`,
      );
    }
  }
  return segs.join("/");
}

/**
 * Bereinigt einen Dateinamen (kein Pfad-Separator erlaubt). Erlaubt
 * sind a–z, A–Z, 0–9 sowie `.`, `_`, `-`. Maximal 200 Zeichen.
 */
export function normalizeName(input: unknown): string {
  if (typeof input !== "string") {
    throw new Error("name muss ein String sein");
  }
  let s = input.trim();
  if (!s) throw new Error("name darf nicht leer sein");
  // Umlaute / Sonderzeichen → ASCII-tauglich
  s = s
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  s = s.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (!s) throw new Error("name leer nach Bereinigung");
  if (s.length > 200) throw new Error("name zu lang (max. 200)");
  if (!SEGMENT_RE.test(s)) throw new Error("name ungültig");
  return s;
}

/**
 * Setzt Folder + Name zum vollständigen R2-Key zusammen.
 */
export function joinKey(folder: string, name: string): string {
  if (!folder) return name;
  return `${folder}/${name}`;
}

/**
 * Trennt einen Key in Folder + Name.
 */
export function splitKey(key: string): { folder: string; name: string } {
  const idx = key.lastIndexOf("/");
  if (idx < 0) return { folder: "", name: key };
  return { folder: key.slice(0, idx), name: key.slice(idx + 1) };
}

/**
 * Liefert die öffentliche URL für ein Asset (Custom-Domain auf R2).
 * Encoding: Slashes bleiben, sonstige Zeichen werden encodeURI-Style
 * geescaped. So bleiben `email/banner.png`-Pfade lesbar.
 */
export function publicUrl(env: AuthEnv, key: string): string {
  const base = (env.ASSETS_PUBLIC_BASE || ASSETS_DEFAULT_PUBLIC_BASE).replace(
    /\/+$/,
    "",
  );
  const safeKey = key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/${safeKey}`;
}

/**
 * Stellt sicher, dass beide Bindings (D1 + R2) gesetzt sind.
 * Liefert `Response` zurück, wenn etwas fehlt — sonst `null`.
 */
export function requireBindings(env: AuthEnv): Response | null {
  if (!env.website) {
    return jsonResponse(
      {
        error:
          "D1-Binding `website` fehlt. Im Cloudflare-Dashboard → Functions → D1, Variable `website` (env.website) setzen.",
      },
      { status: 503 },
    );
  }
  if (!env.assets) {
    return jsonResponse(
      {
        error:
          "R2-Binding `assets` fehlt. Im Cloudflare-Dashboard → Functions → R2, Variable `assets` (env.assets) setzen.",
      },
      { status: 503 },
    );
  }
  return null;
}

export function tableMissingHint(e: unknown): string | null {
  const msg = (e as Error)?.message || String(e);
  if (/no such table/i.test(msg) && /assets/i.test(msg)) {
    return "Tabelle `assets` fehlt. Migration ausführen: `wrangler d1 execute <DB-NAME> --file=./d1/migrations/0008_assets.sql`.";
  }
  if (/no such column/i.test(msg)) {
    return "Tabellenspalte fehlt — bitte Migration 0008_assets.sql erneut ausführen.";
  }
  return null;
}

/**
 * Datentyp, der pro Asset im API-JSON zurückgegeben wird (Frontend-
 * Compatibility). `url` ist die öffentliche URL aus dem Public-Bucket.
 */
export type AssetRow = {
  id: number;
  key: string;
  folder: string;
  name: string;
  size: number;
  content_type: string;
  kind: "file" | "folder";
  alt_text: string | null;
  description: string | null;
  uploaded_by: number | null;
  uploaded_at: string;
  updated_at: string;
  url: string;
};

export function rowToAsset(env: AuthEnv, r: Omit<AssetRow, "url">): AssetRow {
  return { ...r, url: publicUrl(env, r.key) };
}
