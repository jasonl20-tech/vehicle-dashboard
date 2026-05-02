/**
 * POST /api/configs/controll-status
 *
 * Schreibt einen Eintrag in `controll_status` (D1-Binding `vehicledatabase`).
 * Body:
 *   { vehicleId: number, viewToken: string, mode: string (correction|inside|scaling|shadow|transparency), status: string, key: string|null }
 *
 * Antwort: { row: ControllStatusRow }
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  SELECT_CONTROLL_STATUS_ONE,
  UPSERT_CONTROLL_STATUS_SQL,
  validateControllStatusBody,
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
