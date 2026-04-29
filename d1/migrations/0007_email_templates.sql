-- Email-Templates für transaktionale & Marketing-Mails.
-- Auf dieselbe Website-D1 anwenden (env.website), in der auch
-- `customers` und `submissions` liegen.
--
--   wrangler d1 execute <DB-NAME> --file=./d1/migrations/0007_email_templates.sql
--
-- Idempotent: existierende Tabelle wird nicht angerührt.

CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_templates_updated_at
    ON email_templates (updated_at);
