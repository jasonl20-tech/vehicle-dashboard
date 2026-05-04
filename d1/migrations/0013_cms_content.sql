-- Headless-CMS — `cms_content_models` + `cms_contents` im D1-Binding `website`
-- (dieselbe DB wie `submissions`, `customers`, `email_templates`).
--
--   wrangler d1 execute <DB-NAME> --file=./d1/migrations/0013_cms_content.sql
--
-- Idempotent: IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS cms_content_models (
    id TEXT PRIMARY KEY NOT NULL,
    key TEXT NOT NULL UNIQUE,
    description TEXT,
    schema_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_content_models_updated_at
    ON cms_content_models (updated_at);

CREATE TABLE IF NOT EXISTS cms_contents (
    id TEXT PRIMARY KEY NOT NULL,
    content_model_id TEXT NOT NULL
        REFERENCES cms_content_models (id)
        ON DELETE RESTRICT,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    locale TEXT NOT NULL DEFAULT 'de-DE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_cms_contents_model_id
    ON cms_contents (content_model_id);

CREATE INDEX IF NOT EXISTS idx_cms_contents_updated_at
    ON cms_contents (updated_at);

CREATE INDEX IF NOT EXISTS idx_cms_contents_status
    ON cms_contents (status);

CREATE INDEX IF NOT EXISTS idx_cms_contents_locale
    ON cms_contents (locale);

CREATE INDEX IF NOT EXISTS idx_cms_contents_model_locale
    ON cms_contents (content_model_id, locale);
