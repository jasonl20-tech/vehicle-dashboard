/**
 * GET /api/databases/car-image
 *
 * Thumbnail-Proxy für die Car-Database-Tabelle. Holt das Bild einer Ansicht
 * über die bestehende Kunden-API (api.vehicleimagery.com) mit einem INTERNEN
 * Voll-Key (`CAR_DB_API_KEY`) und liefert es verkleinert aus.
 *
 * Aktuell bedient die Kunden-API noch das ALTE System (vehicleimagery_public_storage);
 * sobald sie aufs neue System (fahrzeugliste/source) umgestellt ist, liefert
 * derselbe Proxy automatisch die neuen Bilder — ohne Änderung hier.
 *
 * Caching: Das Bild ist für alle Nutzer identisch → es wird im Edge-Cache
 * (`caches.default`) abgelegt. Wiederholte Aufrufe (anderer Nutzer, geleerter
 * Browser-Cache) treffen den Edge-Cache und sparen einen Aufruf der Kunden-API
 * mit dem internen Voll-Key. Der Cache-Lookup passiert ERST nach der
 * Auth-Prüfung.
 *
 * Params: marke, modell, jahr (Pflicht), body, trim, farbe, view (Default
 * front_right), w (Thumbnail-Breite, Default 160). Nur für angemeldete
 * Dashboard-Nutzer. Nicht gefunden/Fehler → 404/502 → UI zeigt Platzhalter.
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const API_BASE = "https://api.vehicleimagery.com";
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

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
  waitUntil,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const apiKey = env.CAR_DB_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { error: "CAR_DB_API_KEY fehlt (Pages-Environment)." },
      { status: 503 },
    );
  }

  const p = new URL(request.url).searchParams;
  const marke = (p.get("marke") || "").trim();
  const modell = (p.get("modell") || "").trim();
  const jahr = (p.get("jahr") || "").trim();
  const body = (p.get("body") || "Basis").trim() || "Basis";
  const trim = (p.get("trim") || "base").trim() || "base";
  const farbe = (p.get("farbe") || "default").trim() || "default";
  let view = (p.get("view") || "front_right").trim().toLowerCase();
  if (!EXTERIOR.has(view)) view = "front_right";
  const width = Math.min(1600, Math.max(48, Number(p.get("w") || 160) || 160));

  if (!marke || !modell || !jahr) {
    return jsonResponse(
      { error: "marke, modell und jahr sind erforderlich." },
      { status: 400 },
    );
  }

  // Edge-Cache prüfen (Key = normalisierte Proxy-URL, deterministisch aus den
  // Auto-Parametern). Lookup NACH der Auth-Prüfung — nicht angemeldete Anfragen
  // erhalten oben bereits 401, erreichen den Cache also nie.
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), {
    method: "GET",
  });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const seg = (s: string) => encodeURIComponent(s);
  const apiUrl =
    `${API_BASE}/api/${seg(marke)}/${seg(modell)}/${seg(jahr)}/${seg(body)}/${seg(trim)}/${seg(view)}` +
    `?format=png&resolution=default&color=${seg(farbe)}`;

  // 1) Kunden-API fragen → signierte image_url holen.
  let imageUrl: string | null = null;
  try {
    const r = await fetch(apiUrl, { headers: { "x-api-key": apiKey } });
    if (r.ok) {
      const data = (await r.json()) as unknown;
      const o = (Array.isArray(data) ? data[0] : data) as
        | Record<string, unknown>
        | null
        | undefined;
      const iu = o?.image_url;
      if (typeof iu === "string" && iu) imageUrl = iu;
    }
  } catch {
    /* unten als 404 behandelt */
  }
  if (!imageUrl) {
    // Fehlendes Bild kurz cachen → kein erneuter Kunden-API-Aufruf je Render.
    const miss = new Response("not found", {
      status: 404,
      headers: { "cache-control": "public, max-age=600" },
    });
    waitUntil(cache.put(cacheKey, miss.clone()));
    return miss;
  }

  // 2) Bild verkleinert holen. Cloudflare Image Resizing (cf.image) greift, wenn
  //    auf der Zone aktiv — sonst kommt das Originalbild. Netzwerkfehler →
  //    sauberes 502 (transient, daher nicht cachen).
  let img: Response;
  try {
    img = await fetch(imageUrl, {
      cf: { image: { width, quality: 55, fit: "contain" } },
    } as RequestInit);
  } catch {
    return new Response("image error", { status: 502 });
  }
  if (!img.ok || !img.body) {
    return new Response("image error", { status: 502 });
  }

  const resp = new Response(img.body, {
    status: 200,
    headers: {
      "content-type": img.headers.get("content-type") || "image/png",
      "cache-control": "public, max-age=3600",
    },
  });
  waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
};
