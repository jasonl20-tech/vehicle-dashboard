/**
 * GET /api/intern-analytics/user-analytics
 *
 * Liefert Auswertung der AE-Tabelle `controll_platform_logs` aus User-Sicht.
 *
 * Ohne `user`-Parameter: nur Liste aller User im Zeitraum (Sidebar).
 * Mit `user`-Parameter: zusätzlich detaillierter Bericht.
 * Mit `user` + `ip`: Detail-Bericht eingeschränkt auf eine IP.
 *
 * Query-Parameter:
 *   from, to     – YYYY-MM-DD HH:MM:SS (Standard: letzte 30 Tage)
 *   user         – optional: index1 / Username
 *   ip           – optional: blob5 / IP des Users
 *   gapMinutes   – Sessions-Trennung (Standard: 5)
 *   limit        – max. Zeilen aus AE (Standard: 100000, max. 250000)
 */
import {
  resolveAnalyticsBinding,
  runAeSql,
  type AeRow,
  type AeSqlError,
} from "../../_lib/analytics";
import {
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
} from "../../_lib/auth";
import {
  buildUserAnalyticsFetchPlan,
  defaultUserAnalyticsRange,
  processUserAnalytics,
  USER_ANALYTICS_DEFAULT_GAP_MS,
  USER_ANALYTICS_MAX_ROWS,
} from "../../_lib/userAnalytics";

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const auth = await getCurrentUser(env, request);
  if (!auth) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const url = new URL(request.url);
  const def = defaultUserAnalyticsRange();
  const from = (url.searchParams.get("from") || def.from).trim();
  const to = (url.searchParams.get("to") || def.to).trim();
  const userParam = (url.searchParams.get("user") || "").trim();
  const ipParam = (url.searchParams.get("ip") || "").trim();
  const gapMinutes = Math.min(
    120,
    Math.max(1, Number(url.searchParams.get("gapMinutes") || 5)),
  );
  const limit = Math.min(
    USER_ANALYTICS_MAX_ROWS,
    Math.max(1000, Number(url.searchParams.get("limit") || 100_000)),
  );

  let plan: ReturnType<typeof buildUserAnalyticsFetchPlan>;
  try {
    plan = buildUserAnalyticsFetchPlan(env, from, to, {
      limit,
      user: userParam || null,
      ip: ipParam || null,
    });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, { status: 400 });
  }

  // Bei Detail-Abfrage *zwei* Reads erforderlich: einmal alle User (für Sidebar)
  // und einmal die Detaildaten. Wenn `user` gesetzt ist, liefert der gefilterte
  // Plan nicht alle User – also separat ein zweiter Plan.
  let listRows: AeRow[] = [];
  let detailRows: AeRow[] = [];

  const pBinding = resolveAnalyticsBinding(env, plan.binding);
  if (pBinding.error) {
    return jsonResponse({ error: pBinding.error }, { status: 400 });
  }

  if (userParam) {
    const listPlan = buildUserAnalyticsFetchPlan(env, from, to, {
      limit,
      user: null,
      ip: null,
    });
    try {
      const [listRes, detailRes] = await Promise.all([
        runAeSql<AeRow>(env, listPlan.sql, { binding: listPlan.binding }),
        runAeSql<AeRow>(env, plan.sql, { binding: plan.binding }),
      ]);
      listRows = listRes.data;
      detailRows = detailRes.data;
    } catch (e) {
      const err = e as AeSqlError;
      return jsonResponse(
        {
          error: err.message || "Analytics Engine Fehler",
          hint: err.hint,
          sql: err.sql,
        },
        { status: err.status && err.status < 500 ? err.status : 502 },
      );
    }
  } else {
    try {
      const res = await runAeSql<AeRow>(env, plan.sql, {
        binding: plan.binding,
      });
      listRows = res.data;
      detailRows = [];
    } catch (e) {
      const err = e as AeSqlError;
      return jsonResponse(
        {
          error: err.message || "Analytics Engine Fehler",
          hint: err.hint,
          sql: err.sql,
        },
        { status: err.status && err.status < 500 ? err.status : 502 },
      );
    }
  }

  const gapMs = userParam
    ? gapMinutes * 60 * 1000
    : USER_ANALYTICS_DEFAULT_GAP_MS;

  // Liste aus listRows; Detail aus detailRows.
  const listProcessed = processUserAnalytics(listRows, {
    fromIso: from,
    toIso: to,
    gapMs: USER_ANALYTICS_DEFAULT_GAP_MS,
    user: null,
    ip: null,
    likelyTruncated: listRows.length >= limit,
  });

  let detail: ReturnType<typeof processUserAnalytics>["detail"] = null;
  if (userParam) {
    const detailProcessed = processUserAnalytics(detailRows, {
      fromIso: from,
      toIso: to,
      gapMs,
      user: userParam,
      ip: ipParam || null,
      likelyTruncated: detailRows.length >= limit,
    });
    detail = detailProcessed.detail;
  }

  return jsonResponse({
    range: { from, to },
    sessionGapMinutes: gapMinutes,
    rowLimit: limit,
    ae: {
      fromTable: plan.fromTable,
      fromMode: plan.fromMode,
      binding: plan.binding,
    },
    rangeRows: listProcessed.rangeRows,
    truncated: listProcessed.truncated,
    validDoubleFromTs: listProcessed.validDoubleFromTs,
    excludedTs: listProcessed.excludedTs,
    users: listProcessed.users,
    detail,
  });
};
