/**
 * GET /api/website/submissions-by-country
 *
 * D1 `website` → `submissions`: Aggregation nach Ländercode in `metadata.country` (ISO-2, z. B. DE).
 * Nur Nicht-Spam: IFNULL(spam,0) = 0
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

function requireWebsiteDb(env: AuthEnv): D1Database | Response {
  if (!env.website) {
    return jsonResponse(
      {
        error:
          "D1-Binding `website` fehlt. Im Cloudflare-Dashboard → Functions → D1, Variable `website` (env.website) setzen.",
      },
      { status: 503 },
    );
  }
  return env.website;
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request: _req,
  env,
}) => {
  const user = await getCurrentUser(env, _req);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireWebsiteDb(env);
  if (db instanceof Response) return db;

  const { results } = await db
    .prepare(
      `SELECT
  UPPER(TRIM(
    json_extract(metadata, '$.country')
  )) AS iso2,
  COUNT(*) AS c
FROM submissions
WHERE json_valid(metadata) = 1
  AND length(TRIM(COALESCE(json_extract(metadata, '$.country'), ''))) > 0
  AND (IFNULL(spam, 0) = 0)
GROUP BY iso2
HAVING length(iso2) = 2`,
    )
    .all<{ iso2: string; c: number }>();

  const byIso2: Record<string, number> = {};
  let max = 0;
  for (const r of results ?? []) {
    if (!/^[A-Z]{2}$/.test(r.iso2)) continue;
    byIso2[r.iso2] = r.c;
    if (r.c > max) max = r.c;
  }
  const total = Object.values(byIso2).reduce((a, b) => a + b, 0);
  return jsonResponse(
    {
      byIso2,
      max,
      total,
      countryCount: Object.keys(byIso2).length,
    },
    { status: 200 },
  );
};
