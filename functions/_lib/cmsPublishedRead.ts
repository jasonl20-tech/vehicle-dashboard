/**
 * Lesen veröffentlichter CMS-Einträge aus D1 (`cms_contents`) — z. B. eigene
 * Worker/Webseite mit **demselben** `website`-Binding wie dieses Projekt.
 *
 * Keine Session nötig; nur **eure** Berechtigung am D1-Binding entscheidet.
 *
 * **Preview vs. Production:** In `cms_content_models.schema_json` enthält jedes
 * gespeicherte Modell (über dieses Dashboard) das Feld `deliveryEnvironment`
 * mit `"production"` oder `"preview"`. Fehlt es in älteren Zeilen, wie
 * Production behandeln. Beispiel SQLite: `json_extract(schema_json, '$.deliveryEnvironment')`.
 */

export const CMS_CONTENT_STATUS_PUBLISHED = "published" as const;

export type CmsContentRowForWebsite = {
  id: string;
  content_model_id: string;
  payload_json: string;
  status: string;
  locale: string;
  updated_at: string;
};

/**
 * Einheitliches Prepared Statement: Liste nach Modell + Locale, nur veröffentlicht.
 * Bind: `[contentModelId, locale]`
 */
export const SQL_CMS_CONTENTS_PUBLISHED_BY_MODEL_LOCALE = `
  SELECT id, content_model_id, payload_json, status, locale, updated_at
    FROM cms_contents
   WHERE content_model_id = ?
     AND locale = ?
     AND status = ?
ORDER BY datetime(updated_at) DESC
`.trim();

/**
 * Einzelner Eintrag (z. B. Slug in `id` oder bekannte UUID).
 * Bind: `[id]`
 */
export const SQL_CMS_CONTENT_BY_ID = `
  SELECT id, content_model_id, payload_json, status, locale, updated_at
    FROM cms_contents
   WHERE id = ?
   LIMIT 1
`.trim();
