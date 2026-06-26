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
import {
  demoCarAllowed,
  demoColorAllowed,
  getValidDemoLink,
  recordDemoHit,
  snapDemoWidth,
  type DemoLinkConfig,
} from "../../_lib/demoLinks";

/**
 * Lädt die Demo-Link-Konfiguration mit kurzem Edge-Cache (60 s). Ohne diesen
 * Cache löste JEDE Demo-Bildanfrage — auch wenn das Bild selbst im Cache liegt —
 * einen D1-Read aus (eine Demo-Seite lädt Dutzende Bilder). Negativ-Ergebnisse
 * werden kurz (20 s) gecacht, um D1 bei wiederholt ungültigem Token zu schonen.
 * Ablauf wird beim Lesen erneut geprüft (Sperrung greift mit ≤60 s Verzögerung).
 */
async function loadDemoCfgCached(
  env: AuthEnv,
  token: string,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<DemoLinkConfig | null> {
  const cache = caches.default;
  const key = new Request(
    `https://demo-cfg.cache/${encodeURIComponent(token)}`,
    { method: "GET" },
  );
  const now = Math.floor(Date.now() / 1000);
  const hit = await cache.match(key);
  if (hit) {
    try {
      const j = (await hit.json()) as
        | (DemoLinkConfig & { __invalid?: boolean })
        | null;
      if (!j || j.__invalid) return null;
      if (j.status !== "active" || (j.expiresAt || 0) < now) return null;
      return j;
    } catch {
      /* defekter Cache-Eintrag → frisch laden */
    }
  }
  const cfg = await getValidDemoLink(env, token);
  const ttl = cfg ? 60 : 20;
  waitUntil(
    cache.put(
      key,
      new Response(JSON.stringify(cfg ?? { __invalid: true }), {
        headers: {
          "content-type": "application/json",
          "cache-control": `public, max-age=${ttl}`,
        },
      }),
    ),
  );
  return cfg;
}

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
  // Vorgefertigte Auflösungs-Presets (laut OpenAPI-Spec). Unbekanntes → default.
  const ALLOWED_RES = new Set([
    "default",
    "thumb",
    "small",
    "medium",
    "large",
    "full",
  ]);
  const resIn = (p.get("resolution") || "default").trim();
  const resolution = ALLOWED_RES.has(resIn.toLowerCase()) ? resIn : "default";
  // Fahrzeug am Boden verankern (neu).
  const ground = ["1", "true", "yes"].includes(
    (p.get("ground") || "").trim().toLowerCase(),
  );
  // Spiegelung (neues API-Feature): Bild horizontal spiegeln.
  const mirroring = ["1", "true", "yes"].includes(
    (p.get("mirroring") || "").trim().toLowerCase(),
  );

  // --- Auth: Dashboard-Session ODER gültiges Demo-Token (dt) ---
  // Angemeldete Nutzer haben Vollzugriff. Ohne Session ist nur ein gültiges
  // Demo-Token erlaubt, dessen Scope unten HART geprüft wird (vor Cache + Key).
  const user = await getCurrentUser(env, request);
  const dt = (p.get("dt") || "").trim();
  let demoCfg: DemoLinkConfig | null = null;
  if (!user) {
    if (!dt) {
      return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
    }
    demoCfg = await loadDemoCfgCached(env, dt, waitUntil);
    if (!demoCfg) {
      return jsonResponse(
        { error: "Demo-Link ungültig, gesperrt oder abgelaufen." },
        { status: 403 },
      );
    }
  }

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

  // --- Demo-Scope: HART erzwingen, BEVOR Cache/Voll-Key berührt werden ---
  // Nur die im Link gespeicherten Fahrzeuge + Farben sind erlaubt; sonst wäre
  // der Demo-Link ein offenes Tor auf die gesamte Kunden-API.
  const isDemo = !!demoCfg;
  if (demoCfg) {
    if (!demoCarAllowed(demoCfg, { marke, modell, jahr, body, trim })) {
      return new Response("vehicle not in demo scope", { status: 403 });
    }
    if (!demoColorAllowed(demoCfg, farbe)) {
      return new Response("color not in demo scope", { status: 403 });
    }
  }

  // Für Demo-Anfragen die Parameter-Oberfläche begrenzen (Kostenschutz): festes
  // Format/Auflösung, keine freie Höhe, eingerastete Breite. Schatten/Ground/
  // Transparenz/Mirroring sind erlaubt — Teil der Demo, je nur ~2 Zustände.
  // Demo liefert immer WebP: ~15–20× kleiner als PNG, optisch praktisch
  // identisch (PNG wird im Showcase nicht gebraucht).
  const effFormat = isDemo ? "webp" : format;
  // WebP wird bewusst niedrig komprimiert (klein/schnell). PNG ist verlustfrei,
  // dort bleibt der höhere Standardwert.
  const imgQuality = effFormat === "webp" ? 40 : 55;
  const effResolution = isDemo ? "default" : resolution;
  const effHeight = isDemo ? null : height;
  // Demo: Breite auf eine feste Whitelist einrasten (verhindert Cache-Umgehung
  // durch beliebige w-Werte und damit massenhafte teure Voll-Key-Renderings).
  const effWidth = isDemo ? snapDemoWidth(width) : width;
  // Transparenter Hintergrund — der API-Parameter heißt `transparency` (NICHT
  // `transparent`). Ground und Mirroring brauchen laut API zwingend eine
  // transparente Variante → hier mit-erzwingen, sonst werden sie ignoriert
  // (genau das Symptom „kein sichtbarer Unterschied").
  const transparency = transparent || ground || mirroring;

  // Edge-Cache prüfen. Kanonischer Key aus den EFFEKTIVEN Parametern (ohne `dt`)
  // → Demo- und Dashboard-Anfragen für dasselbe Bild teilen sich den Cache, und
  // das interne Token taucht nie im Cache-Key auf.
  const canon = new URL("https://car-image.cache/");
  const cp = canon.searchParams;
  cp.set("marke", marke);
  cp.set("modell", modell);
  cp.set("jahr", jahr);
  cp.set("body", body);
  cp.set("trim", trim);
  cp.set("farbe", farbe);
  cp.set("view", view);
  cp.set("w", String(effWidth));
  if (effHeight) cp.set("h", String(effHeight));
  if (effFormat !== "png") cp.set("format", effFormat);
  if (effResolution !== "default") cp.set("resolution", effResolution);
  if (shadow) cp.set("shadow", "1");
  if (transparency) cp.set("transparency", "1");
  if (ground) cp.set("ground", "1");
  if (mirroring) cp.set("mirroring", "1");
  // Mit dem Spezial-Key liefert Mirroring ein ANDERES Bild (echte Reflexion) als
  // zuvor mit dem rechtelosen Key → eigener Cache-Key, sonst würde ein evtl. alt
  // gecachtes Nicht-Reflexions-Bild den Effekt weiter verdecken.
  if (mirroring && env.CAR_DB_MIRRORING_KEY) cp.set("mk", "1");
  const cache = caches.default;
  const cacheKey = new Request(canon.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // Cache-MISS → echter Kunden-API-Aufruf steht bevor. Für Demo-Links hier das
  // Tageslimit prüfen (nur Misses kosten etwas; Cache-Hits oben zählen nicht).
  if (demoCfg) {
    const within = await recordDemoHit(env, dt);
    if (!within) {
      return new Response("demo rate limit reached", {
        status: 429,
        headers: { "cache-control": "no-store" },
      });
    }
  }

  const seg = (s: string) => encodeURIComponent(s);
  const apiUrl =
    `${API_BASE}/api/${seg(marke)}/${seg(modell)}/${seg(jahr)}/${seg(body)}/${seg(trim)}/${seg(view)}` +
    `?format=${seg(effFormat)}&resolution=${seg(effResolution)}&color=${seg(farbe)}` +
    (shadow ? `&shadow=true` : "") +
    (transparency ? `&transparency=true` : "") +
    (ground ? `&ground=true` : "") +
    (mirroring ? `&mirroring=true` : "") +
    // Explizite Maße nur senden, wenn eine Höhe angefragt wurde.
    (effHeight ? `&width=${effWidth}&height=${effHeight}` : "");

  // Mirroring (Boden-Reflexion) ist API-seitig hinter dem Key-Recht
  // `allow_mirroring` gesperrt → für Mirroring-Anfragen den Spezial-Key nutzen
  // (Fallback: Normal-Key, dann bleibt Mirroring allerdings wirkungslos).
  const fetchKey =
    mirroring && env.CAR_DB_MIRRORING_KEY ? env.CAR_DB_MIRRORING_KEY : apiKey;

  // 1) Kunden-API fragen → signierte image_url holen.
  let imageUrl: string | null = null;
  try {
    const r = await fetch(apiUrl, { headers: { "x-api-key": fetchKey } });
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
          width: effWidth,
          ...(effHeight ? { height: effHeight } : {}),
          quality: imgQuality,
          fit: "contain",
          // Liefert das gewünschte Format aus (auch wenn die Quelle PNG ist).
          format: effFormat,
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
      "content-type": CT_BY_FORMAT[effFormat] || "image/png",
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
