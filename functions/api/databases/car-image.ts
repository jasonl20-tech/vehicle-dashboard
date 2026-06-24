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
// Vom Proxy unterstützte Ansichten: 8 Außen + 2 Innen (die Kunden-API liefert sie).
const ALLOWED_VIEWS = new Set([
  "front",
  "rear",
  "left",
  "right",
  "front_left",
  "front_right",
  "rear_left",
  "rear_right",
  "dashboard",
  "center_console",
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
  const view =
    (p.get("view") || "front_right").trim().toLowerCase() || "front_right";
  const width = Math.min(1600, Math.max(48, Number(p.get("w") || 160) || 160));
  // Optional explizite Höhe (neues API-Feature: Breite & Höhe anfragbar).
  const hRaw = Number(p.get("h") || 0) || 0;
  const height = hRaw > 0 ? Math.min(1600, Math.max(48, hRaw)) : null;
  // Ausgabeformat (neu: PNG/JPEG/WebP/AVIF). Unbekanntes → png.
  const ALLOWED_FORMATS = new Set(["png", "jpeg", "webp", "avif"]);
  const fmtIn = (p.get("format") || "png").trim().toLowerCase();
  const format = ALLOWED_FORMATS.has(fmtIn) ? fmtIn : "png";
  // Schatten-Variante (neues API-Feature).
  const shadow = ["1", "true", "yes"].includes(
    (p.get("shadow") || "").trim().toLowerCase(),
  );
  // Echtes Freisteller-PNG anfragen (Hintergrund serverseitig entfernt).
  const transparent = ["1", "true", "yes"].includes(
    (p.get("transparent") || "").trim().toLowerCase(),
  );
  // Vorgefertigte Auflösung (neu). Unbekanntes → default.
  const ALLOWED_RES = new Set(["default", "1k", "2k", "4k"]);
  const resIn = (p.get("resolution") || "default").trim();
  const resolution = ALLOWED_RES.has(resIn.toLowerCase()) ? resIn : "default";
  // Fahrzeug am Boden verankern (neu).
  const ground = ["1", "true", "yes"].includes(
    (p.get("ground") || "").trim().toLowerCase(),
  );

  if (!marke || !modell || !jahr) {
    return jsonResponse(
      { error: "marke, modell und jahr sind erforderlich." },
      { status: 400 },
    );
  }
  // Unbekannte Ansicht NICHT still auf front_right umbiegen → ehrlicher 404,
  // damit die UI einen Platzhalter zeigt statt eines falschen Bildes.
  if (!ALLOWED_VIEWS.has(view)) {
    return new Response("unsupported view", { status: 404 });
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
    `?format=${seg(format)}&resolution=${seg(resolution)}&color=${seg(farbe)}` +
    (shadow ? `&shadow=true` : "") +
    (transparent ? `&transparent=true` : "") +
    (ground ? `&ground=true` : "") +
    // Explizite Maße nur senden, wenn eine Höhe angefragt wurde.
    (height ? `&width=${width}&height=${height}` : "");

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
      cf: {
        image: {
          width,
          ...(height ? { height } : {}),
          quality: 55,
          fit: "contain",
          // Liefert das gewünschte Format aus (auch wenn die Quelle PNG ist).
          format,
        },
      },
    } as RequestInit);
  } catch {
    return new Response("image error", { status: 502 });
  }
  if (!img.ok || !img.body) {
    return new Response("image error", { status: 502 });
  }

  const CT_BY_FORMAT: Record<string, string> = {
    png: "image/png",
    jpeg: "image/jpeg",
    webp: "image/webp",
    avif: "image/avif",
  };
  const resp = new Response(img.body, {
    status: 200,
    headers: {
      "content-type": CT_BY_FORMAT[format] || "image/png",
      // Bilder pro Auto/Ansicht/Farbe sind praktisch unveränderlich:
      //  - max-age=86400        → Browser nutzt das Bild 1 Tag ohne Netzaufruf
      //                           (Farbwechsel/Zurückblättern = sofort)
      //  - stale-while-revalidate → danach bis 7 Tage sofort aus dem Cache,
      //                           Aktualisierung läuft im Hintergrund
      // Läuft der (signierte) CDN-Link der Kunden-API ab, holt der Proxy beim
      // nächsten Cache-Miss automatisch einen frischen Link.
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
  waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
};
