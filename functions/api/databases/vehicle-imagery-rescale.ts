/**
 * POST /api/databases/vehicle-imagery-rescale
 *
 * Skaliert die Außen-Ansichten eines Produktions-Autos NEU — mit einer
 * benutzerdefinierten Höhe — und schleust die Ergebnisse über den normalen
 * Kontroll-Ablauf (Modus „Skalierung"). Sie müssen dort erst **freigegeben**
 * werden, bevor sie die Produktionsbilder überschreiben (das übernimmt der
 * bestehende `finalizeScaling`-Schritt anhand des identischen Bild-Pfads).
 *
 * Body: { id: number (Produktions-/Public-ID), hohe: number }
 *
 * Ablauf:
 *  1. Produktions-Auto laden (`vehicleimagery_public_storage`).
 *  2. Passende Kontroll-Zeile finden/anlegen (`vehicleimagery_controlling_storage`)
 *     und die Höhe dort speichern (Spalte `hohe`). Der `job-abarbeiter` liest
 *     diese Höhe beim Skalieren (statt des festen Defaults 1550).
 *  3. Pro Außen-Ansicht: Quell-`#trp` sicherstellen (Kontroll-Bucket bevorzugt,
 *     sonst aus dem Public-Bucket kopieren), alte `#skaliert`/`#skaliert_weiß`
 *     entfernen, vorhandene `scaling`-Kontrollzeilen löschen (→ wieder „offen"),
 *     und einen Transparenz-Job (`check = 0`) anlegen, den der Cron →
 *     `scaleImage` neu skaliert.
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import { controllingStorageR2KeyFromViewToken } from "../../_lib/vehicleImageryR2Key";

/** Außen-Ansichten, die proportional skaliert werden. */
const EXTERIOR_SLUGS = [
  "front",
  "rear",
  "left",
  "right",
  "front_left",
  "front_right",
  "rear_left",
  "rear_right",
] as const;

/** Sinnvolle Grenzen für die Höhe (mm). Schützt vor Riesen-Leinwänden / OOM im Skalierer. */
const HOHE_MIN = 1000;
const HOHE_MAX = 3000;

type CarRow = {
  id: number;
  marke: string | null;
  modell: string | null;
  jahr: number | null;
  body: string | null;
  trim: string | null;
  farbe: string | null;
  resolution: string | null;
  format: string | null;
};

const seg = (s: string | number | null | undefined): string =>
  String(s ?? "").trim();

