/**
 * Helpers für die Asset-Manager-API. Dateien liegen im R2-Bucket
 * `env.assets` (Custom-Domain `assets.vehicleimagery.com`).
 * Redaktionelle CMS-Felder (Titel, Beschreibung, Alt, Status, …) werden
 * zusätzlich in D1 (`cms_assets`, siehe `cmsAssetsDb.ts`) gespeichert und
 * in der API mit R2-Metadaten zusammengeführt (D1 gewinnt, wenn vorhanden).
 *
 * Konventionen:
 *   - Pfade sind POSIX (`/`-getrennt), case-sensitive, ohne führenden
 *     oder schließenden Slash.
 *   - Erlaubte Zeichen pro Path-Segment: `[a-zA-Z0-9._-]`. Leerzeichen
 *     werden in `normalizeName` zu `-` reduziert.
 *   - Ein Folder existiert genau dann, wenn mindestens ein R2-Objekt
 *     mit dem entsprechenden Prefix vorliegt. Leere Folders bekommen
 *     einen Marker `<folder>/.keep` (0 Bytes), den die Listing-API
 *     beim Anzeigen filtert.
 *   - Datei-Metadaten (`alt_text`, `description`, `uploadedBy`) leben in
 *     `customMetadata` des R2-Objekts (URI-encoded, da R2 die Werte
 *     in HTTP-Headern transportiert).
 *   - CMS legt Medien unter dem Prefix `cms/` ab (siehe `CMS_ASSETS_FOLDER`
 *     im Frontend / Medien-Bereich der Konsole).
 */
import { jsonResponse, type AuthEnv } from "./auth";

export const ASSETS_DEFAULT_PUBLIC_BASE = "https://assets.vehicleimagery.com";

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_PATH_LEN = 1024;

/** Marker-Dateien, die intern verwendet und in der UI ausgeblendet
 *  werden. */
export const HIDDEN_NAMES: ReadonlySet<string> = new Set<string>([
  ".keep",
  ".placeholder",
]);
/** Marker-Dateiname, der angelegt wird, wenn ein leerer Ordner via UI
 *  erstellt wird. */
export const FOLDER_MARKER = ".keep";

const SEGMENT_RE = /^[a-zA-Z0-9._-]+$/;

// ─── Path-Validation ─────────────────────────────────────────────────

