/**
 * GET  /api/system/seed-missing-view-regen-status?slug=dashboard|center_console
 * POST /api/system/seed-missing-view-regen-status  Body: { slug: \"…\" }
 *
 * Nur Slugs aus `SEED_MISSING_VIEW_SLUGS`. Siehe `_lib/seedMissingViewRegenStatus`.
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  INSERT_OR_IGNORE_MISSING_VIEW_REGEN_ONE,
  parseSeedMissingViewSlug,
  sqlCountEligibleMissingView,
  sqlSelectEligibleRowsForMissingView,
  STORAGE_TABLE_SEED_MISSING_VIEW,
} from "../../_lib/seedMissingViewRegenStatus";
import { controllingStorageR2KeyFromViewToken } from "../../_lib/vehicleImageryR2Key";

async function runEligibleCount(
  db: D1Database,
  slug: NonNullable<
    ReturnType<typeof parseSeedMissingViewSlug>
  >,
): Promise<number> {
  const sql = sqlCountEligibleMissingView(STORAGE_TABLE_SEED_MISSING_VIEW, slug);
  const row = await db.prepare(sql).first<{ n: number }>();
  return Number(row?.n ?? 0) || 0;
}

/** Wie Frontend `VehicleImageryRowLike` für R2-Pfad. */
type EligibleVehicleRow = {
  id: number;
  format: string | null;
  resolution: string | null;
  marke: string | null;
  modell: string | null;
  jahr: number | null;
  body: string | null;
  trim: string | null;
  farbe: string | null;
};

/** D1: empfohlene Obergrenze pro `batch`-Aufruf. */
const MISSING_VIEW_SEED_BATCH = 100;

async function requireAuthAndDb(
  env: AuthEnv,
  request: Request,
): Promise<
  | { ok: true; db: D1Database }
  | { ok: false; response: Response }
> {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return {
      ok: false,
      response: jsonResponse({ error: "Nicht angemeldet" }, { status: 401 }),
    };
  }
  if (!env.vehicledatabase) {
    return {
      ok: false,
      response: jsonResponse(
        {
          error:
            "D1-Binding `vehicledatabase` fehlt (Schreibzugriff auf controll_status).",
        },
        { status: 503 },
      ),
    };
  }
  return { ok: true, db: env.vehicledatabase };
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const gate = await requireAuthAndDb(env, request);
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const slug = parseSeedMissingViewSlug(url.searchParams.get("slug"));
  if (!slug) {
    return jsonResponse(
      {
        error:
          "slug muss dashboard oder center_console sein (Query-Parameter).",
      },
      { status: 400 },
    );
  }

  try {
    const eligibleVehicleCount = await runEligibleCount(gate.db, slug);
    return jsonResponse({ slug, eligibleVehicleCount }, { status: 200 });
  } catch (err) {
    return jsonResponse(
      {
        error: "seed-missing-view-regen-status: Count fehlgeschlagen.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
};

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const gate = await requireAuthAndDb(env, request);
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const slugRaw =
    body && typeof body === "object" ?
      (body as Record<string, unknown>).slug
    : undefined;
  const slug = parseSeedMissingViewSlug(
    typeof slugRaw === "string" ? slugRaw : null,
  );
  if (!slug) {
    return jsonResponse(
      { error: "Body.slug muss dashboard oder center_console sein." },
      { status: 400 },
    );
  }

  try {
    const selectSql = sqlSelectEligibleRowsForMissingView(
      STORAGE_TABLE_SEED_MISSING_VIEW,
      slug,
    );
    const listed = await gate.db
      .prepare(selectSql)
      .all<EligibleVehicleRow>();
    const rows = listed.results ?? [];
    const eligibleVehicleCount = rows.length;

    let inserted = 0;
    for (let i = 0; i < rows.length; i += MISSING_VIEW_SEED_BATCH) {
      const slice = rows.slice(i, i + MISSING_VIEW_SEED_BATCH);
      const stmts = slice.map((row) => {
        const key = controllingStorageR2KeyFromViewToken(row, slug);
        return gate.db
          .prepare(INSERT_OR_IGNORE_MISSING_VIEW_REGEN_ONE)
          .bind(row.id, slug, key);
      });
      const batchRes = await gate.db.batch(stmts);
      for (const r of batchRes) {
        inserted +=
          typeof r.meta?.changes === "number" ? r.meta.changes : 0;
      }
    }

    return jsonResponse(
      { slug, inserted, eligibleVehicleCount },
      { status: 200 },
    );
  } catch (err) {
    return jsonResponse(
      {
        error: "seed-missing-view-regen-status: Datenbank-Fehler.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
};
