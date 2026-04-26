-- D1: Standort des Kunden als ISO-3166-Alpha-2 (z. B. "DE", "AT").
-- Nullable. Frontend liefert nur unterstützte Codes; serverseitig wird zusätzlich validiert.
ALTER TABLE customers ADD COLUMN standort TEXT;