export function normalizeFolder(input: unknown): string {
  if (input == null) return "";
  if (typeof input !== "string") {
    throw new Error("folder muss ein String sein");
  }
  let s = input.trim();
  if (!s) return "";
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

export function normalizeName(input: unknown): string {
  if (typeof input !== "string") {
    throw new Error("name muss ein String sein");
  }
  let s = input.trim();
  if (!s) throw new Error("name darf nicht leer sein");
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

export function joinKey(folder: string, name: string): string {
  if (!folder) return name;
  return `${folder}/${name}`;
}

export function splitKey(key: string): { folder: string; name: string } {
  const idx = key.lastIndexOf("/");
  if (idx < 0) return { folder: "", name: key };
  return { folder: key.slice(0, idx), name: key.slice(idx + 1) };
}

export function isHidden(name: string): boolean {
  return HIDDEN_NAMES.has(name);
}

// ─── Public-URL ──────────────────────────────────────────────────────

export function publicBase(env: AuthEnv): string {
  return (env.ASSETS_PUBLIC_BASE || ASSETS_DEFAULT_PUBLIC_BASE).replace(
    /\/+$/,
    "",
  );
}

export function publicUrl(env: AuthEnv, key: string): string {
  const safeKey = key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${publicBase(env)}/${safeKey}`;
}

// ─── Bindings-Check ──────────────────────────────────────────────────

export function requireAssetsBucket(env: AuthEnv): R2Bucket | Response {
  if (!env.assets) {
    return jsonResponse(
      {
        error:
          "R2-Binding `assets` fehlt. Im Cloudflare-Dashboard → Functions → R2, Variable `assets` (env.assets) auf den Bucket setzen.",
      },
      { status: 503 },
    );
  }
  return env.assets;
}

// ─── customMetadata-Helpers ──────────────────────────────────────────
// R2 transportiert customMetadata in HTTP-Headern (S3-kompatibel).
// Damit Umlaute/Sonderzeichen verlustfrei round-trippen, encoden wir
// nicht-ASCII-Werte per `encodeURIComponent`. Beim Lesen wird umgekehrt
// `decodeURIComponent` angewendet.

const META_KEYS = {
  title: "title",
  altText: "alttext",
  description: "description",
  uploadedBy: "uploadedby",
  /** Anzeigename zum Zeitpunkt des Uploads (z. B. Benutzername). */
  uploaderName: "uploadername",
  originalName: "originalname",
  folderMarker: "foldermarker",
  /** CMS-Workflow: `draft` | `published` */
  cmsStatus: "cmsstatus",
  /** Bildbreite in px (Metadata-String) */
  imgw: "imgw",
  /** Bildhöhe in px */
  imgh: "imgh",
} as const;

export type MetaInput = {
  title?: string | null;
  altText?: string | null;
  description?: string | null;
  uploadedBy?: string | number | null;
  uploadedByName?: string | null;
  /** Nur `draft` oder `published`; null löscht den Schlüssel beim Merge. */
  cmsStatus?: "draft" | "published" | null;
  imgWidth?: number | null;
  imgHeight?: number | null;
  originalName?: string | null;
  folderMarker?: boolean;
};

function isAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0x7e) return false;
  }
  return true;
}

function encodeMetaValue(v: string): string {
  if (isAscii(v)) return v;
  return `enc:${encodeURIComponent(v)}`;
}

function decodeMetaValue(v: string | undefined): string | null {
  if (v == null || v === "") return null;
  if (v.startsWith("enc:")) {
    try {
      return decodeURIComponent(v.slice(4));
    } catch {
      return v.slice(4);
    }
  }
  return v;
}

/** CMS-Asset-Status aus R2-Metadata; fehlend/ungültig → veröffentlicht (R2-Objekt ist öffentlich erreichbar). */
export function normalizeCmsAssetStatus(raw: string | undefined): "draft" | "published" {
  if ((raw || "").toLowerCase() === "draft") return "draft";
  return "published";
}

export function buildCustomMetadata(
  input: MetaInput,
  base?: Record<string, string>,
): Record<string, string> {
  const m: Record<string, string> = { ...(base ?? {}) };
  if (input.title !== undefined) {
    if (input.title) m[META_KEYS.title] = encodeMetaValue(input.title);
    else delete m[META_KEYS.title];
  }
  if (input.altText !== undefined) {
    if (input.altText) m[META_KEYS.altText] = encodeMetaValue(input.altText);
    else delete m[META_KEYS.altText];
  }
  if (input.description !== undefined) {
    if (input.description)
      m[META_KEYS.description] = encodeMetaValue(input.description);
    else delete m[META_KEYS.description];
  }
  if (input.uploadedBy !== undefined && input.uploadedBy !== null) {
    m[META_KEYS.uploadedBy] = String(input.uploadedBy);
  }
  if (input.uploadedByName !== undefined) {
    if (input.uploadedByName)
      m[META_KEYS.uploaderName] = encodeMetaValue(input.uploadedByName);
    else delete m[META_KEYS.uploaderName];
  }
  if (input.cmsStatus !== undefined) {
    if (input.cmsStatus) m[META_KEYS.cmsStatus] = input.cmsStatus;
    else delete m[META_KEYS.cmsStatus];
  }
  if (input.imgWidth !== undefined) {
    if (input.imgWidth != null && input.imgWidth > 0)
      m[META_KEYS.imgw] = String(Math.round(input.imgWidth));
    else delete m[META_KEYS.imgw];
  }
  if (input.imgHeight !== undefined) {
    if (input.imgHeight != null && input.imgHeight > 0)
      m[META_KEYS.imgh] = String(Math.round(input.imgHeight));
    else delete m[META_KEYS.imgh];
  }
  if (input.originalName !== undefined && input.originalName) {
    m[META_KEYS.originalName] = encodeMetaValue(
      input.originalName.slice(0, 255),
    );
  }
  if (input.folderMarker) {
    m[META_KEYS.folderMarker] = "1";
  }
  return m;
}

// ─── Content-Type-Erkennung ───────────────────────────────────────────
// R2-Objekte, die ohne explizite httpMetadata hochgeladen wurden (z. B.
// direkt aus dem Cloudflare-Dashboard oder via wrangler), kommen oft
// als `application/octet-stream` zurück. Wir leiten in dem Fall den
// Content-Type aus der Dateiendung ab, damit Bild-Previews und Filter
// (`isImage`) auch für Legacy-Uploads funktionieren.

const EXT_TO_TYPE: Record<string, string> = {
  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  ico: "image/x-icon",
  heic: "image/heic",
  heif: "image/heif",
  tif: "image/tiff",
  tiff: "image/tiff",
  // Videos
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  // Audio
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  // Docs
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  htm: "text/html",
  // Archive
  zip: "application/zip",
  gz: "application/gzip",
  // Fonts
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

const GENERIC_TYPES: ReadonlySet<string> = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
  "application/x-octet-stream",
]);

export function guessContentType(name: string, current?: string | null): string {
  const cur = (current || "").toLowerCase();
  if (cur && !GENERIC_TYPES.has(cur)) return current!;
  const dot = name.lastIndexOf(".");
  if (dot < 0) return current || "application/octet-stream";
  const ext = name.slice(dot + 1).toLowerCase();
  return EXT_TO_TYPE[ext] ?? current ?? "application/octet-stream";
}

// ─── Asset-Shape für die API ─────────────────────────────────────────

export type AssetRow = {
  /** Der R2-Object-Key — wird auch als ID verwendet. */
  id: string;
  key: string;
  folder: string;
  name: string;
  size: number;
  content_type: string;
  kind: "file" | "folder";
  alt_text: string | null;
  /** Anzeige-Titel (CMS), in R2 customMetadata. */
  title: string | null;
  description: string | null;
  uploaded_by: string | null;
  /** Benutzername o. ä. zum Zeitpunkt des Uploads (Metadata). */
  uploaded_by_name: string | null;
  /** Redaktioneller Status im CMS (nicht CDN-Sichtbarkeit). */
  cms_status: "draft" | "published";
  /** Bildabmessungen aus Metadata, falls erfasst. */
  width: number | null;
  height: number | null;
  uploaded_at: string;
  updated_at: string;
  /** Öffentliche URL (Custom-Domain). */
  url: string;
  /** R2-ETag (für Caching/Konflikt-Erkennung). */
  etag: string | null;
};

/**
 * Erzeugt eine Asset-Zeile aus einem R2Object. Hidden-Marker (`.keep`)
 * werden vom Aufrufer ausgefiltert.
 */
export function r2ObjectToAsset(env: AuthEnv, obj: R2Object): AssetRow {
  const { folder, name } = splitKey(obj.key);
  const meta = obj.customMetadata ?? {};
  const isFolderMarker =
    name === FOLDER_MARKER && meta[META_KEYS.folderMarker] === "1";
  // ISO-Datum
  const uploadedISO =
    obj.uploaded instanceof Date
      ? obj.uploaded.toISOString()
      : new Date(obj.uploaded).toISOString();
  // Content-Type robust herleiten — manche R2-Objekte (Direkt-Upload via
  // Cloudflare-Console, wrangler ohne -t) tragen `application/octet-stream`
  // oder gar keinen Type. Wir schließen aus der Dateiendung zurück.
  const contentType = guessContentType(name, obj.httpMetadata?.contentType);
  const wMeta = meta[META_KEYS.imgw];
  const hMeta = meta[META_KEYS.imgh];
  const w = wMeta != null ? Number.parseInt(String(wMeta), 10) : NaN;
  const h = hMeta != null ? Number.parseInt(String(hMeta), 10) : NaN;
  return {
    id: obj.key,
    key: obj.key,
    folder,
    name,
    size: obj.size,
    content_type: contentType,
    kind: isFolderMarker ? "folder" : "file",
    title: decodeMetaValue(meta[META_KEYS.title]),
    alt_text: decodeMetaValue(meta[META_KEYS.altText]),
    description: decodeMetaValue(meta[META_KEYS.description]),
    uploaded_by: meta[META_KEYS.uploadedBy] ?? null,
    uploaded_by_name: decodeMetaValue(meta[META_KEYS.uploaderName]),
    cms_status: normalizeCmsAssetStatus(meta[META_KEYS.cmsStatus]),
    width: Number.isFinite(w) && w > 0 ? w : null,
    height: Number.isFinite(h) && h > 0 ? h : null,
    uploaded_at: uploadedISO,
    updated_at: uploadedISO,
    url: publicUrl(env, obj.key),
    etag: obj.etag ?? null,
  };
}

/**
 * Erzeugt einen synthetischen "Folder"-Eintrag für die UI (z. B. wenn
 * ein Folder-Tree aus delimitedPrefixes konstruiert wird, ohne eigenes
 * R2-Object zu kennen).
 */
export function syntheticFolder(
  env: AuthEnv,
  path: string,
  uploadedAt = new Date(0).toISOString(),
): AssetRow {
  const { folder, name } = splitKey(path);
  return {
    id: path,
    key: path,
    folder,
    name,
    size: 0,
    content_type: "inode/directory",
    kind: "folder",
    title: null,
    alt_text: null,
    description: null,
    uploaded_by: null,
    uploaded_by_name: null,
    cms_status: "published",
    width: null,
    height: null,
    uploaded_at: uploadedAt,
    updated_at: uploadedAt,
    url: publicUrl(env, path),
    etag: null,
  };
}

// ─── List-Helper ─────────────────────────────────────────────────────

/**
 * Listet alle R2-Objekte unter einem Prefix (mit optionalem Delimiter)
 * über mehrere Cursor-Seiten hinweg. Limitiert auf `maxObjects`, um
 * runaway-Listings zu vermeiden.
 */
export async function listAllUnderPrefix(
  bucket: R2Bucket,
  prefix: string,
  opts: { delimiter?: string; maxObjects?: number } = {},
): Promise<{ objects: R2Object[]; delimitedPrefixes: string[] }> {
  const { delimiter, maxObjects = 5000 } = opts;
  const objects: R2Object[] = [];
  const prefixSet = new Set<string>();
  let cursor: string | undefined;
  while (true) {
    const r = await bucket.list({
      prefix,
      delimiter,
      cursor,
      limit: 1000,
    });
    objects.push(...r.objects);
    for (const p of r.delimitedPrefixes ?? []) prefixSet.add(p);
    if (objects.length >= maxObjects) break;
    if (!r.truncated) break;
    cursor = (r as R2Objects & { cursor?: string }).cursor;
    if (!cursor) break;
  }
  return { objects, delimitedPrefixes: Array.from(prefixSet) };
}
