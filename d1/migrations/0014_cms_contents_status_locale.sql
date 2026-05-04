-- CMS `cms_contents`: Workflow-Status + Locale vorbereiten.
-- Nach 0013_cms_content.sql ausführen.
--
--   wrangler d1 execute <DB-NAME> --file=./d1/migrations/0014_cms_contents_status_locale.sql
--
-- Locale: Pro Zeile genau eine Locale (BCP 47, z. B. de-DE). Die eigentlichen
-- Feldwerte liegen in payload_json — ohne locale-spezifische Verschachtelung.
-- Übersetzungen = mehrere Zeilen gleicher „Logik“; optional später
-- translation_group_id ergänzen (FK/UNIQUE nach Bedarf).

ALTER TABLE cms_contents ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE cms_contents ADD COLUMN locale TEXT NOT NULL DEFAULT 'de-DE';

CREATE INDEX IF NOT EXISTS idx_cms_contents_status
    ON cms_contents (status);

CREATE INDEX IF NOT EXISTS idx_cms_contents_locale
    ON cms_contents (locale);

CREATE INDEX IF NOT EXISTS idx_cms_contents_model_locale
    ON cms_contents (content_model_id, locale);
