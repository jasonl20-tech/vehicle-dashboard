-- Email-Jobs (Versand-Queue / -Log) für transaktionale Mails.
-- Liegt in derselben Website-D1 (env.website) wie `customers`,
-- `submissions` und `email_templates`.
--
--   wrangler d1 execute <DB-NAME> --file=./d1/migrations/0008_email_jobs.sql
--
-- Hinweis: Die Tabelle wird vom externen Mail-Worker geschrieben.
-- Im Dashboard ist sie nur LESEND einsehbar (Email Logs). Diese Datei
-- existiert primär als Spec/Onboarding — sie ist idempotent und kann
-- gefahrlos auf einer bereits gefüllten DB ausgeführt werden.

CREATE TABLE IF NOT EXISTS email_jobs (
    id TEXT PRIMARY KEY NOT NULL,                       -- UUID / KSUID
    recipient_data TEXT NOT NULL,                       -- JSON (Empfänger + Template-Variablen)
    template_id TEXT REFERENCES email_templates(id),
    custom_subject TEXT,                                -- Override (optional)
    custom_body_html TEXT,                              -- Override (optional)
    status TEXT DEFAULT 'pending',                      -- 'pending' | 'processing' | 'sent' | 'failed'
    error_message TEXT,
    retries INTEGER DEFAULT 0,
    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    from_email TEXT NOT NULL DEFAULT 'no-reply@vehicleimagery.com'
);

-- Lese-Indizes für die Logs-Liste (Sortierung + Filter im Dashboard).
CREATE INDEX IF NOT EXISTS idx_email_jobs_created_at
    ON email_jobs (created_at);
CREATE INDEX IF NOT EXISTS idx_email_jobs_status
    ON email_jobs (status);
CREATE INDEX IF NOT EXISTS idx_email_jobs_template_id
    ON email_jobs (template_id);
CREATE INDEX IF NOT EXISTS idx_email_jobs_sent_at
    ON email_jobs (sent_at);
