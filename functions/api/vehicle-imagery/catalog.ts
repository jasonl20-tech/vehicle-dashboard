import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  buildFacets,
  buildVehicleImageryWhereClause,
  selectRowsPage,
  type VehicleImageryFilter,
} from "../../_lib/vehicleImageryCatalog";

/**
 * GET /api/vehicle-imagery/catalog
 * Nur SELECT: Distinct-Werte und geparste Ansichten. Optional ?marke= & ?modell=.
 * Optional: &rows=1&limit=50&offset=0 — Zeilen (max. 500).
 */
export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  if (!env.vehicledatabase) {
    return jsonResponse(
      { error: "D1-Binding `vehicledatabase` ist nicht konfiguriert" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const filter: VehicleImageryFilter = {};
  const marke = url.searchParams.get("marke");
  const modell = url.searchParams.get("modell");
  if (marke?.trim()) filter.marke = marke.trim();
  if (modell?.trim()) filter.modell = modell.trim();

  const wantRows =
    url.searchParams.get("rows") === "1" ||
    url.searchParams.get("rows") === "true";
  const limit = Math.min(
    500,
    Math.max(0, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50),
  );
  const offset = Math.max(
    0,
    Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
  );

  try {
    const db = env.vehicledatabase;
    const facets = await buildFacets(db, filter);
    const { clause, binds } = buildVehicleImageryWhereClause(filter);

    const payload: Record<string, unknown> = {
      ...facets,
      filter: Object.keys(filter).length ? filter : {},
    };

    if (wantRows) {
      const rows = await selectRowsPage(db, clause, binds, limit, offset);
      payload.rows = rows;
      payload.rowsLimit = limit;
      payload.rowsOffset = offset;
    }

    return jsonResponse(payload, { status: 200 });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
};
