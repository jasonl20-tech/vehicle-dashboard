-- Tabelle in derselben D1-DB anlegen, die Ihr schon an `website` (submissions, …) bindet.
--   wrangler d1 execute <DB-NAME> --file=./d1-crm-customers.sql
--   (Kopie: d1/migrations/0004_customers.sql)
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  email TEXT NOT NULL UNIQUE,
  company TEXT,
  status TEXT DEFAULT 'Neu'
);
