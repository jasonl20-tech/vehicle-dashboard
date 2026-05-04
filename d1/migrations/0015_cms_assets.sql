-- CMS — Media-Assets (Metadaten in D1, Binärdaten bleiben in R2).
--
--   wrangler d1 execute <DB-NAME> --file=./d1/migrations/0015_cms_assets.sql
--
-- Idempotent: IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS cms_assets (
    id TEXT PRIMARY KEY NOT NULL,
    r2_key TEXT NOT NULL UNIQUE,
    title TEXT,
    description TEXT,
    alt_text TEXT,
    original_filename TEXT,
    content_type TEXT,
    size_bytes INTEGER,
    width INTEGER,
    height INTEGER,
    status TEXT NOT NULL DEFAULT 'draft',
    locale TEXT NOT NULL DEFAULT 'de-DE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_cms_assets_updated_at
    ON cms_assets (updated_at);

CREATE INDEX IF NOT EXISTS idx_cms_assets_status
    ON cms_assets (status);

CREATE INDEX IF NOT EXISTS idx_cms_assets_locale
    ON cms_assets (locale);
