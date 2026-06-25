/**
 * GET /api/databases/car-brands
 *
 * Liefert die Liste der angebotenen Marken — holt sie serverseitig über die
 * Kunden-API (`/api/brands`, interner Voll-Key) und liefert nur die
 * normalisierten Markennamen aus. Lange gecacht (Marken ändern sich selten).
 * Öffentlich (in der Middleware freigeschaltet), damit auch der Demo-Link sie
 * ohne Login zeigen kann — es sind reine Marketing-Daten (keine Secrets).
 */

import { jsonResponse, type AuthEnv } from "../../_lib/auth";

const API_BASE = "https://api.vehicleimagery.com";

function normalizeBrands(data: unknown): string[] {
  let arr: unknown = data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    arr = o.brands ?? o.data ?? o.items ?? o.results ?? [];
  }
  const out: string[] = [];
  if (Array.isArray(arr)) {
    for (const b of arr) {
      if (typeof b === "string") out.push(b);
      else if (b && typeof b === "object") {
        const o = b as Record<string, unknown>;
        const name =
          o.name ?? o.brand ?? o.label ?? o.title ?? o.display ?? o.slug ?? o.id;
        if (typeof name === "string") out.push(name);
      }
    }
  }
  return Array.from(new Set(out.map((s) => s.trim()).filter(Boolean)));
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  env,
  waitUntil,
}) => {
  const apiKey = env.CAR_DB_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "CAR_DB_API_KEY fehlt." }, { status: 503 });
  }

  const cache = caches.default;
  const cacheKey = new Request("https://car-brands.cache/list", {
    method: "GET",
  });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let brands: string[] = [];
  try {
    const r = await fetch(`${API_BASE}/api/brands`, {
      headers: { "x-api-key": apiKey },
    });
    if (r.ok) brands = normalizeBrands(await r.json());
  } catch {
    /* leer → unten */
  }

  const resp = new Response(JSON.stringify({ brands }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Marken ändern sich selten → 1 Tag cachen, eine Woche stale-while-revalidate.
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
  // Nur ein erfolgreiches (nicht-leeres) Ergebnis cachen.
  if (brands.length) waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
};
