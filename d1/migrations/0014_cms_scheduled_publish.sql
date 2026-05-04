-- CMS: optionales Datum für geplante Veröffentlichung
--   wrangler d1 execute <DB-NAME> --file=./d1/migrations/0014_cms_scheduled_publish.sql

ALTER TABLE cms_contents ADD COLUMN scheduled_publish_at TEXT;

CREATE INDEX IF NOT EXISTS idx_cms_contents_scheduled
    ON cms_contents (scheduled_publish_at);
