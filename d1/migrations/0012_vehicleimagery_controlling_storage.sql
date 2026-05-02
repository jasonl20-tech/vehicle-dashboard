-- D1 `vehicledatabase` — Controlling-Parallel-Tabelle (gleiche Struktur wie Public, ohne genehmigt).

CREATE TABLE IF NOT EXISTS "vehicleimagery_controlling_storage" (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              marke TEXT,
              modell TEXT,
              jahr INTEGER,
              body TEXT,
              trim TEXT,
              farbe TEXT,
              resolution TEXT,
              format TEXT,
              views TEXT,
              sonstiges TEXT,
              active BOOLEAN DEFAULT 1,
              last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(marke, modell, jahr, body, trim, farbe, resolution, format)
            );
