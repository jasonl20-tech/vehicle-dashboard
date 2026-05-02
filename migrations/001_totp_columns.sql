-- TOTP (Authenticator-App) für Tabelle user
-- Nach dem Deploy per D1-Konsole / wrangler execute ausführen.

ALTER TABLE user ADD COLUMN totp_secret TEXT;
ALTER TABLE user ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user ADD COLUMN totp_verified_at TEXT;
