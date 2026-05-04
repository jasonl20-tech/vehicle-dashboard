export const CMS_CONTENT_MODELS_API = "/api/cms/content-models";
export const CMS_CONTENTS_API = "/api/cms/contents";

export type CmsContentModelRow = {
  id: string;
  key: string;
  description: string | null;
  schema_json: string;
  created_at: string;
  updated_at: string;
};

export type CmsContentModelsListResponse = {
  rows: CmsContentModelRow[];
  total: number;
  limit: number;
  offset: number;
};

export type CmsContentRow = {
  id: string;
  content_model_id: string;
  payload_json: string;
  status: string;
  locale: string;
  created_at: string;
  updated_at: string;
  last_updated_by: string | null;
};

export type CmsContentsListResponse = {
  rows: CmsContentRow[];
  total: number;
  limit: number;
  offset: number;
};

/** Anzahl Felder aus schema_json (heuristisch, je nach Schema-Shape). */
export function countSchemaFields(schema: unknown): number {
  if (!schema || typeof schema !== "object") return 0;
  const o = schema as Record<string, unknown>;
  if (Array.isArray(o.fields)) return o.fields.length;
  if (Array.isArray(o.properties)) return o.properties.length;
  return Object.keys(o).length;
}

export function parseSchemaJson(schema_json: string): unknown {
  try {
    return JSON.parse(schema_json) as unknown;
  } catch {
    return null;
  }
}

/** Titel aus Content-Payload (flexibel). */
export function extractContentTitle(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "—";
  const o = payload as Record<string, unknown>;
  for (const k of ["title", "name", "headline", "slug", "internalTitle"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 200);
  }
  return "—";
}

export function statusLabelDe(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "draft") return "Entwurf";
  if (s === "published") return "Veröffentlicht";
  if (s === "archived") return "Archiviert";
  return status || "—";
}
