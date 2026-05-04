-- Headless-CMS (Content-Modelle + Einträge), JSON-lastig.
-- Sinnvolle Ziel-D1: dieselbe Website-/Configs-D1 wie z. B. `email_templates`,
-- sofern das CMS dort betrieben wird (env wie in wrangler).
--
--   wrangler d1 execute <DB-NAME> --file=./d1/migrations/0013_cms_content.sql
--
-- Idempotent: IF NOT EXISTS.

-- Modell-Definition (Contentful „Content type“): ein JSON-Schema pro Zeile.
CREATE TABLE IF NOT EXISTS cms_content_models (
    id TEXT PRIMARY KEY NOT NULL,
    -- Stabiler API-Name, z. B. "blogPost" — eindeutig, immutable nach möglichst.
    key TEXT NOT NULL UNIQUE,
    description TEXT,
    -- Komplettes Modell (Felder, Typen, Validierung, ggf. Editor-UI-Hints).
    schema_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_content_models_updated_at
    ON cms_content_models (updated_at);

-- Einträge („entries“): Nutzdaten als JSON; Modell-Zuordnung als eigene Spalte
-- (Listen/Filter ohne JSON-Parsing der gesamten Payload).
CREATE TABLE IF NOT EXISTS cms_contents (
    id TEXT PRIMARY KEY NOT NULL,
    content_model_id TEXT NOT NULL
        REFERENCES cms_content_models (id)
        ON DELETE RESTRICT,
    payload_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_contents_model_id
    ON cms_contents (content_model_id);

CREATE INDEX IF NOT EXISTS idx_cms_contents_updated_at
    ON cms_contents (updated_at);
