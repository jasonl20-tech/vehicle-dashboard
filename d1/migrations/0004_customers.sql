-- D1: gleiche Datenbank / Binding `website` wie `submissions`, `trial_submissions`, `newsletter`
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  email TEXT NOT NULL UNIQUE,
  company TEXT,
  status TEXT DEFAULT 'Neu'
);
