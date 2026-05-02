/**
 * POST /api/intern-analytics/controll-platform-action
 *
 * Schreibt einen Datenpunkt in `env.controll_analytics` (Analytics Engine).
 * Body: { actionLabel, viewsModeLabel, imageKey?, clientRttMs?, metaJson? }
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  clientIpFromRequest,
  writeControllPlatformAnalyticsPoint,
} from "../../_lib/controllPlatformAnalytics";
import { countControllingOpenByStatusMode } from "../databases/vehicle-imagery-controlling";

type Body = {
  actionLabel?: unknown;
  viewsModeLabel?: unknown;
  imageKey?: unknown;
  clientRttMs?: unknown;
  metaJson?: unknown;
};

function requireVehicleDb(env: AuthEnv): D1Database | Response {
  if (!env.vehicledatabase) {
    return jsonResponse(
      {
        error:
          "D1-Binding `vehicledatabase` fehlt (Controlling-Zähler für Analytics).",
      },
      { status: 503 },
    );
  }
  return env.vehicledatabase;
}

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  const actionLabel =
    typeof body.actionLabel === "string" ? body.actionLabel.trim() : "";
  const viewsModeLabel =
    typeof body.viewsModeLabel === "string" ? body.viewsModeLabel.trim() : "";
  if (!actionLabel || !viewsModeLabel) {
    return jsonResponse(
      { error: "actionLabel und viewsModeLabel sind Pflicht." },
      { status: 400 },
    );
  }

  const imageKey =
    body.imageKey === null || body.imageKey === undefined ?
      null
    : typeof body.imageKey === "string" ?
      body.imageKey.trim() || null
    : null;

  let clientRttMs: number | null = null;
  if (typeof body.clientRttMs === "number" && Number.isFinite(body.clientRttMs)) {
    clientRttMs = body.clientRttMs;
  }

  const metaJson =
    typeof body.metaJson === "string" && body.metaJson.trim() ?
      body.metaJson.trim().slice(0, 8192)
    : null;

  const db = requireVehicleDb(env);
  if (db instanceof Response) return db;

  const [doubleOpenCorrection, doubleOpenScaling] = await Promise.all([
    countControllingOpenByStatusMode(db, "correction"),
    countControllingOpenByStatusMode(db, "scaling"),
  ]);

  const ua = request.headers.get("User-Agent") ?? "";

  writeControllPlatformAnalyticsPoint(env, {
    username: user.benutzername,
    actionLabel,
    viewsModeLabel,
    imageKey,
    clientIp: clientIpFromRequest(request),
    userAgent: ua,
    metaAppend: metaJson,
    clientRttMs,
    doubleOpenCorrection,
    doubleOpenScaling,
  });

  return jsonResponse({ ok: true }, { status: 200 });
};
