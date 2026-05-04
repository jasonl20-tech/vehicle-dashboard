/**
 * JSON-Shape für `cms_content_models.schema_json` (Contentful-inspiriert).
 */

export const CMS_MODEL_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
export const CMS_FIELD_ID_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

export const CMS_FIELD_TYPES = [
  "RichText",
  "Text",
  "Number",
  "DateTime",
  "Location",
  "Media",
  "Boolean",
  "JsonObject",
  "Reference",
] as const;

export type CmsFieldType = (typeof CMS_FIELD_TYPES)[number];

export type CmsFieldValidations = {
  maxLength?: number;
  min?: number;
  max?: number;
  unique?: boolean;
  /** Reference: erlaubte Content-Model-Keys */
  linkContentType?: string[];
};

/** Rich Text — detaillierte Editor-/Validierungs-Optionen (Contentful-nah). */
export const ALL_RICH_TEXT_MARKS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "bold",
  "italic",
  "underline",
  "code",
  "superscript",
  "subscript",
  "strikethrough",
  "bulletList",
  "orderedList",
  "blockquote",
  "hr",
  "table",
] as const;

export type RichTextMarkId = (typeof ALL_RICH_TEXT_MARKS)[number];

export type RichTextSizeLimit = {
  enabled: boolean;
  min?: number;
  max?: number;
};

export type RichTextEntryTypeFilter = {
  enabled: boolean;
  keys: string[];
};

export type RichTextValidationConfig = {
  size?: RichTextSizeLimit;
  linkToEntry?: RichTextSizeLimit;
  linkToEntryTypes?: RichTextEntryTypeFilter;
  linkToAsset?: RichTextSizeLimit;
  embedBlock?: RichTextSizeLimit;
  embedBlockTypes?: RichTextEntryTypeFilter;
  embedInline?: RichTextSizeLimit;
  embedInlineTypes?: RichTextEntryTypeFilter;
  embedAsset?: RichTextSizeLimit;
};

export type RichTextSettingsConfig = {
  /** Aktivierte Formatierungs-Marken (Toolbar) */
  formattingMarks: string[];
  hyperlinkUrl: boolean;
  hyperlinkEntry: boolean;
  hyperlinkAsset: boolean;
  embedEntry: boolean;
  embedInlineEntry: boolean;
  embedAsset: boolean;
};

export type RichTextFieldConfig = {
  settings: RichTextSettingsConfig;
  validation: RichTextValidationConfig;
};

export function defaultRichTextFieldConfig(): RichTextFieldConfig {
  return {
    settings: {
      formattingMarks: [...ALL_RICH_TEXT_MARKS],
      hyperlinkUrl: true,
      hyperlinkEntry: true,
      hyperlinkAsset: true,
      embedEntry: true,
      embedInlineEntry: true,
      embedAsset: true,
    },
    validation: {},
  };
}

/** Kurzlabels für die Formatierungs-Toolbar (Contentful-nah). */
export const RICH_TEXT_MARK_LABELS: Record<string, string> = {
  h1: "H1",
  h2: "H2",
  h3: "H3",
  h4: "H4",
  h5: "H5",
  h6: "H6",
  bold: "B",
  italic: "I",
  underline: "U",
  code: "</>",
  superscript: "X²",
  subscript: "X₂",
  strikethrough: "S",
  bulletList: "•",
  orderedList: "1.",
  blockquote: "❝",
  hr: "—",
  table: "▦",
};

export type CmsFieldDefinition = {
  /** API-Feld-ID (camelCase), z. B. `heroTitle` */
  id: string;
  /** Anzeigename im Editor */
  name: string;
  type: CmsFieldType;
  required: boolean;
  /** Mehrsprachig (wie Contentful „localization“) */
  localized?: boolean;
  helpText?: string;
  validations?: CmsFieldValidations;
  /** Nur bei type === "RichText" */
  richText?: RichTextFieldConfig;
};

export type CmsContentModelSchema = {
  fields: CmsFieldDefinition[];
  /** Welches Feld in Listen als Titel dient */
  displayField?: string;
};

export function emptyContentModelSchema(): CmsContentModelSchema {
  return { fields: [] };
}

function normalizeField(raw: unknown): CmsFieldDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const type = o.type as CmsFieldType;
  if (!id || !name || !CMS_FIELD_TYPES.includes(type)) return null;
  const required = Boolean(o.required);
  const localized = o.localized === true;
  const helpText =
    typeof o.helpText === "string" ? o.helpText.trim() : undefined;
  let validations: CmsFieldValidations | undefined;
  if (o.validations && typeof o.validations === "object") {
    const v = o.validations as Record<string, unknown>;
    validations = {};
    if (typeof v.maxLength === "number" && v.maxLength >= 0) {
      validations.maxLength = Math.floor(v.maxLength);
    }
    if (typeof v.min === "number") validations.min = v.min;
    if (typeof v.max === "number") validations.max = v.max;
    if (v.unique === true) validations.unique = true;
    if (Array.isArray(v.linkContentType)) {
      validations.linkContentType = v.linkContentType.filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      );
    }
    if (Object.keys(validations).length === 0) validations = undefined;
  }
  let richText: RichTextFieldConfig | undefined;
  if (type === "RichText") {
    richText =
      o.richText && typeof o.richText === "object"
        ? normalizeRichTextConfig(o.richText)
        : defaultRichTextFieldConfig();
  }
  return {
    id,
    name,
    type,
    required,
    ...(localized ? { localized: true } : {}),
    ...(helpText ? { helpText } : {}),
    ...(validations ? { validations } : {}),
    ...(richText ? { richText } : {}),
  };
}

