-- D1 (website-Binding): Test-/Trial-Formulare (gleiche DB wie submissions)
-- Anwenden wie bei anderen Migrationen auf die `website`-Datenbank.

CREATE TABLE IF NOT EXISTS trial_submissions (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  form_tag TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  metadata TEXT NOT NULL CHECK (json_valid(metadata)),
  spam BOOLEAN DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_trial_submissions_created_at
  ON trial_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_submissions_spam
  ON trial_submissions (spam);
