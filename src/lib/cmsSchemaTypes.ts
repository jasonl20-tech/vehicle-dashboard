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

/** Contentful „Short text“ vs. „Long text“ (max. Zeichen). */
export const TEXT_SHORT_MAX = 256;
export const TEXT_LONG_MAX = 50_000;

export type TextFieldVariant = "short" | "long";

export type NumberFieldVariant = "integer" | "decimal";

/** Date & time — Editor-/Validierungs-Optionen (Contentful-nah). */
export type DateTimeFormat =
  | "date"
  | "dateAndTime"
  | "dateAndTimeWithTimezone";

export type DateTimeTimeMode = "12" | "24";

export type DateTimeDateRange = {
  enabled: boolean;
  min?: string;
  max?: string;
};

export type DateTimeDefaultSlice = {
  date?: string;
  time?: string;
  timezone?: string;
};

export type DateTimeFieldConfig = {
  validation: {
    dateRange?: DateTimeDateRange;
  };
  defaultValue?: DateTimeDefaultSlice;
  format: DateTimeFormat;
  timeMode: DateTimeTimeMode;
};

export function defaultDateTimeFieldConfig(): DateTimeFieldConfig {
  return {
    validation: {},
    format: "dateAndTimeWithTimezone",
    timeMode: "24",
  };
}

/** Media: eine Datei vs. viele (nach Anlegen fixiert). */
export type MediaFieldVariant = "one" | "many";

export type MediaFileSizeValidation = {
  enabled: boolean;
  minBytes?: number;
  maxBytes?: number;
};

export type MediaFileTypesValidation = {
  enabled: boolean;
  types: string[];
};

export type MediaImageDimensionsValidation = {
  enabled: boolean;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
};

export type MediaFieldConfig = {
  validation: {
    fileSize?: MediaFileSizeValidation;
    fileTypes?: MediaFileTypesValidation;
    imageDimensions?: MediaImageDimensionsValidation;
  };
  allowCreateNew: boolean;
  allowLinkExisting: boolean;
};

export function defaultMediaFieldConfig(): MediaFieldConfig {
  return {
    validation: {},
    allowCreateNew: true,
    allowLinkExisting: true,
  };
}

/** Boolean: Darstellung im Entry-Editor (Contentful-nah). */
export type BooleanFieldWidget = "radio" | "dropdown" | "toggle";

export type BooleanFieldConfig = {
  widget: BooleanFieldWidget;
  trueLabel: string;
  falseLabel: string;
};

export function defaultBooleanFieldConfig(): BooleanFieldConfig {
  return {
    widget: "radio",
    trueLabel: "Yes",
    falseLabel: "No",
  };
}

/** JSON Object: Validierung der Anzahl Top-Level-Keys (Contentful-nah). */
export type JsonObjectPropertyCountValidation = {
  enabled: boolean;
  min?: number;
  max?: number;
};

export type JsonObjectFieldConfig = {
  validation: {
    propertyCount?: JsonObjectPropertyCountValidation;
  };
};

export function defaultJsonObjectFieldConfig(): JsonObjectFieldConfig {
  return { validation: {} };
}

