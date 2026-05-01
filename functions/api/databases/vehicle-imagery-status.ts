/**
 * GET /api/databases/vehicle-imagery-status
 *
 * Aggregierte Kennzahlen zu `vehicleimagery_public_storage` (nur aktive Zeilen).
 * Ansichten werden wie in `_lib/vehicleImageryCatalog.parseViewNamesFromViewsField`
 * aus dem Feld `views` geparst.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import { parseViewNamesFromViewsField } from "../../_lib/vehicleImageryCatalog";

const CHUNK = 450;

type StatusSampleRow = {
  id: number;
  marke: string | null;
  modell: string | null;
  jahr: number | null;
  body: string | null;
  trim: string | null;
  farbe: string | null;
  resolution: string | null;
  format: string | null;
  views: string | null;
  last_updated: string | null;
};

export const onRequestGet: PagesFunction<AuthEnv> = async ({ env, request }) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  if (!env.vehicledatabase) {
    return jsonResponse(
      {
        error:
          "D1-Binding `vehicledatabase` fehlt. Im Cloudflare-Dashboard → Functions → D1, Variable `vehicledatabase` setzen.",
      },
      { status: 503 },
    );
  }
  const db = env.vehicledatabase;

  const angleCounts = new Map<string, number>();
  let lastId = 0;
  let activeRowCount = 0;
  let distinctViewsSum = 0;

  for (;;) {
    const res = await db
      .prepare(
        `SELECT id, views FROM vehicleimagery_public_storage
         WHERE active = 1 AND id > ?
         ORDER BY id ASC
         LIMIT ?`,
      )
      .bind(lastId, CHUNK)
      .all<{ id: number; views: string | null }>();
    const rows = res.results ?? [];
    if (rows.length === 0) break;
    for (const r of rows) {
      lastId = r.id;
      activeRowCount++;
      const names = parseViewNamesFromViewsField(r.views);
      distinctViewsSum += names.length;
      for (const n of names) {
        angleCounts.set(n, (angleCounts.get(n) ?? 0) + 1);
      }
    }
    if (rows.length < CHUNK) break;
  }

  const missingRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM vehicleimagery_public_storage
       WHERE active = 1 AND (farbe IS NULL OR trim(farbe) = '')`,
    )
    .first<{ n: number }>();
  const missingFarbeCount = missingRow?.n ?? 0;

  const sampleRes = await db
    .prepare(
      `SELECT id, marke, modell, jahr, body, trim, farbe, resolution, format, views, last_updated
       FROM vehicleimagery_public_storage
       WHERE active = 1 AND (farbe IS NULL OR trim(farbe) = '')
       ORDER BY last_updated DESC, id DESC
       LIMIT 80`,
    )
    .all<StatusSampleRow>();
  const missingFarbeSample = sampleRes.results ?? [];

  const viewCoverage = [...angleCounts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      pct:
        activeRowCount > 0
          ? Math.round((count * 1000) / activeRowCount) / 10
          : 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"));

  return jsonResponse(
    {
      activeRowCount,
      missingFarbeCount,
      missingFarbeSample,
      viewCoverage,
      avgDistinctViewsPerRow:
        activeRowCount > 0 ? distinctViewsSum / activeRowCount : 0,
    },
    { status: 200 },
  );
};