function normalizeRichTextConfig(raw: Record<string, unknown>): RichTextFieldConfig {
  const def = defaultRichTextFieldConfig();
  const s = raw.settings;
  const v = raw.validation;
  if (s && typeof s === "object") {
    const so = s as Record<string, unknown>;
    if (Array.isArray(so.formattingMarks)) {
      const marks = so.formattingMarks.filter(
        (x): x is string =>
          typeof x === "string" &&
          (ALL_RICH_TEXT_MARKS as readonly string[]).includes(x),
      );
      if (marks.length > 0) def.settings.formattingMarks = marks;
    }
    if (typeof so.hyperlinkUrl === "boolean") def.settings.hyperlinkUrl = so.hyperlinkUrl;
    if (typeof so.hyperlinkEntry === "boolean") def.settings.hyperlinkEntry = so.hyperlinkEntry;
    if (typeof so.hyperlinkAsset === "boolean") def.settings.hyperlinkAsset = so.hyperlinkAsset;
    if (typeof so.embedEntry === "boolean") def.settings.embedEntry = so.embedEntry;
    if (typeof so.embedInlineEntry === "boolean") def.settings.embedInlineEntry = so.embedInlineEntry;
    if (typeof so.embedAsset === "boolean") def.settings.embedAsset = so.embedAsset;
  }
  if (v && typeof v === "object") {
    def.validation = normalizeRichTextValidation(v as Record<string, unknown>);
  }
  return def;
}

function normalizeRichTextValidation(o: Record<string, unknown>): RichTextValidationConfig {
  const out: RichTextValidationConfig = {};
  const sz = o.size;
  if (sz && typeof sz === "object") {
    const x = sz as Record<string, unknown>;
    if (x.enabled === true) {
      out.size = {
        enabled: true,
        ...(typeof x.min === "number" ? { min: x.min } : {}),
        ...(typeof x.max === "number" ? { max: x.max } : {}),
      };
    }
  }
  const pickSize = (key: string): RichTextSizeLimit | undefined => {
    const x = o[key];
    if (!x || typeof x !== "object") return undefined;
    const r = x as Record<string, unknown>;
    if (r.enabled !== true) return undefined;
    return {
      enabled: true,
      ...(typeof r.min === "number" ? { min: r.min } : {}),
      ...(typeof r.max === "number" ? { max: r.max } : {}),
    };
  };
  const linkEntry = pickSize("linkToEntry");
  if (linkEntry) out.linkToEntry = linkEntry;
  const linkAsset = pickSize("linkToAsset");
  if (linkAsset) out.linkToAsset = linkAsset;
  const embedBlock = pickSize("embedBlock");
  if (embedBlock) out.embedBlock = embedBlock;
  const embedInline = pickSize("embedInline");
  if (embedInline) out.embedInline = embedInline;
  const embedAsset = pickSize("embedAsset");
  if (embedAsset) out.embedAsset = embedAsset;

  const pickTypes = (key: string): RichTextEntryTypeFilter | undefined => {
    const x = o[key];
    if (!x || typeof x !== "object") return undefined;
    const r = x as Record<string, unknown>;
    if (r.enabled !== true) return undefined;
    const keys = Array.isArray(r.keys)
      ? r.keys.filter((k): k is string => typeof k === "string" && k.length > 0)
      : [];
    return { enabled: true, keys };
  };
  const let1 = pickTypes("linkToEntryTypes");
  if (let1) out.linkToEntryTypes = let1;
  const ebt = pickTypes("embedBlockTypes");
  if (ebt) out.embedBlockTypes = ebt;
  const eit = pickTypes("embedInlineTypes");
  if (eit) out.embedInlineTypes = eit;
  return out;
}

function serializeSizeLimit(s: RichTextSizeLimit): Record<string, unknown> {
  const o: Record<string, unknown> = { enabled: true };
  if (typeof s.min === "number") o.min = s.min;
  if (typeof s.max === "number") o.max = s.max;
  return o;
}

function serializeTypeFilter(
  t: RichTextEntryTypeFilter,
): Record<string, unknown> | null {
  if (!t.enabled) return null;
  return { enabled: true, keys: [...t.keys] };
}