export type CmsFieldValidations = {
  maxLength?: number;
  /** Text: Mindestlänge in Zeichen */
  minLength?: number;
  min?: number;
  max?: number;
  unique?: boolean;
  /** Reference: erlaubte Content-Model-Keys */
  linkContentType?: string[];
  /** Text: benutzerdefinierte Regex (wenn kein Preset) */
  pattern?: string;
  patternPreset?: "email" | "uri";
  prohibitPattern?: string;
  /** Text: erlaubte Werte (Enum) */
  allowedValues?: string[];
  /** Number: erlaubte Werte (Enum) */
  allowedNumberValues?: number[];
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
  /** Nur Text: Kurz- vs. Langtext — nach Anlegen in der UI fixiert */
  textShape?: { variant: TextFieldVariant };
  /** Nur Text: Liste mehrerer Werte — nach Anlegen fixiert */
  list?: boolean;
  /** Nur Text: Vorgabewert für neue Einträge */
  defaultValue?: string;
  /** Nur Number: Integer vs. Decimal — nach Anlegen in der UI fixiert */
  numberShape?: { variant: NumberFieldVariant };
  /** Nur Number: Vorgabewert */
  defaultNumber?: number;
  /** Nur bei type === "DateTime" */
  dateTime?: DateTimeFieldConfig;
  /** Nur Media: One file vs. Many files — nach Anlegen fixiert */
  mediaShape?: { variant: MediaFieldVariant };
  /** Nur Media */
  media?: MediaFieldConfig;
  /** Nur Boolean: Editor-Optionen (Widget, Labels) */
  boolean?: BooleanFieldConfig;
  /** Nur Boolean: Standardwert für neue Einträge */
  defaultBoolean?: boolean;
  /** Nur JsonObject */
  jsonObject?: JsonObjectFieldConfig;
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
    if (typeof v.minLength === "number" && v.minLength >= 0) {
      validations.minLength = Math.floor(v.minLength);
    }
    if (typeof v.min === "number") validations.min = v.min;
    if (typeof v.max === "number") validations.max = v.max;
    if (v.unique === true) validations.unique = true;
    if (Array.isArray(v.linkContentType)) {
      validations.linkContentType = v.linkContentType.filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      );
    }
    if (typeof v.pattern === "string" && v.pattern.trim()) {
      validations.pattern = v.pattern.trim();
    }
    if (v.patternPreset === "email" || v.patternPreset === "uri") {
      validations.patternPreset = v.patternPreset;
    }
    if (typeof v.prohibitPattern === "string" && v.prohibitPattern.trim()) {
      validations.prohibitPattern = v.prohibitPattern.trim();
    }
    if (Array.isArray(v.allowedValues)) {
      const av = v.allowedValues.filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      );
      if (av.length > 0) validations.allowedValues = av;
    }
    if (Array.isArray(v.allowedNumberValues)) {
      const nums = v.allowedNumberValues.filter(
        (x): x is number => typeof x === "number" && !Number.isNaN(x),
      );
      if (nums.length > 0) validations.allowedNumberValues = nums;
    }
    if (Object.keys(validations).length === 0) validations = undefined;
  }
  let richText: RichTextFieldConfig | undefined;
  if (type === "RichText") {
    richText =
      o.richText && typeof o.richText === "object"
        ? normalizeRichTextConfig(o.richText as Record<string, unknown>)
        : defaultRichTextFieldConfig();
  }

  let textShape: { variant: TextFieldVariant } | undefined;
  let list: boolean | undefined;
  let defaultValue: string | undefined;
  if (type === "Text") {
    const ts = o.textShape;
    if (ts && typeof ts === "object") {
      const tv = (ts as Record<string, unknown>).variant;
      if (tv === "short" || tv === "long") textShape = { variant: tv };
    }
    if (!textShape) {
      const ml = validations?.maxLength;
      textShape = {
        variant:
          ml !== undefined && ml > TEXT_SHORT_MAX ? "long" : "short",
      };
    }
    if (o.list === true) list = true;
    if (typeof o.defaultValue === "string") {
      const dv = o.defaultValue.trim();
      if (dv !== "") defaultValue = dv;
    }
  }

  let numberShape: { variant: NumberFieldVariant } | undefined;
  let defaultNumber: number | undefined;
  if (type === "Number") {
    const ns = o.numberShape;
    if (ns && typeof ns === "object") {
      const nv = (ns as Record<string, unknown>).variant;
      if (nv === "integer" || nv === "decimal") numberShape = { variant: nv };
    }
    if (!numberShape) numberShape = { variant: "integer" };
    if (typeof o.defaultNumber === "number" && !Number.isNaN(o.defaultNumber)) {
      defaultNumber = o.defaultNumber;
    }
  }

  let dateTime: DateTimeFieldConfig | undefined;
  if (type === "DateTime") {
    dateTime =
      o.dateTime && typeof o.dateTime === "object"
        ? normalizeDateTimeConfig(o.dateTime as Record<string, unknown>)
        : defaultDateTimeFieldConfig();
  }

  let mediaShape: { variant: MediaFieldVariant } | undefined;
  let media: MediaFieldConfig | undefined;
  if (type === "Media") {
    const mediaRaw =
      o.media && typeof o.media === "object"
        ? (o.media as Record<string, unknown>)
        : undefined;
    const ms = o.mediaShape;
    if (ms && typeof ms === "object") {
      const mv = (ms as Record<string, unknown>).variant;
      if (mv === "one" || mv === "many") mediaShape = { variant: mv };
    }
    if (!mediaShape && mediaRaw) {
      const mv = mediaRaw.variant;
      if (mv === "one" || mv === "many") mediaShape = { variant: mv };
    }
    if (!mediaShape) {
      if (o.list === true || o.multiple === true || o.many === true) {
        mediaShape = { variant: "many" };
      } else {
        mediaShape = { variant: "one" };
      }
    }
    media = mediaRaw
      ? normalizeMediaConfig(mediaRaw)
      : defaultMediaFieldConfig();
  }

  let booleanCfg: BooleanFieldConfig | undefined;
  let defaultBoolean: boolean | undefined;
  if (type === "Boolean") {
    if (typeof o.defaultBoolean === "boolean") {
      defaultBoolean = o.defaultBoolean;
    }
    booleanCfg =
      o.boolean && typeof o.boolean === "object"
        ? normalizeBooleanConfig(o.boolean as Record<string, unknown>)
        : defaultBooleanFieldConfig();
  }

  let jsonObjectCfg: JsonObjectFieldConfig | undefined;
  if (type === "JsonObject") {
    jsonObjectCfg =
      o.jsonObject && typeof o.jsonObject === "object"
        ? normalizeJsonObjectConfig(o.jsonObject as Record<string, unknown>)
        : defaultJsonObjectFieldConfig();
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
    ...(textShape ? { textShape } : {}),
    ...(list ? { list: true } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(numberShape ? { numberShape } : {}),
    ...(defaultNumber !== undefined ? { defaultNumber } : {}),
    ...(dateTime ? { dateTime } : {}),
    ...(mediaShape ? { mediaShape } : {}),
    ...(media ? { media } : {}),
    ...(booleanCfg ? { boolean: booleanCfg } : {}),
    ...(defaultBoolean !== undefined ? { defaultBoolean } : {}),
    ...(jsonObjectCfg ? { jsonObject: jsonObjectCfg } : {}),
  };
}

