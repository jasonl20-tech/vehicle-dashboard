/**
 * POST /api/databases/car-generate-save
 *
 * Speichert generierte Auto-Bilder ins NEUE System: pro Ansicht das Bild nach
 * R2 `vehicleimages` als `source/<ulid>` + eine Zeile in `fahrzeugliste`
 * (transparent=0, shadow=0, kontrolliert=0 → „offen zur Kontrolle").
 * Danach erscheinen sie in der neuen Kontroll-Ansicht (/control-platform/neu);
 * nach Freigabe (kontrolliert=1) übernimmt der Motor Freistellen/Skalieren/Schatten.
 *
 * Body: { marke, modell, jahr, body?, trim?, farbe?, items: [{view, imageUrl}] }
 *   imageUrl = öffentliche URL (z. B. kie.ai-Ergebnis) ODER data:-URL.
 * Nur angemeldete Nutzer.
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import { clearRegenLock, regenLockKey } from "../../_lib/regenLock";

const EXTERIOR = new Set([
  "front",
  "rear",
  "left",
  "right",
  "front_left",
  "front_right",
  "rear_left",
  "rear_right",
]);
const INTERIOR = new Set(["dashboard", "center_console"]);

// Crockford-Base32-ULID (26 Zeichen), passend zum bestehenden `source/<ulid>`.
const ENC = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function ulid(): string {
  let t = Date.now();
  let ts = "";
  for (let i = 0; i < 10; i++) {
    ts = ENC[t % 32] + ts;
    t = Math.floor(t / 32);
  }
  const rnd = new Uint8Array(16);
  crypto.getRandomValues(rnd);
  let r = "";
  for (let i = 0; i < 16; i++) r += ENC[rnd[i] % 32];
  return ts + r;
}

const MAX_BYTES = 20_000_000;
// Nur kie.ai-Ergebnis-Hosts erlauben (kein SSRF auf beliebige/interne URLs).
function hostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "api.kie.ai" ||
    h.endsWith(".kie.ai") ||
    h === "tempfile.aiquickdraw.com" ||
    h.endsWith(".aiquickdraw.com")
  );
}

/** Liefert die Bytes eines Bildes (data:-URL oder erlaubte https-URL). null bei
 *  jedem Problem — KEINE Detail-Fehler (sonst SSRF-Orakel). */
