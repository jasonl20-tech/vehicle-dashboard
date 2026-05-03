/**
 * POST /api/system/seed-dashboard-regen-status (temporär)
 *
 * Legt für alle Datensätze in `vehicleimagery_controlling_storage` ohne
 * Dashboard-Token in `views` einen `controll_status`-Eintrag an:
 * `view_token = dashboard`, `mode = correction`, `status = regen_vertex`,
 * `key = null`, `"check" = 8`.
 *
 * Kriterium **nur** `views`: Fahrzeuge, deren `views`-Liste bereits einen
 * Dashboard-Token hat (Slug `dashboard` als Semikolon-Token, optional `#…`),
 * fallen aus dem SELECT komplett raus — unabhängig von `controll_status`.
 *
 * Gibt es trotz fehlenden Dashboard in `views` schon einen Eintrag unter
 * `UNIQUE(vehicle_id, view_token, mode)`, lässt `INSERT OR IGNORE` den
 * Insert aus (Zeile wird nicht überschrieben).
 *
 * JSON-Antwort: `eligibleVehicleCount` (Fahrzeuge ohne dashboard in `views`),
 * `inserted` (neu angelegte Kontroll-Zeilen).
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
  const whereNoDashboardInViews = `NOT (
  (${wrappedExpr}) LIKE '%;dashboard;%'
  OR (${wrappedExpr}) LIKE '%;dashboard#%'
)`;

  const countSql = `
SELECT COUNT(*) AS n
FROM ${STORAGE_TABLE} v
WHERE ${whereNoDashboardInViews}
`;

  const insertSql = `
INSERT OR IGNORE INTO controll_status (vehicle_id, view_token, mode, status, key, updated_at, "check")
SELECT v.id, 'dashboard', 'correction', 'regen_vertex', NULL, datetime('now'), 8
FROM ${STORAGE_TABLE} v
WHERE ${whereNoDashboardInViews}
`;

  try {
    const countRow = await db.prepare(countSql).first<{ n: number }>();
    const eligibleVehicleCount = Number(countRow?.n ?? 0) || 0;

    const r = await db.prepare(insertSql).run();
    const inserted =
      typeof r.meta?.changes === "number" ? r.meta.changes : 0;
    return jsonResponse({ inserted, eligibleVehicleCount }, { status: 200 });
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
