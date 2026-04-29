-- Asset-Manager: Metadaten zu Dateien, die im R2-Bucket `assets`
-- (Custom-Domain `assets.vehicleimagery.com`) liegen. Der R2-Bucket
-- ist der Source-of-Truth für die Bytes; D1 speichert Metadaten und
-- die virtuelle Ordner-Struktur, damit der Asset-Browser im Dashboard
-- Suche, Sortierung und Custom-Felder (alt-text, description) ohne
-- R2-Listing-Roundtrips bedienen kann.
--
-- Auf die Website-D1 anwenden (env.website), in der auch
-- `customers`, `submissions` und `email_templates` liegen.
--
--   wrangler d1 execute <DB-NAME> --file=./d1/migrations/0008_assets.sql
--
-- Idempotent: existierende Tabellen werden nicht angerührt.

-- ─── assets: pro Datei ein Datensatz ────────────────────────────────
-- `key`        eindeutiger R2-Objektpfad (z. B. `email/banner.png`)
-- `folder`     virtueller Ordnerpfad ohne Dateinamen (z. B. `email`),
--              `''` bedeutet Root.
-- `name`       Dateiname mit Extension.
-- `size`       Bytes.
-- `content_type`  z. B. `image/png`.
-- `kind`       'file' für echte Dateien, 'folder' für leere Marker-
--              Ordner. Marker werden in der UI als Ordner gezeigt,
--              haben aber kein R2-Objekt mit Inhalt.
-- `alt_text`   Optional: Default-Alt-Text für Bild-Verwendung in Mails.
-- `description` Optional: Notiz für interne Dokumentation.
-- `uploaded_by` Benutzer-ID (`user.id`) oder NULL.

CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    folder TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    kind TEXT NOT NULL DEFAULT 'file' CHECK (kind IN ('file','folder')),
    alt_text TEXT,
    description TEXT,
    uploaded_by INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_folder ON assets (folder);
CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets (kind);
CREATE INDEX IF NOT EXISTS idx_assets_uploaded_at ON assets (uploaded_at);
CREATE INDEX IF NOT EXISTS idx_assets_name ON assets (name);
