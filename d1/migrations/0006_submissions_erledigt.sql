-- Status „erledigt“ für Formular-Einsendungen (Dashboard: Abhaken)
-- Auf dieselbe Website-D1-Datenbank anwenden wie die anderen migrations.
-- Wenn `erledigt` schon existiert: die zwei ALTER TABLE-Zeilen auslassen/auskommentieren.

ALTER TABLE submissions ADD COLUMN erledigt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trial_submissions ADD COLUMN erledigt INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_submissions_erledigt ON submissions (erledigt);
CREATE INDEX IF NOT EXISTS idx_trial_submissions_erledigt ON trial_submissions (erledigt);
