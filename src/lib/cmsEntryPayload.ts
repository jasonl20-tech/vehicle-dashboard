import type { CmsContentModelSchema, CmsFieldDefinition } from "./cmsSchemaTypes";
import { TEXT_LONG_MAX, TEXT_SHORT_MAX } from "./cmsSchemaTypes";
import {
  EMPTY_LEXICAL_STATE_JSON,
  richTextInitialSerialized,
  richTextPlainTextLength,
  richTextToApiString,
} from "./lexicalRichText";

/**
 * Medien-Feld in `payload_json`: R2-Key oder Objekt mit Metadaten-Snapshot
 * (beim Verknüpfen aus der Mediathek).
 */
export type CmsMediaFieldStoredValue =
  | string
  | {
      key: string;
      title?: string | null;
      altText?: string | null;
      description?: string | null;
    };

export function cmsMediaFieldKey(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object" && raw !== null && "key" in raw) {
    return String((raw as Record<string, unknown>).key ?? "").trim();
  }
  return String(raw).trim();
}

function normalizeMediaFieldEntry(v: unknown): CmsMediaFieldStoredValue {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object" && v !== null && "key" in v) {
    const o = v as Record<string, unknown>;
    const key = String(o.key ?? "").trim();
    if (!key) return "";
    const title =
      o.title != null && String(o.title).trim()
        ? String(o.title).trim()
        : undefined;
    const altRaw = o.altText ?? o.alt_text;
    const altText =
      altRaw != null && String(altRaw).trim()
        ? String(altRaw).trim()
        : undefined;
    const description =
      o.description != null && String(o.description).trim()
        ? String(o.description).trim()
        : undefined;
    if (!title && !altText && !description) return key;
    return { key, title, altText, description };
  }
  return String(v).trim();
}

/** Aus Asset-Zeile für Payload (Felder `title` / `alt_text` aus API). */
export function cmsMediaValueFromAsset(a: {
  key: string;
  title?: string | null;
  alt_text?: string | null;
  description?: string | null;
}): CmsMediaFieldStoredValue {
  return normalizeMediaFieldEntry({
    key: a.key,
    title: a.title,
    altText: a.alt_text,
    description: a.description,
  });
}

function serializeMediaFieldForApi(
  raw: unknown,
): string | Record<string, unknown> {
  const n = normalizeMediaFieldEntry(raw);
  if (n === "") return "";
  if (typeof n === "string") return n;
  const o: Record<string, unknown> = { key: n.key };
  if (n.title) o.title = n.title;
  if (n.altText) o.altText = n.altText;
  if (n.description) o.description = n.description;
  return o;
}

function mediaFieldItemNonEmpty(v: unknown): boolean {
  return cmsMediaFieldKey(v).length > 0;
}

export function textMaxLength(f: CmsFieldDefinition): number | undefined {
  if (f.type !== "Text") return undefined;
  const v = f.validations?.maxLength;
  if (typeof v === "number" && v >= 0) return v;
  return f.textShape?.variant === "long" ? TEXT_LONG_MAX : TEXT_SHORT_MAX;
}

export function buildEmptyPayload(
  schema: CmsContentModelSchema,
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const f of schema.fields) {
    o[f.id] = defaultForField(f);
  }
  return o;
}

function defaultForField(f: CmsFieldDefinition): unknown {
  switch (f.type) {
    case "Text":
      return f.list ? [] : (f.defaultValue ?? "");
    case "RichText":
      return EMPTY_LEXICAL_STATE_JSON;
    case "Number":
      return f.defaultNumber ?? "";
    case "DateTime":
      return "";
    case "Location":
      return { lat: "", lon: "" };
    case "Media":
      return f.mediaShape?.variant === "many" ? [] : "";
    case "Boolean":
      return f.defaultBoolean ?? false;
    case "JsonObject":
      return "{\n  \n}";
    case "Reference":
      return f.referenceShape?.variant === "many" ? [] : "";
    default:
      return null;
  }
}

function normalizeMergedValue(
  f: CmsFieldDefinition,
  v: unknown,
): unknown {
  if (f.type === "Text" && f.list) {
    if (Array.isArray(v)) return v.map((x) => String(x));
    if (typeof v === "string" && v.trim()) return [v.trim()];
    return [];
  }
  if (f.type === "Reference" && f.referenceShape?.variant === "many") {
    if (Array.isArray(v)) return v.map((x) => String(x));
    if (typeof v === "string" && v.trim()) {
      return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }
  if (f.type === "JsonObject") {
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v as object, null, 2);
    } catch {
      return "{\n  \n}";
    }
  }
  if (f.type === "Location" && v && typeof v === "object") {
    const lo = v as Record<string, unknown>;
    const lat = lo.lat ?? lo.latitude;
    const lon = lo.lon ?? lo.longitude ?? lo.lng;
    return {
      lat: lat == null ? "" : String(lat),
      lon: lon == null ? "" : String(lon),
    };
  }
  if (f.type === "Boolean") {
    return Boolean(v);
  }
  if (f.type === "Number") {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? n : "";
    }
    return "";
  }
  if (f.type === "RichText") {
    if (typeof v === "object" && v !== null) {
      try {
        return JSON.stringify(v);
      } catch {
        return EMPTY_LEXICAL_STATE_JSON;
      }
    }
    const s = v == null ? "" : String(v);
    return richTextInitialSerialized(s);
  }
  if (f.type === "Text" || f.type === "DateTime") {
    return v == null ? "" : String(v);
  }
  if (f.type === "Media") {
    if (f.mediaShape?.variant === "many") {
      if (Array.isArray(v)) return v.map((x) => normalizeMediaFieldEntry(x));
      return [];
    }
    return normalizeMediaFieldEntry(v);
  }
  if (
    f.type === "Reference" &&
    (f.referenceShape?.variant ?? "one") === "one"
  ) {
    return v == null ? "" : String(v);
  }
  return v;
}