export function serializeRichTextForStorage(
  cfg: RichTextFieldConfig,
): Record<string, unknown> {
  const validation: Record<string, unknown> = {};
  const v = cfg.validation;
  if (v.size?.enabled) validation.size = serializeSizeLimit(v.size);
  if (v.linkToEntry?.enabled)
    validation.linkToEntry = serializeSizeLimit(v.linkToEntry);
  if (v.linkToAsset?.enabled)
    validation.linkToAsset = serializeSizeLimit(v.linkToAsset);
  if (v.embedBlock?.enabled)
    validation.embedBlock = serializeSizeLimit(v.embedBlock);
  if (v.embedInline?.enabled)
    validation.embedInline = serializeSizeLimit(v.embedInline);
  if (v.embedAsset?.enabled)
    validation.embedAsset = serializeSizeLimit(v.embedAsset);
  if (v.linkToEntryTypes) {
    const x = serializeTypeFilter(v.linkToEntryTypes);
    if (x) validation.linkToEntryTypes = x;
  }
  if (v.embedBlockTypes) {
    const x = serializeTypeFilter(v.embedBlockTypes);
    if (x) validation.embedBlockTypes = x;
  }
  if (v.embedInlineTypes) {
    const x = serializeTypeFilter(v.embedInlineTypes);
    if (x) validation.embedInlineTypes = x;
  }
  return {
    settings: {
      formattingMarks: [...cfg.settings.formattingMarks],
      hyperlinkUrl: cfg.settings.hyperlinkUrl,
      hyperlinkEntry: cfg.settings.hyperlinkEntry,
      hyperlinkAsset: cfg.settings.hyperlinkAsset,
      embedEntry: cfg.settings.embedEntry,
      embedInlineEntry: cfg.settings.embedInlineEntry,
      embedAsset: cfg.settings.embedAsset,
    },
    validation,
  };
}

export function parseContentModelSchema(raw: unknown): CmsContentModelSchema {
  if (!raw || typeof raw !== "object") return emptyContentModelSchema();
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.fields)) return emptyContentModelSchema();
  const fields = o.fields.map(normalizeField).filter(Boolean) as CmsFieldDefinition[];
  const displayField =
    typeof o.displayField === "string" && o.displayField.trim()
      ? o.displayField.trim()
      : undefined;
  return {
    fields,
    ...(displayField &&
    fields.some((f) => f.id === displayField) && { displayField }),
  };
}

export function serializeContentModelSchema(
  schema: CmsContentModelSchema,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    fields: schema.fields.map((f) => {
      const validations = f.validations
        ? pruneValidations(f.type, f.validations)
        : undefined;
      const row: Record<string, unknown> = {
        id: f.id,
        name: f.name,
        type: f.type,
        required: f.required,
      };
      if (f.localized) row.localized = true;
      if (f.helpText) row.helpText = f.helpText;
      if (validations && Object.keys(validations).length > 0) {
        row.validations = validations;
      }
      if (f.type === "RichText" && f.richText) {
        row.richText = serializeRichTextForStorage(f.richText);
      }
      return row;
    }),
  };
  if (
    schema.displayField &&
    schema.fields.some((f) => f.id === schema.displayField)
  ) {
    out.displayField = schema.displayField;
  }
  return out;
}

function pruneValidations(
  type: CmsFieldType,
  v: CmsFieldValidations,
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (
    type === "Text" &&
    typeof v.maxLength === "number" &&
    v.maxLength > 0
  ) {
    o.maxLength = Math.floor(v.maxLength);
  }
  if (type === "Number") {
    if (typeof v.min === "number") o.min = v.min;
    if (typeof v.max === "number") o.max = v.max;
  }
  if (type === "Text" && v.unique === true) {
    o.unique = true;
  }
  if (
    type === "Reference" &&
    Array.isArray(v.linkContentType) &&
    v.linkContentType.length > 0
  ) {
    o.linkContentType = [...v.linkContentType];
  }
  return o;
}

const FIELD_ID_PREFIX: Record<CmsFieldType, string> = {
  RichText: "richText",
  Text: "text",
  Number: "number",
  DateTime: "dateTime",
  Location: "location",
  Media: "media",
  Boolean: "booleanField",
  JsonObject: "json",
  Reference: "reference",
};

export function defaultFieldIdForType(type: CmsFieldType, index: number): string {
  return `${FIELD_ID_PREFIX[type]}${index + 1}`;
}

export const FIELD_TYPE_LABELS: Record<CmsFieldType, string> = {
  RichText: "Rich text",
  Text: "Text",
  Number: "Number",
  DateTime: "Date and time",
  Location: "Location",
  Media: "Media",
  Boolean: "Boolean",
  JsonObject: "JSON object",
  Reference: "Reference",
};

export const FIELD_TYPE_HELP: Record<CmsFieldType, string> = {
  RichText: "Text formatting with references and media",
  Text: "Titles, names, paragraphs, list of names",
  Number: "ID, order number, rating, quantity",
  DateTime: "Event dates",
  Location: "Coordinates: latitude and longitude",
  Media: "Images, videos, PDFs and other files",
  Boolean: "Yes or no, 1 or 0, true or false",
  JsonObject: "Data in JSON format",
  Reference: "Link entries of another content type",
};