function normalizeJsonObjectConfig(
  raw: Record<string, unknown>,
): JsonObjectFieldConfig {
  const def = defaultJsonObjectFieldConfig();
  const v = raw.validation;
  if (v && typeof v === "object") {
    const vo = v as Record<string, unknown>;
    const pc = vo.propertyCount;
    if (pc && typeof pc === "object") {
      const p = pc as Record<string, unknown>;
      if (p.enabled === true) {
        def.validation.propertyCount = {
          enabled: true,
          ...(typeof p.min === "number" && p.min >= 0
            ? { min: Math.floor(p.min) }
            : {}),
          ...(typeof p.max === "number" && p.max >= 0
            ? { max: Math.floor(p.max) }
            : {}),
        };
      }
    }
  }
  return def;
}

export function serializeJsonObjectForStorage(
  cfg: JsonObjectFieldConfig,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const validation: Record<string, unknown> = {};
  const pc = cfg.validation.propertyCount;
  if (pc?.enabled) {
    validation.propertyCount = {
      enabled: true,
      ...(typeof pc.min === "number" ? { min: pc.min } : {}),
      ...(typeof pc.max === "number" ? { max: pc.max } : {}),
    };
  }
  if (Object.keys(validation).length > 0) out.validation = validation;
  return out;
}

