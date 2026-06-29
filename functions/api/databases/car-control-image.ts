/**
 * GET /api/databases/car-control-image?key=source/<id>
 *
 * Liefert ein ID-basiertes Bild aus dem NEUEN Bildspeicher (R2 `vehicleimages`)
 * für die neue Kontroll-Ansicht. Der Schlüssel kommt aus der Datenbank
 * (`original_r2_key` / `r2_key`), z. B. `source/01KVJ…`.
 *
 * Nur für angemeldete Dashboard-Nutzer. Der Schlüssel wird streng validiert
 * (nur `source/`, `scaled/`, `shadow/` + ULID-Zeichen) — kein beliebiger
 * R2-Zugriff. Bild wird in Originalgröße ausgeliefert + edge-gecacht.
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const KEY_RE = /^(?:source|scaled|shadow)\/[A-Za-z0-9_-]{8,64}$/;

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
  waitUntil,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const bucket = env.vehicleimages;
  if (!bucket) {
    return jsonResponse(
      {
        error:
          "R2-Binding `vehicleimages` fehlt. Im Pages-Projekt → Settings → Functions → R2-Bindings als `vehicleimages` ergänzen.",
      },
      { status: 503 },
    );
  }

  const p = new URL(request.url).searchParams;
  const key = (p.get("key") || "").trim();
  if (!KEY_RE.test(key)) {
    return jsonResponse(
      { error: "Ungültiger oder fehlender Bild-Schlüssel." },
      { status: 400 },
    );
  }

  // Edge-Cache (das Bild zu einem Schlüssel ist unveränderlich).
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), {
    method: "GET",
  });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const obj = await bucket.get(key);
  if (!obj || !obj.body) {
    return new Response("not found", { status: 404 });
  }

  const headers = new Headers();
  headers.set("content-type", obj.httpMetadata?.contentType || "image/png");
  // `public`, damit caches.default.put() die Antwort wirklich speichert
  // (Auth-Prüfung liegt VOR dem Cache-Lookup; Bild ist nicht nutzerspezifisch).
  headers.set("cache-control", "public, max-age=3600");
  const resp = new Response(obj.body, { status: 200, headers });
  waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
};