/** R2-/CDN-Pfad-Präfix (Keys sind dekodiert abgelegt, Roh-Felder als Prefix). */
function prefixOf(r: CarRow): string {
  return `v1/${seg(r.format)}/${seg(r.resolution)}/${seg(r.marke)}/${seg(r.modell)}/${seg(r.jahr)}/${seg(r.body)}/${seg(r.trim)}/${seg(r.farbe)}/`;
}

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const db = env.vehicledatabase;
  if (!db) {
    return jsonResponse(
      { error: "D1-Binding `vehicledatabase` fehlt." },
      { status: 503 },
    );
  }
  const controll = env.controllbucket;
  const pub = env.publicbucket;
  if (!controll || !pub) {
    return jsonResponse(
      {
        error:
          "R2-Bindings `controllbucket` (vehicleimagery-controlling) und `publicbucket` (vehicleimagery-public) müssen gesetzt sein.",
      },
      { status: 503 },
    );
  }

  let body: { id?: unknown; hohe?: unknown };
  try {
    body = (await request.json()) as { id?: unknown; hohe?: unknown };
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) {
    return jsonResponse({ error: "id ungültig" }, { status: 400 });
  }
  const hohe = Math.round(Number(body.hohe));
  if (!Number.isFinite(hohe) || hohe < HOHE_MIN || hohe > HOHE_MAX) {
    return jsonResponse(
      {
        error: `Höhe muss eine Zahl zwischen ${HOHE_MIN} und ${HOHE_MAX} sein (Fahrzeughöhe in mm).`,
      },
      { status: 400 },
    );
  }

  // 1. Produktions-Auto laden.
  const prod = await db
    .prepare(
      `SELECT id, marke, modell, jahr, body, trim, farbe, resolution, format
       FROM vehicleimagery_public_storage WHERE id = ?`,
    )
    .bind(id)
    .first<CarRow>();
  if (!prod) {
    return jsonResponse(
      { error: "Produktions-Auto nicht gefunden" },
      { status: 404 },
    );
  }

  // 2. Passende Kontroll-Zeile finden oder anlegen.
  const existing = await db
    .prepare(
      `SELECT id FROM vehicleimagery_controlling_storage
       WHERE marke = ? AND modell = ? AND jahr = ?
         AND ifnull(body,'') = ? AND ifnull(trim,'') = ?
         AND ifnull(farbe,'') = ? AND ifnull(resolution,'') = ?
         AND ifnull(format,'') = ?`,
    )
    .bind(
      prod.marke,
      prod.modell,
      prod.jahr,
      seg(prod.body),
      seg(prod.trim),
      seg(prod.farbe),
      seg(prod.resolution),
      seg(prod.format),
    )
    .first<{ id: number }>();

  let controllingId: number;
  if (existing) {
    controllingId = existing.id;
  } else {
    const ins = await db
      .prepare(
        `INSERT INTO vehicleimagery_controlling_storage
          (marke, modell, jahr, body, trim, farbe, resolution, format, views, sonstiges, active, last_updated, hohe)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', 1, CURRENT_TIMESTAMP, ?)`,
      )
      .bind(
        prod.marke,
        prod.modell,
        prod.jahr,
        prod.body,
        prod.trim,
        prod.farbe,
        prod.resolution,
        prod.format,
        hohe,
      )
      .run();
    controllingId = Number(ins.meta.last_row_id);
  }

  const prefix = prefixOf(prod);

  // 3. Pro Außen-Ansicht neu skalieren.
  const scheduled: string[] = [];
  const skipped: string[] = [];
  let copied = 0;

  for (const slug of EXTERIOR_SLUGS) {
    // R2-Keys: DEKODIERT (Buckets speichern dekodiert).
    const trpDec = `${prefix}${slug}#trp.png`;
    const skaliertDec = `${prefix}${slug}#skaliert.png`;
    const vorherDec = `${prefix}${slug}#vorher.png`;
    // DB-Key (controll_status.key): ENCODED — wie der Rest der Pipeline; scaleImage
    // ruft genau einmal decodeURIComponent darauf auf.
    const trpKeyEnc = controllingStorageR2KeyFromViewToken(prod, `${slug}#trp`);

    // Quelle sicherstellen: Kontroll-Bucket bevorzugt (un-skaliertes #trp),
    // sonst aus dem Public-Bucket kopieren.
    const inControll = await controll.head(trpDec);
    if (!inControll) {
      const fromPub = await pub.get(trpDec);
      if (!fromPub) {
        skipped.push(slug);
        continue;
      }
      await controll.put(trpDec, await fromPub.arrayBuffer(), {
        httpMetadata: { contentType: "image/png" },
      });
      copied++;
    }

    // „Vorher"-Schnappschuss für den Vorher/Nachher-Vergleich in der Skalierung:
    // das aktuell skalierte Bild sichern. Quelle: vorhandenes Kontroll-#skaliert,
    // sonst das aktuelle Produktionsbild (#trp aus Public). KEIN Vorab-Löschen der
    // #skaliert-Bilder — der Skalierer überschreibt denselben Key; so geht bei einem
    // Skalier-Fehler kein bereits fertiges Ergebnis verloren.
    // Nur sichern, wenn noch KEIN #vorher existiert — so bleibt bei mehrfachem
    // Neu-Skalieren ohne Freigabe das ursprüngliche Bild als „Vorher" erhalten
    // (statt durch ein bereits neu skaliertes Bild ersetzt zu werden). Nach der
    // Freigabe löscht finalizeScaling den Schnappschuss wieder.
    const hasVorher = await controll.head(vorherDec);
    if (!hasVorher) {
      const curScaled = await controll.get(skaliertDec);
      const beforeSrc = curScaled ?? (await pub.get(trpDec));
      if (beforeSrc) {
        await controll.put(vorherDec, await beforeSrc.arrayBuffer(), {
          httpMetadata: { contentType: "image/png" },
        });
      }
    }

    // Vorhandene scaling-Kontrollzeilen entfernen → Ansicht zählt wieder als „offen".
    await db
      .prepare(
        `DELETE FROM controll_status WHERE vehicle_id = ? AND mode = 'scaling'
          AND (view_token = ? OR view_token = ?)`,
      )
      .bind(controllingId, `${slug}#skaliert`, `${slug}#skaliert_weiß`)
      .run();

    // Transparenz-Job (check = 0) → Cron → scaleImage skaliert neu (mit Höhe).
    await db
      .prepare(
        `INSERT INTO controll_status (vehicle_id, view_token, mode, status, "check", key)
         VALUES (?, ?, 'transparency', 'correct', 0, ?)
         ON CONFLICT(vehicle_id, view_token, mode)
         DO UPDATE SET status = 'correct', "check" = 0, key = excluded.key, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(controllingId, slug, trpKeyEnc)
      .run();

    scheduled.push(slug);
  }

  // Höhe auf der Kontroll-Zeile speichern (scaleImage liest sie beim Skalieren).
  await db
    .prepare(
      `UPDATE vehicleimagery_controlling_storage SET hohe = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(hohe, controllingId)
    .run();

  if (scheduled.length === 0) {
    return jsonResponse(
      {
        error:
          "Keine Außen-Ansicht mit Quellbild (#trp) gefunden — nichts zu skalieren.",
        skipped,
      },
      { status: 422 },
    );
  }

  return jsonResponse(
    {
      ok: true,
      controllingId,
      hohe,
      scheduled,
      skipped,
      copied,
      hint: "Neu skaliert. Die Bilder erscheinen in Kontrolle → Skalierung und müssen dort erst freigegeben werden, bevor sie die Produktion überschreiben.",
    },
    { status: 200 },
  );
};
