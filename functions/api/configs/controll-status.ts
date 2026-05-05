/**
 * POST /api/configs/controll-status
 *
 * Schreibt einen Eintrag in `controll_status` (D1-Binding `vehicledatabase`).
 * Body:
 *   { vehicleId: number, viewToken: string, mode: string (correction|inside|scaling|shadow|transparency), status: string, key: string|null }
 *
 * Antwort: { row: ControllStatusRow }
 *
 * Sonderaktion **`delete_in_progress`**: löscht genau eine Zeile, wenn
 * `vehicle_id` + `view_token` + `mode` übereinstimmen und mindestens eines gilt:
 * - **`"check" = 1`** (in Bearbeitung, alle Modi), oder
 * - **`mode = correction`** und die Zeile ist **noch nicht freigegeben**
 *   (`NOT (check = 2 AND status = correct)`).
 *
 * Body:
 *   { action: "delete_in_progress", vehicleId: number, viewToken: string, mode: … }
 *
 * Antwort: { deleted: true } · 404 (nicht gefunden) · 409 (nicht löschbar, z. B. Freigabe)
 *
 * **`delete_all_for_vehicle`**: löscht **alle** `controll_status`-Zeilen für
 * eine `vehicle_id`.
 *
 * Body: `{ action: "delete_all_for_vehicle", vehicleId: number }`
 *
 * Antwort: `{ deleted: number }` — Anzahl gelöschter Zeilen (kann 0 sein).
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  CONTROLL_STATUS_DELETE_ALL_FOR_VEHICLE_ACTION,
  CONTROLL_STATUS_DELETE_IN_PROGRESS_ACTION,
  SELECT_CONTROLL_STATUS_ONE,
  UPSERT_CONTROLL_STATUS_SQL,
  validateControllStatusBody,
  validateControllStatusDeleteAllForVehicleBody,
  validateControllStatusDeleteInProgressBody,
  type ControllStatusRow,
} from "../../_lib/controllStatus";

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
          "D1-Binding `vehicledatabase` fehlt (controll_status liegt dort).",
      },
      { status: 503 },
    );
  }
  const db = env.vehicledatabase;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  if (
    raw &&
    typeof raw === "object" &&
    (raw as Record<string, unknown>).action ===
      CONTROLL_STATUS_DELETE_IN_PROGRESS_ACTION
  ) {
    const dv = validateControllStatusDeleteInProgressBody(raw);
    if (!dv.ok) {
      return jsonResponse({ error: dv.error }, { status: 400 });
    }
    const { vehicleId: vidDel, viewToken: tokDel, mode: modeDel } =
      dv.value;
    try {
      const delRes = await db
        .prepare(
          `DELETE FROM controll_status
           WHERE vehicle_id = ? AND view_token = ?
             AND lower(trim(mode)) = lower(trim(?))
             AND (
               "check" = 1
               OR (
                 lower(trim(mode)) = 'correction'
                 AND NOT (
                   "check" = 2
                   AND lower(trim(ifnull(status, ''))) = 'correct'
                 )
               )
             )`,
        )
        .bind(vidDel, tokDel, modeDel)
        .run();
      const changed = Number(delRes.meta?.changes ?? 0);
      if (changed < 1) {
        const exists = await db
          .prepare(
            `SELECT "check", status, mode FROM controll_status
             WHERE vehicle_id = ? AND view_token = ?
               AND lower(trim(mode)) = lower(trim(?))
             LIMIT 1`,
          )
          .bind(vidDel, tokDel, modeDel)
          .first<{ check: number; status: string; mode: string }>();
        if (!exists) {
          return jsonResponse({ error: "Eintrag nicht gefunden." }, { status: 404 });
        }
        return jsonResponse(
          {
            error:
              "Diese Zeile ist nicht löschbar (z. B. bereits freigegebene Korrektur).",
          },
          { status: 409 },
        );
      }
      return jsonResponse({ deleted: true }, { status: 200 });
    } catch (err) {
      return jsonResponse(
        {
          error: "controll_status: Löschen fehlgeschlagen.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }
  }

  if (
    raw &&
    typeof raw === "object" &&
    (raw as Record<string, unknown>).action ===
      CONTROLL_STATUS_DELETE_ALL_FOR_VEHICLE_ACTION
  ) {
    const av = validateControllStatusDeleteAllForVehicleBody(raw);
    if (!av.ok) {
      return jsonResponse({ error: av.error }, { status: 400 });
    }
    const { vehicleId: vidAll } = av.value;
    try {
      const delAll = await db
        .prepare(`DELETE FROM controll_status WHERE vehicle_id = ?`)
        .bind(vidAll)
        .run();
      const n = Number(delAll.meta?.changes ?? 0);
      return jsonResponse({ deleted: n }, { status: 200 });
    } catch (err) {
      return jsonResponse(
        {
          error: "controll_status: Massen-Löschen fehlgeschlagen.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }
  }

  const v = validateControllStatusBody(raw);
  if (!v.ok) {
    return jsonResponse({ error: v.error }, { status: 400 });
  }
  const { vehicleId, viewToken, mode, status, key } = v.value;

  try {
    await db
      .prepare(UPSERT_CONTROLL_STATUS_SQL)
      .bind(vehicleId, viewToken, mode, status, key)
      .run();
  } catch (err) {
    return jsonResponse(
      {
        error: "controll_status: Schreiben fehlgeschlagen.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  const row = await db
    .prepare(SELECT_CONTROLL_STATUS_ONE)
    .bind(vehicleId, viewToken, mode)
    .first<ControllStatusRow>();

  if (!row) {
    return jsonResponse(
      { error: "Eintrag wurde geschrieben, konnte aber nicht gelesen werden." },
      { status: 500 },
    );
  }
  return jsonResponse({ row }, { status: 200 });
};
