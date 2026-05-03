/**
 * GET  /api/system/seed-missing-view-regen-status?slug=dashboard|center_console
 * POST /api/system/seed-missing-view-regen-status  Body: { slug: \"…\" }
 *
 * Nur Slugs aus `SEED_MISSING_VIEW_SLUGS`. Siehe `_lib/seedMissingViewRegenStatus`.
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  parseSeedMissingViewSlug,
  sqlCountEligibleMissingView,
  sqlInsertOrIgnoreMissingViewRegen,
  STORAGE_TABLE_SEED_MISSING_VIEW,
} from "../../_lib/seedMissingViewRegenStatus";

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

  const insertSql = sqlInsertOrIgnoreMissingViewRegen(
    STORAGE_TABLE_SEED_MISSING_VIEW,
    slug,
  );

  try {
    const eligibleVehicleCount = await runEligibleCount(gate.db, slug);
    const r = await gate.db.prepare(insertSql).run();
    const inserted =
      typeof r.meta?.changes === "number" ? r.meta.changes : 0;
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
