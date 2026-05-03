/**
 * POST /api/system/seed-dashboard-regen-status (temporär)
 *
 * Legt für alle Datensätze in `vehicleimagery_controlling_storage` ohne
 * Dashboard-Token in `views` einen `controll_status`-Eintrag an:
 * `view_token = dashboard`, `mode = correction`, `status = regen_vertex`,
 * `key = null`, `"check" = 8`.
 *
 * Übersprungen werden Zeilen mit bestehendem `correction/dashboard`-Eintrag
 * sowie Fahrzeuge, deren `views`-Liste bereits einen passenden Dashboard-Token
 * enthält (Slug `dashboard` als Semikolon-Token, mit optionalem `#…`).
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const STORAGE_TABLE = "vehicleimagery_controlling_storage";

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  if (!env.vehicledatabase) {
    return jsonResponse(
      {
        error:
          "D1-Binding `vehicledatabase` fehlt (Schreibzugriff auf controll_status).",
      },
      { status: 503 },
    );
  }
  const db = env.vehicledatabase;

  const wrappedExpr = `REPLACE(REPLACE(
  ';' || REPLACE(REPLACE(LOWER(TRIM(IFNULL(v.views,''))), char(13), ';'), char(10), ';') || ';',
  '; ',
  ';'
), ' ;', ';')`;
  const sql = `
INSERT INTO controll_status (vehicle_id, view_token, mode, status, key, updated_at, "check")
SELECT v.id, 'dashboard', 'correction', 'regen_vertex', NULL, datetime('now'), 8
FROM ${STORAGE_TABLE} v
WHERE NOT (
  (${wrappedExpr}) LIKE '%;dashboard;%'
  OR (${wrappedExpr}) LIKE '%;dashboard#%'
)
AND NOT EXISTS (
  SELECT 1 FROM controll_status cs
  WHERE cs.vehicle_id = v.id
    AND LOWER(cs.view_token) = 'dashboard'
    AND LOWER(cs.mode) = 'correction'
)
`;

  try {
    const r = await db.prepare(sql).run();
    const inserted =
      typeof r.meta?.changes === "number" ? r.meta.changes : 0;
    return jsonResponse({ inserted }, { status: 200 });
  } catch (err) {
    return jsonResponse(
      {
        error: "seed-dashboard-regen-status: Datenbank-Fehler.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
};
