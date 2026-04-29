-- Erweitert email_templates um den MJML-Quelltext, damit der Editor
-- den Source bewahrt und bei jedem Speichern frisch nach HTML
-- kompiliert. body_html bleibt das Render-Ergebnis (was der externe
-- Mail-Worker tatsächlich verschickt).
--
-- Anwenden auf dieselbe Website-D1 (env.website):
--   wrangler d1 execute <DB-NAME> --file=./d1/migrations/0008_email_templates_mjml.sql
--
-- Hinweis: SQLite/D1 erlaubt kein "ADD COLUMN IF NOT EXISTS".
-- Deshalb prüfen wir das Schema vorher manuell oder schlucken den
-- Fehler beim erneuten Anwenden – die Spalte ist NULLable, daher
-- vollständig rückwärtskompatibel zu bereits gespeicherten Zeilen.

ALTER TABLE email_templates ADD COLUMN body_mjml TEXT;
