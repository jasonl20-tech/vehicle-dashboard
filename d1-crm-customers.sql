-- D1: In Cloudflare anlegen und als Binding `customers` in Pages/Workers verbinden.
--   wrangler d1 execute <DB-NAME> --file=./d1-crm-customers.sql
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  email TEXT NOT NULL UNIQUE,
  company TEXT,
  status TEXT DEFAULT 'Neu'
);
