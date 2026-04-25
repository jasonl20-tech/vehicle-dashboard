/**
 * GET /api/intern-analytics/controlling
 *
 * Query-Parameter:
 *   from, to     – YYYY-MM-DD HH:MM:SS (Standard: letzte 7 Tage)
 *   gapMinutes   – Sessions-Trennung (Standard: 5)
 *   limit        – max. Zeilen aus Analytics Engine (Standard: 100000)
 *   blob4        – nonempty | hex32  (nur hex32-Keys in blob4)
 *   includeRaw   – 0 | 1  (Rohzeilen am Ende; Standard 1)
 *   rawLimit     – letzte N Rohzeilen (Standard 150)
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
  buildControllingFetchSql,
  defaultControllingRange,
  MAX_QUERY_ROWS,
  parseControllingRow,
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

  const p = resolveAnalyticsBinding(env, "primary");
  if (p.error) {
    return jsonResponse({ error: p.error }, { status: 400 });
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
    blob4Raw === "hex32" ? "hex32" : "nonempty";
  const includeRaw = (url.searchParams.get("includeRaw") || "1") !== "0";
  const rawLimit = Math.min(
    500,
    Math.max(20, Number(url.searchParams.get("rawLimit") || 150)),
  );

  let sql: string;
  try {
    sql = buildControllingFetchSql(env, from, to, {
      limit,
      blob4Mode,
    });
  } catch (e) {
    return jsonResponse(
      { error: (e as Error).message },
      { status: 400 },
    );
  }

  let data: AeRow[];
  try {
    const res = await runAeSql<AeRow>(env, sql, { binding: "primary" });
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

  const rawTail = includeRaw
    ? data.slice(-rawLimit).map((r) => parseControllingRow(r))
    : [];

  return jsonResponse({
    dataset: getControllingDataset(env),
    range: { from, to },
    sessionGapMinutes: gapMinutes,
    blob4Mode,
    rowLimit: limit,
    ...processed,
    rawTail,
    meta: {
      beschreibung:
        "Offen = max(0, double3−double2) wenn double3>0. Prognose aus letzten abnehmenden „offen“-Werten (Sessions: >5 min Pause = neue Session).",
    },
  });
};