async function bytesFromImage(
  src: string,
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const s = String(src || "").trim();
  if (s.startsWith("data:")) {
    const m = s.match(/^data:([^,]*),(.*)$/s);
    if (!m) return null;
    const header = m[1] || "";
    const ct = header.split(";")[0] || "image/png";
    const isB64 = /;base64/i.test(header);
    try {
      let bytes: ArrayBuffer;
      if (isB64) {
        const bin = atob(m[2]);
        const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        bytes = u.buffer;
      } else {
        bytes = new TextEncoder().encode(decodeURIComponent(m[2]))
          .buffer as ArrayBuffer;
      }
      return bytes.byteLength > MAX_BYTES ? null : { bytes, contentType: ct };
    } catch {
      return null;
    }
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !hostAllowed(u.hostname)) return null;
  let r: Response | null = null;
  try {
    r = await fetch(u.toString(), { redirect: "manual" });
  } catch {
    return null;
  }
  if (!r || !r.ok) return null;
  const ct = r.headers.get("content-type") || "image/png";
  if (!/^image\//i.test(ct)) return null;
  if (Number(r.headers.get("content-length") || 0) > MAX_BYTES) return null;
  const bytes = await r.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return null;
  return { bytes, contentType: ct };
}

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });

  const bucket = env.vehicleimages;
  const db = env.cardb;
  if (!bucket) {
    return jsonResponse(
      { error: "R2-Binding `vehicleimages` fehlt." },
      { status: 503 },
    );
  }
  if (!db) {
    return jsonResponse({ error: "D1-Binding `cardb` fehlt." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Ungültiger Body." }, { status: 400 });
  }

  const marke = String(body.marke || "").trim();
  const modell = String(body.modell || "").trim();
  const jahr = Number(body.jahr) || 0;
  // Identität wörtlich übernehmen (KEINE Basis/base/default-Defaults) — sonst
  // entstünde beim Nachgenerieren eine andere Variante als die Detail-Zeile.
  const carBody = String(body.body ?? "").trim();
  const trim = String(body.trim ?? "").trim();
  const farbe = String(body.farbe ?? "").trim();
  if (!marke || !modell || !jahr) {
    return jsonResponse(
      { error: "marke, modell und jahr erforderlich." },
      { status: 400 },
    );
  }

  const itemsRaw = Array.isArray(body.items) ? body.items : [];
  const items = itemsRaw
    .map((it) => {
      const o = (it || {}) as Record<string, unknown>;
      const rid = Number(o.replaceId);
      return {
        view: String(o.view || "").trim().toLowerCase(),
        imageUrl: String(o.imageUrl || "").trim(),
        replaceId: Number.isInteger(rid) && rid > 0 ? rid : 0,
      };
    })
    .filter(
      (it) =>
        it.imageUrl &&
        (EXTERIOR.has(it.view) || INTERIOR.has(it.view)),
    )
    .slice(0, 12);
  if (items.length === 0) {
    return jsonResponse(
      { error: "Keine gültigen Ansichten (view + imageUrl) übergeben." },
      { status: 400 },
    );
  }

  const INSERT = `INSERT OR IGNORE INTO fahrzeugliste
    (marke, modell, jahr, body, trim, farbe, "view", hohe, shadow, transparent,
     format, resolution, original_r2_key, r2_key, kontrolliert, ausgeschnitten,
     skaliert, fehler, hold, innen)
    VALUES (?,?,?,?,?,?,?, 0, 0, 0, 'png', 'default', ?, ?, 0, 1, 0, 0, 0, ?)`;

  // Wird ein R2-Schlüssel noch von irgendeiner Zeile referenziert?
  const stillReferenced = async (k: string): Promise<boolean> => {
    const r = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM fahrzeugliste WHERE r2_key = ?1 OR original_r2_key = ?1`,
      )
      .bind(k)
      .first<{ n: number }>();
    return Number(r?.n ?? 0) > 0;
  };
  const dropOldKey = async (k: unknown, newKey: string) => {
    const ks = k ? String(k) : "";
    if (
      ks &&
      ks !== newKey &&
      /^(source|scaled|shadow)\//.test(ks) &&
      !(await stillReferenced(ks))
    ) {
      await bucket.delete(ks).catch(() => {});
    }
  };

  const saved: { view: string; key: string }[] = [];
  const errors: { view: string; error: string }[] = [];
  for (const it of items) {
    let key: string | null = null;
    try {
      const img = await bytesFromImage(it.imageUrl);
      if (!img) {
        errors.push({ view: it.view, error: "Bild nicht ladbar." });
        continue;
      }
      key = `source/${ulid()}`;
      await bucket.put(key, img.bytes, {
        httpMetadata: { contentType: img.contentType || "image/png" },
      });

      if (it.replaceId) {
        // ERSETZEN: neues Bild ist schon gespeichert → bestehende Zeile in-place
        // auf den neuen Schlüssel umstellen (kontrolliert/fehler/hold zurück auf
        // offen). Erst danach das alte Objekt wegräumen (kein Datenverlust).
        const old = await db
          .prepare(
            `SELECT r2_key, original_r2_key FROM fahrzeugliste
             WHERE id = ? AND transparent = 0 AND shadow = 0`,
          )
          .bind(it.replaceId)
          .first<Record<string, unknown>>();
        if (!old) {
          await bucket.delete(key).catch(() => {});
          errors.push({ view: it.view, error: "Zeile nicht gefunden." });
          continue;
        }
        const upd = await db
          .prepare(
            // Freigegebene (kontrolliert=1) nicht ersetzen — erst zurücksetzen.
            `UPDATE fahrzeugliste
               SET r2_key = ?, original_r2_key = ?, kontrolliert = 0,
                   fehler = 0, hold = 0, last_updated = CURRENT_TIMESTAMP
             WHERE id = ? AND transparent = 0 AND shadow = 0
               AND kontrolliert = 0`,
          )
          .bind(key, key, it.replaceId)
          .run();
        const changed =
          (upd as { meta?: { changes?: number } })?.meta?.changes ?? 0;
        if (changed > 0) {
          saved.push({ view: it.view, key });
          await dropOldKey(old.r2_key, key);
          await dropOldKey(old.original_r2_key, key);
        } else {
          await bucket.delete(key).catch(() => {});
          errors.push({ view: it.view, error: "Ersetzen fehlgeschlagen." });
        }
      } else {
        // NEU einfügen.
        const innen = INTERIOR.has(it.view) ? 1 : 0;
        const res = await db
          .prepare(INSERT)
          .bind(marke, modell, jahr, carBody, trim, farbe, it.view, key, key, innen)
          .run();
        const changed =
          (res as { meta?: { changes?: number } })?.meta?.changes ?? 0;
        if (changed > 0) {
          saved.push({ view: it.view, key });
        } else {
          // Zeile existierte schon (INSERT OR IGNORE) → R2-Objekt wieder löschen.
          await bucket.delete(key).catch(() => {});
          errors.push({ view: it.view, error: "Ansicht existiert bereits." });
        }
      }
    } catch {
      if (key) await bucket.delete(key).catch(() => {});
      errors.push({ view: it.view, error: "Speichern fehlgeschlagen." });
    } finally {
      // Sperre IMMER lösen (auch bei den continue-Pfaden oben), sonst bliebe
      // die Ansicht bis zum TTL-Ablauf gesperrt.
      await clearRegenLock(
        db,
        regenLockKey({ marke, modell, jahr, body: carBody, trim, farbe }, it.view),
      );
    }
  }

  return jsonResponse({
    ok: true,
    saved: saved.length,
    views: saved.map((s) => s.view),
    errors,
  });
};