function normalizeBooleanConfig(raw: Record<string, unknown>): BooleanFieldConfig {
  const def = defaultBooleanFieldConfig();
  const w = raw.widget;
  if (w === "radio" || w === "dropdown" || w === "toggle") {
    def.widget = w;
  }
  if (typeof raw.trueLabel === "string") {
    const t = raw.trueLabel.slice(0, 255).trim();
    if (t) def.trueLabel = t;
  }
  if (typeof raw.falseLabel === "string") {
    const t = raw.falseLabel.slice(0, 255).trim();
    if (t) def.falseLabel = t;
  }
  return def;
}

export function serializeBooleanForStorage(
  cfg: BooleanFieldConfig,
): Record<string, unknown> {
  return {
    widget: cfg.widget,
    trueLabel: cfg.trueLabel,
    falseLabel: cfg.falseLabel,
  };
}

function normalizeDateTimeConfig(raw: Record<string, unknown>): DateTimeFieldConfig {
  const def = defaultDateTimeFieldConfig();
  const v = raw.validation;
  if (v && typeof v === "object") {
    const vo = v as Record<string, unknown>;
    const dr = vo.dateRange;
    if (dr && typeof dr === "object") {
      const d = dr as Record<string, unknown>;
      if (d.enabled === true) {
        def.validation.dateRange = {
          enabled: true,
          ...(typeof d.min === "string" && d.min.trim() ? { min: d.min.trim() } : {}),
          ...(typeof d.max === "string" && d.max.trim() ? { max: d.max.trim() } : {}),
        };
      }
    }
  }
  const dv = raw.defaultValue;
  if (dv && typeof dv === "object") {
    const o = dv as Record<string, unknown>;
    const slice: DateTimeDefaultSlice = {};
    if (typeof o.date === "string" && o.date.trim()) slice.date = o.date.trim();
    if (typeof o.time === "string" && o.time.trim()) slice.time = o.time.trim();
    if (typeof o.timezone === "string" && o.timezone.trim()) {
      slice.timezone = o.timezone.trim();
    }
    if (Object.keys(slice).length > 0) def.defaultValue = slice;
  }
  const fmt = raw.format;
  if (fmt === "date" || fmt === "dateAndTime" || fmt === "dateAndTimeWithTimezone") {
    def.format = fmt;
  }
  const tm = raw.timeMode;
  if (tm === "12" || tm === "24") def.timeMode = tm;
  return def;
}

export function serializeDateTimeForStorage(
  cfg: DateTimeFieldConfig,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    format: cfg.format,
    timeMode: cfg.timeMode,
  };
  const validation: Record<string, unknown> = {};
  if (cfg.validation.dateRange?.enabled) {
    const dr = cfg.validation.dateRange;
    validation.dateRange = {
      enabled: true,
      ...(dr.min ? { min: dr.min } : {}),
      ...(dr.max ? { max: dr.max } : {}),
    };
  }
  if (Object.keys(validation).length > 0) out.validation = validation;
  if (cfg.defaultValue && Object.keys(cfg.defaultValue).length > 0) {
    out.defaultValue = { ...cfg.defaultValue };
  }
  return out;
}

