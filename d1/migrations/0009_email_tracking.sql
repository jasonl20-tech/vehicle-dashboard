-- Email-Tracking + Erweiterung von `email_jobs` um Empfänger-Felder.
--
-- Liegt in derselben Website-D1 (env.website) wie `email_jobs`,
-- `email_templates`, `customers` und `submissions`.
--
--   wrangler d1 execute <DB-NAME> --file=./d1/migrations/0009_email_tracking.sql
--
-- Idempotent: existierende Tabellen/Spalten werden nicht angerührt.
-- Bei `ALTER TABLE … ADD COLUMN` wirft SQLite einen Fehler, falls die
-- Spalte bereits existiert — die Statements stehen daher in eigenen
-- Anweisungen, sodass nachfolgende Befehle bei einem Fehler nicht
-- abbrechen (siehe Hinweis unten).
--
-- Ablauf bei einem bereits gefüllten Schema:
--   1) `ALTER TABLE email_jobs ADD COLUMN …` ausführen — wenn die
--      Spalte schon existiert, den entsprechenden Befehl überspringen.
--      Cloudflare/`wrangler` bricht hier u. U. ab; in dem Fall einfach
--      die fehlenden Statements ergänzen oder einzeln laufen lassen.

-- ─── Empfänger-Felder auf email_jobs nachziehen ───────────────────────
--
-- `recipient_email` und `tracking_id` werden vom externen Mail-Worker
-- benötigt: `recipient_email` ist die direkte Zustelladresse (statt sie
-- jedes Mal aus `recipient_data` zu pulen), `tracking_id` ist die ID,
-- mit der Tracking-Pixel & Click-Redirects am Job hängen (kann
-- gleich der Job-ID sein oder ein separater Hash).
ALTER TABLE email_jobs ADD COLUMN recipient_email TEXT NOT NULL DEFAULT '';
ALTER TABLE email_jobs ADD COLUMN tracking_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_email_jobs_recipient_email
    ON email_jobs (recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_jobs_tracking_id
    ON email_jobs (tracking_id);

-- ─── email_tracking — Pixel/Open + Click-Events ───────────────────────
CREATE TABLE IF NOT EXISTS email_tracking (
    id TEXT PRIMARY KEY NOT NULL,                     -- UUID (vom Worker generiert)
    job_id TEXT NOT NULL
        REFERENCES email_jobs(id) ON DELETE CASCADE,  -- Verweis auf den Job
    event_type TEXT NOT NULL,                         -- 'open' | 'click'
    link_url TEXT,                                    -- nur bei 'click'
    user_agent TEXT,
    ip_address TEXT,
    metadata TEXT,                                    -- JSON: country, city, …
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Häufige Lese-Pfade abdecken: Job-Detail (alle Events eines Jobs),
-- Tracking-Statistik (Events pro Tag), Click-Heatmap etc.
CREATE INDEX IF NOT EXISTS idx_email_tracking_job_id
    ON email_tracking (job_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_event_type
    ON email_tracking (event_type);
CREATE INDEX IF NOT EXISTS idx_email_tracking_created_at
    ON email_tracking (created_at);
CREATE INDEX IF NOT EXISTS idx_email_tracking_job_event
    ON email_tracking (job_id, event_type);