export function mergePayloadWithSchema(
  schema: CmsContentModelSchema,
  existing: unknown,
): Record<string, unknown> {
  const base = buildEmptyPayload(schema);
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    return base;
  }
  const row = existing as Record<string, unknown>;
  for (const f of schema.fields) {
    if (Object.prototype.hasOwnProperty.call(row, f.id)) {
      base[f.id] = normalizeMergedValue(f, row[f.id]);
    }
  }
  return base;
}

export function validateEntryPayload(
  schema: CmsContentModelSchema,
  payload: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  for (const f of schema.fields) {
    if (!f.required) continue;
    const v = payload[f.id];
    if (f.type === "Text" && f.list) {
      const arr = Array.isArray(v) ? v : [];
      const nonempty = arr.filter((x) => String(x).trim() !== "");
      if (nonempty.length === 0) errors.push(`${f.name} ist erforderlich.`);
      continue;
    }
    if (f.type === "Media" && f.mediaShape?.variant === "many") {
      const arr = Array.isArray(v) ? v : [];
      const nonempty = arr.filter((x) => mediaFieldItemNonEmpty(x));
      if (nonempty.length === 0) errors.push(`${f.name} ist erforderlich.`);
      continue;
    }
    if (f.type === "Media" && f.mediaShape?.variant !== "many") {
      if (!mediaFieldItemNonEmpty(v)) {
        errors.push(`${f.name} ist erforderlich.`);
      }
      continue;
    }
    if (f.type === "Reference" && f.referenceShape?.variant === "many") {
      const arr = Array.isArray(v) ? v : [];
      const nonempty = arr.filter((x) => String(x).trim() !== "");
      if (nonempty.length === 0) errors.push(`${f.name} ist erforderlich.`);
      continue;
    }
    if (f.type === "Boolean") {
      /* Booleans sind immer gesetzt */
      continue;
    }
    if (f.type === "Number") {
      if (v === "" || v === null || v === undefined) {
        errors.push(`${f.name} ist erforderlich.`);
      }
      continue;
    }
    if (f.type === "JsonObject") {
      const s = typeof v === "string" ? v.trim() : "";
      if (!s) errors.push(`${f.name} ist erforderlich.`);
      continue;
    }
    if (f.type === "Location") {
      const lo = v as Record<string, unknown> | undefined;
      const lat = lo?.lat != null ? String(lo.lat).trim() : "";
      const lon = lo?.lon != null ? String(lo.lon).trim() : "";
      if (!lat || !lon) errors.push(`${f.name} ist erforderlich.`);
      continue;
    }
    if (f.type === "RichText") {
      if (richTextPlainTextLength(v) === 0) {
        errors.push(`${f.name} ist erforderlich.`);
      }
      continue;
    }
    if (v === null || v === undefined || String(v).trim() === "") {
      errors.push(`${f.name} ist erforderlich.`);
    }
  }
  return errors;
}

/** Für API/DB: JSON-Objekt mit Feld-IDs als Keys. */
export function serializeEntryPayloadForApi(
  schema: CmsContentModelSchema,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of schema.fields) {
    const raw = payload[f.id];
    switch (f.type) {
      case "Text":
        if (f.list) {
          const arr = Array.isArray(raw) ? raw : [];
          out[f.id] = arr.map((x) => String(x).trim()).filter(Boolean);
        } else {
          out[f.id] = raw == null ? "" : String(raw);
        }
        break;
      case "RichText":
        out[f.id] = richTextToApiString(raw);
        break;
      case "Number": {
        if (raw === "" || raw === null || raw === undefined) {
          out[f.id] = null;
        } else {
          const n = Number(raw);
          out[f.id] = Number.isFinite(n) ? n : null;
        }
        break;
      }
      case "DateTime":
        out[f.id] = raw == null ? "" : String(raw);
        break;
      case "Location": {
        const lo = raw as Record<string, unknown> | undefined;
        const lat = Number(lo?.lat);
        const lon = Number(lo?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          out[f.id] = { lat, lon };
        } else {
          out[f.id] = null;
        }
        break;
      }
      case "Media":
        if (f.mediaShape?.variant === "many") {
          const arr = Array.isArray(raw) ? raw : [];
          out[f.id] = arr
            .map((x) => serializeMediaFieldForApi(x))
            .filter((x) => x !== "");
        } else {
          out[f.id] = serializeMediaFieldForApi(raw);
        }
        break;
      case "Boolean":
        out[f.id] = Boolean(raw);
        break;
      case "JsonObject": {
        const s = typeof raw === "string" ? raw.trim() : "";
        if (!s) {
          out[f.id] = {};
        } else {
          try {
            out[f.id] = JSON.parse(s) as unknown;
          } catch {
            out[f.id] = {};
          }
        }
        break;
      }
      case "Reference":
        if (f.referenceShape?.variant === "many") {
          const arr = Array.isArray(raw) ? raw : [];
          out[f.id] = arr.map((x) => String(x).trim()).filter(Boolean);
        } else {
          out[f.id] = raw == null ? "" : String(raw).trim();
        }
        break;
      default:
        break;
    }
  }
  return out;
}
