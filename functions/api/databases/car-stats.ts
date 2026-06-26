/**
 * GET /api/databases/car-stats
 *
 * Liefert ein paar Eckdaten der Bild-API für die Demo — aktuell die
 * Gesamtzahl der Bilder (eine Zeile je Bild in `fahrzeugliste`, Binding
 * `cardb`). Öffentlich (Middleware-Allowlist), damit auch der Demo-Link es
 * zeigen kann — reine Zahl, kein Secret. 1 Stunde gecacht.
 */

import { jsonResponse, type AuthEnv } from "../../_lib/auth";

export const onRequestGet: PagesFunction<AuthEnv> = async ({ env, waitUntil }) => {
  const db = env.cardb;
  if (!db) return jsonResponse({ images: 0 });

  const cache = caches.default;
  const cacheKey = new Request("https://car-stats.cache/v1", { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let images = 0;
  try {
    const r = await db
      .prepare(`SELECT COUNT(*) AS n FROM fahrzeugliste`)
      .first<{ n: number }>();
    images = Number(r?.n ?? 0) || 0;
  } catch {
    images = 0;
  }

  const resp = new Response(JSON.stringify({ images }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
  // Nur einen echten (nicht-leeren) Wert cachen.
  if (images > 0) waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
};
