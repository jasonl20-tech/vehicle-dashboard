import { extractPlainFromLexicalOrText } from "./lexicalRichText";

export const CMS_CONTENT_MODELS_API = "/api/cms/content-models";
export const CMS_CONTENTS_API = "/api/cms/contents";

/**
 * Muss mit `CMS_DESTROY_MIN_SICHERHEITSSTUFE` in `functions/_lib/auth.ts` übereinstimmen.
 * Nur Nutzer mit Stufe ≥ dieses Werts dürfen CMS-Einträge und -Modelle per API löschen.
 */
export const CMS_DESTROY_MIN_SICHERHEITSSTUFE = 9;

export function userMayDeleteCmsContent(sicherheitsstufe: number): boolean {
  return sicherheitsstufe >= CMS_DESTROY_MIN_SICHERHEITSSTUFE;
}

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
  scheduled_publish_at: string | null;
  /** Profilbild-URL aus `user.profilbild` (GET-Liste, optional). */
  last_updater_profilbild?: string | null;
};

export type CmsContentsListResponse = {
  rows: CmsContentRow[];
  total: number;
  limit: number;
  offset: number;
};

/** Anzahl Felder aus schema_json (heuristisch, je nach Schema-Shape). */
/** Für `<input type="datetime-local" />` aus API-ISO. */
export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Aus datetime-local Wert → ISO für API. */
export function datetimeLocalToIso(local: string): string | null {
  const t = local.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

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

/** Titel aus Content-Payload (flexibel; Rich Text = Lexical-JSON oder Klartext). */
export function extractContentTitle(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "—";
  const o = payload as Record<string, unknown>;
  const primary = [
    "title",
    "name",
    "headline",
    "slug",
    "internalTitle",
    "content",
    "body",
    "text",
    "description",
    "summary",
    "excerpt",
    "intro",
    "teaser",
  ] as const;
  for (const k of primary) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) {
      const plain = extractPlainFromLexicalOrText(v).trim();
      if (plain) return plain.slice(0, 200);
    }
  }
  const keys = Object.keys(o).sort();
  for (const k of keys) {
    const v = o[k];
    if (typeof v !== "string" || !v.trim()) continue;
    const plain = extractPlainFromLexicalOrText(v).trim();
    if (plain.length >= 3) return plain.slice(0, 200);
  }
  return "—";
}

/** Listen-Darstellung: nie nur ein Minuszeichen als reiner Link-Text. */
export function contentEntryListLabel(title: string, entryId: string): string {
  const t = title.trim();
  if (t && t !== "—") return t;
  const hint =
    entryId.length > 10 ? `${entryId.slice(0, 8)}…` : entryId;
  return hint ? `Ohne Titel (${hint})` : "Eintrag bearbeiten";
}

export function statusLabelDe(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "draft") return "Entwurf";
  if (s === "published") return "Veröffentlicht";
  if (s === "archived") return "Archiviert";
  if (s === "scheduled") return "Geplant";
  return status || "—";
}
