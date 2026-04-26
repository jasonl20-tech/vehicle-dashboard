-- D1: Land als ISO-3166-Alpha-2 am Kunden (z. B. DE, AT). Spaltenname `location`.
-- Nullable. Entspricht deinem CRM-Schema; `standort` wird im Code nicht mehr erwartet.
ALTER TABLE customers ADD COLUMN location TEXT;