function normalizeMediaConfig(raw: Record<string, unknown>): MediaFieldConfig {
  const def = defaultMediaFieldConfig();
  const v = raw.validation;
  if (v && typeof v === "object") {
    const vo = v as Record<string, unknown>;
    const fs = vo.fileSize;
    if (fs && typeof fs === "object") {
      const f = fs as Record<string, unknown>;
      if (f.enabled === true) {
        def.validation.fileSize = {
          enabled: true,
          ...(typeof f.minBytes === "number" && f.minBytes >= 0
            ? { minBytes: Math.floor(f.minBytes) }
            : {}),
          ...(typeof f.maxBytes === "number" && f.maxBytes >= 0
            ? { maxBytes: Math.floor(f.maxBytes) }
            : {}),
        };
      }
    }
    const ft = vo.fileTypes;
    if (ft && typeof ft === "object") {
      const t = ft as Record<string, unknown>;
      if (t.enabled === true && Array.isArray(t.types)) {
        const types = t.types.filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        );
        if (types.length > 0) {
          def.validation.fileTypes = { enabled: true, types };
        }
      }
    }
    const idim = vo.imageDimensions;
    if (idim && typeof idim === "object") {
      const im = idim as Record<string, unknown>;
      if (im.enabled === true) {
        def.validation.imageDimensions = {
          enabled: true,
          ...(typeof im.minWidth === "number" && im.minWidth >= 0
            ? { minWidth: Math.floor(im.minWidth) }
            : {}),
          ...(typeof im.maxWidth === "number" && im.maxWidth >= 0
            ? { maxWidth: Math.floor(im.maxWidth) }
            : {}),
          ...(typeof im.minHeight === "number" && im.minHeight >= 0
            ? { minHeight: Math.floor(im.minHeight) }
            : {}),
          ...(typeof im.maxHeight === "number" && im.maxHeight >= 0
            ? { maxHeight: Math.floor(im.maxHeight) }
            : {}),
        };
      }
    }
  }
  if (raw.allowCreateNew === false) def.allowCreateNew = false;
  if (raw.allowLinkExisting === false) def.allowLinkExisting = false;
  return def;
}

