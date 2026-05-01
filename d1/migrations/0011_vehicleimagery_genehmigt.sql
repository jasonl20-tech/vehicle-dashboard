-- D1-Binding `vehicledatabase` / Tabelle `vehicleimagery_public_storage`
-- Nur ausführen, falls die Spalte `genehmigt` noch nicht existiert
-- (bei bestehenden Installationen mit Spalte schlägt ALTER fehl — dann überspringen).

ALTER TABLE vehicleimagery_public_storage
  ADD COLUMN genehmigt INTEGER NOT NULL DEFAULT 0;
