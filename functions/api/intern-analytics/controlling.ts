/**
 * GET /api/intern-analytics/controlling
 *
 * Liefert Auswertung der AE-Tabelle `controll_platform_logs`.
 *
 * Query-Parameter:
 *   from, to     – YYYY-MM-DD HH:MM:SS (Standard: letzte 7 Tage)
 *   gapMinutes   – Sessions-Trennung (Standard: 5)
 *   limit        – max. Zeilen aus AE (Standard: 100000, max. 150000)
 *   blob4        – nonempty | hex32 | all  (Standard: nonempty)
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
  buildControllingFetchPlan,
  defaultControllingRange,
  MAX_QUERY_ROWS,
  processControllingData,
  type ControllingBlob4Mode,
  getControllingDataset,
} from "../../_lib/controllingPlatformStats";

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const url = new URL(request.url);
  const def = defaultControllingRange();
  const from = (url.searchParams.get("from") || def.from).trim();
  const to = (url.searchParams.get("to") || def.to).trim();
  const gapMinutes = Math.min(
    120,
    Math.max(1, Number(url.searchParams.get("gapMinutes") || 5)),
  );
  const limit = Math.min(
    MAX_QUERY_ROWS,
    Math.max(1000, Number(url.searchParams.get("limit") || 100_000)),
  );
  const blob4Raw = (url.searchParams.get("blob4") || "nonempty").toLowerCase();
  const blob4Mode: ControllingBlob4Mode =
    blob4Raw === "hex32"
      ? "hex32"
      : blob4Raw === "all"
        ? "all"
        : "nonempty";

  let plan: ReturnType<typeof buildControllingFetchPlan>;
  try {
    plan = buildControllingFetchPlan(env, from, to, {
      limit,
      blob4Mode,
    });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, { status: 400 });
  }

  const pRun = resolveAnalyticsBinding(env, plan.binding);
  if (pRun.error) {
    return jsonResponse({ error: pRun.error }, { status: 400 });
  }

  let data: AeRow[];
  try {
    const res = await runAeSql<AeRow>(env, plan.sql, {
      binding: plan.binding,
    });
    data = res.data;
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

  const gapMs = gapMinutes * 60 * 1000;
  const likelyTruncated = data.length >= limit;
  const processed = processControllingData(data, gapMs, { likelyTruncated });

  return jsonResponse({
    dataset: getControllingDataset(env),
    ae: {
      fromTable: plan.fromTable,
      fromMode: plan.fromMode,
      binding: plan.binding,
    },
    range: { from, to },
    sessionGapMinutes: gapMinutes,
    blob4Mode,
    rowLimit: limit,
    ...processed,
  });
};