export function serializeMediaForStorage(
  cfg: MediaFieldConfig,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    allowCreateNew: cfg.allowCreateNew,
    allowLinkExisting: cfg.allowLinkExisting,
  };
  const validation: Record<string, unknown> = {};
  const fs = cfg.validation.fileSize;
  if (fs?.enabled) {
    validation.fileSize = {
      enabled: true,
      ...(typeof fs.minBytes === "number" ? { minBytes: fs.minBytes } : {}),
      ...(typeof fs.maxBytes === "number" ? { maxBytes: fs.maxBytes } : {}),
    };
  }
  const ft = cfg.validation.fileTypes;
  if (ft?.enabled && ft.types.length > 0) {
    validation.fileTypes = { enabled: true, types: [...ft.types] };
  }
  const id = cfg.validation.imageDimensions;
  if (id?.enabled) {
    validation.imageDimensions = {
      enabled: true,
      ...(typeof id.minWidth === "number" ? { minWidth: id.minWidth } : {}),
      ...(typeof id.maxWidth === "number" ? { maxWidth: id.maxWidth } : {}),
      ...(typeof id.minHeight === "number" ? { minHeight: id.minHeight } : {}),
      ...(typeof id.maxHeight === "number" ? { maxHeight: id.maxHeight } : {}),
    };
  }
  if (Object.keys(validation).length > 0) out.validation = validation;
  return out;
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
      if (f.type === "Text") {
        if (f.textShape) row.textShape = f.textShape;
        if (f.list) row.list = true;
        if (f.defaultValue != null && f.defaultValue !== "") {
          row.defaultValue = f.defaultValue;
        }
      }
      if (f.type === "Number") {
        if (f.numberShape) row.numberShape = f.numberShape;
        if (f.defaultNumber !== undefined && !Number.isNaN(f.defaultNumber)) {
          row.defaultNumber = f.defaultNumber;
        }
      }
      if (f.type === "RichText" && f.richText) {
        row.richText = serializeRichTextForStorage(f.richText);
      }
      if (f.type === "DateTime" && f.dateTime) {
        row.dateTime = serializeDateTimeForStorage(f.dateTime);
      }
      if (f.type === "Media") {
        const variant = f.mediaShape?.variant ?? "one";
        row.mediaShape = { variant };
        row.media = serializeMediaForStorage(f.media ?? defaultMediaFieldConfig());
      }
      if (f.type === "Boolean") {
        row.boolean = serializeBooleanForStorage(
          f.boolean ?? defaultBooleanFieldConfig(),
        );
        if (typeof f.defaultBoolean === "boolean") {
          row.defaultBoolean = f.defaultBoolean;
        }
      }
      if (f.type === "JsonObject") {
        row.jsonObject = serializeJsonObjectForStorage(
          f.jsonObject ?? defaultJsonObjectFieldConfig(),
        );
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
  if (type === "Text") {
    if (typeof v.maxLength === "number" && v.maxLength > 0) {
      o.maxLength = Math.floor(v.maxLength);
    }
    if (typeof v.minLength === "number" && v.minLength >= 0) {
      o.minLength = Math.floor(v.minLength);
    }
    if (v.unique === true) o.unique = true;
    if (v.patternPreset === "email" || v.patternPreset === "uri") {
      o.patternPreset = v.patternPreset;
    }
    if (typeof v.pattern === "string" && v.pattern.trim()) {
      o.pattern = v.pattern.trim();
    }
    if (typeof v.prohibitPattern === "string" && v.prohibitPattern.trim()) {
      o.prohibitPattern = v.prohibitPattern.trim();
    }
    if (Array.isArray(v.allowedValues) && v.allowedValues.length > 0) {
      o.allowedValues = [...v.allowedValues];
    }
  }
  if (type === "Number") {
    if (typeof v.min === "number") o.min = v.min;
    if (typeof v.max === "number") o.max = v.max;
    if (v.unique === true) o.unique = true;
    if (Array.isArray(v.allowedNumberValues) && v.allowedNumberValues.length > 0) {
      o.allowedNumberValues = [...v.allowedNumberValues];
    }
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

/** Neues Text-Feld nach Contentful-„Add field“-Wizard (Kurz-/Langtext, Liste). */
export function newTextFieldFromWizard(args: {
  id: string;
  name: string;
  variant: TextFieldVariant;
  list: boolean;
}): CmsFieldDefinition {
  const cap = args.variant === "short" ? TEXT_SHORT_MAX : TEXT_LONG_MAX;
  return {
    id: args.id.trim(),
    name: args.name.trim(),
    type: "Text",
    required: false,
    textShape: { variant: args.variant },
    ...(args.list ? { list: true } : {}),
    validations: { maxLength: cap },
  };
}

export function newNumberFieldFromWizard(args: {
  id: string;
  name: string;
  variant: NumberFieldVariant;
}): CmsFieldDefinition {
  return {
    id: args.id.trim(),
    name: args.name.trim(),
    type: "Number",
    required: false,
    numberShape: { variant: args.variant },
  };
}

export function newDateTimeFieldFromWizard(args: {
  id: string;
  name: string;
}): CmsFieldDefinition {
  return {
    id: args.id.trim(),
    name: args.name.trim(),
    type: "DateTime",
    required: false,
    dateTime: defaultDateTimeFieldConfig(),
  };
}

export function newLocationFieldFromWizard(args: {
  id: string;
  name: string;
}): CmsFieldDefinition {
  return {
    id: args.id.trim(),
    name: args.name.trim(),
    type: "Location",
    required: false,
  };
}

export function newMediaFieldFromWizard(args: {
  id: string;
  name: string;
  variant: MediaFieldVariant;
}): CmsFieldDefinition {
  return {
    id: args.id.trim(),
    name: args.name.trim(),
    type: "Media",
    required: false,
    mediaShape: { variant: args.variant },
    media: defaultMediaFieldConfig(),
  };
}

export function newBooleanFieldFromWizard(args: {
  id: string;
  name: string;
}): CmsFieldDefinition {
  return {
    id: args.id.trim(),
    name: args.name.trim(),
    type: "Boolean",
    required: false,
    boolean: defaultBooleanFieldConfig(),
  };
}

export function newJsonObjectFieldFromWizard(args: {
  id: string;
  name: string;
}): CmsFieldDefinition {
  return {
    id: args.id.trim(),
    name: args.name.trim(),
    type: "JsonObject",
    required: false,
    jsonObject: defaultJsonObjectFieldConfig(),
  };
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
