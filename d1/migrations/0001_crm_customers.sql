-- D1 (website-Binding): CRM-Stammdaten
-- Anwenden: lokal/CI z. B. `wrangler d1 migrations apply <DATABASE_NAME> --config …`
-- oder SQL im Cloudflare-Dashboard auf die `website`-Datenbank ausführen.

CREATE TABLE IF NOT EXISTS crm_customers (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  email TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'lead',
  email_status INTEGER DEFAULT 0,
  business_name TEXT,
  kv_key TEXT,
  additional_emails TEXT DEFAULT '[]' CHECK (json_valid(additional_emails)),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_email ON crm_customers (email);
CREATE INDEX IF NOT EXISTS idx_crm_customers_updated_at ON crm_customers (updated_at DESC);
