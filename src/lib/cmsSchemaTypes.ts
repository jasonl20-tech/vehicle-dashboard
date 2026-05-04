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
  return {
    id,
    name,
    type,
    required,
    ...(localized ? { localized: true } : {}),
    ...(helpText ? { helpText } : {}),
    ...(validations ? { validations } : {}),
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
    (type === "Text" || type === "RichText") &&
    typeof v.maxLength === "number" &&
    v.maxLength > 0
  ) {
    o.maxLength = Math.floor(v.maxLength);
  }
  if (type === "Number") {
    if (typeof v.min === "number") o.min = v.min;
    if (typeof v.max === "number") o.max = v.max;
  }
  if ((type === "Text" || type === "RichText") && v.unique === true) {
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
