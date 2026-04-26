-- D1 (website-Binding) — Newsletter-Abonnenten
-- Anwenden auf die `website`-Datenbank (wie submissions / trial_submissions).

CREATE TABLE IF NOT EXISTS newsletter (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT NOT NULL CHECK (json_valid(metadata)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_newsletter_created_at ON newsletter (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter (active);
