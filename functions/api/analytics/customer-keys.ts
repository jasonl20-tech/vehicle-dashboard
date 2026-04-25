import {
  pickBucket,
  resolveAnalyticsBinding,
  runAeSql,
  sqlString,
  whereForMode,
  type AeAccountBinding,
  type AeRow,
  type AeSqlError,
  type AnalyticsMode,
} from "../../_lib/analytics";
import {
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
} from "../../_lib/auth";

const KIND_VALUES = [
  "overview",
  "timeseries",
  "top-keys",
  "top-brands",
  "top-models",
  "top-actions",
  "top-paths",
  "top-views",
  "status-codes",
  "recent",
  "key-detail",
] as const;
type Kind = (typeof KIND_VALUES)[number];

/**
 * Bedingung für "echte Bild-Views" (im Gegensatz zu Metadaten-Calls
 * wie list_brands / list_models / list_years / list_variants /
 * list_trims / check_views). blob5 enthält dabei den View-Namen
 * (z. B. "front_left", "right", "rear").
 */
const VIEW_FILTER_SQL =
  "blob5 != 'NA' AND blob5 != '' AND blob5 NOT LIKE 'list_%' AND blob5 != 'check_views'";

function ae<T extends AeRow>(env: AuthEnv, ctx: Ctx, sql: string) {
  return runAeSql<T>(env, sql, { binding: ctx.binding });
}

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now.getTime() + 60_000);
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);
  return { from: fmt(from), to: fmt(to) };
}

function isAllowedKey(s: string): boolean {
  // index1 enthält bei euch z. B. "VI-…" oder Hex-Hash. Wir lassen alles
  // zu, was harmlos in eine SQL-String-Konstante kann; die Quote-Escape macht
  // sqlString. Trotzdem ein Sanity-Limit zur Abwehr von Müll.
  return s.length > 0 && s.length <= 200 && !/[\r\n\t\u0000]/.test(s);
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const url = new URL(request.url);
  const kindRaw = url.searchParams.get("kind") || "overview";
  if (!(KIND_VALUES as readonly string[]).includes(kindRaw)) {
    return jsonResponse(
      {
        error: `Unbekannter kind=${kindRaw}. Erlaubt: ${KIND_VALUES.join(", ")}`,
      },
      { status: 400 },
    );
  }
  const kind = kindRaw as Kind;

  const def = defaultRange();
  const from = (url.searchParams.get("from") || def.from).trim();
  const to = (url.searchParams.get("to") || def.to).trim();
  const limit = Math.max(
    1,
    Math.min(1000, Number(url.searchParams.get("limit") || 50)),
  );
  const key = (url.searchParams.get("key") || "").trim();

  const modeRaw = (url.searchParams.get("mode") || "customers").toLowerCase();
  if (modeRaw !== "customers" && modeRaw !== "oneauto") {
    return jsonResponse(
      { error: `Unbekannter mode=${modeRaw}. Erlaubt: customers, oneauto` },
      { status: 400 },
    );
  }
  const mode = modeRaw as AnalyticsMode;

  const bindingRaw = (url.searchParams.get("binding") || "primary").toLowerCase();
  if (bindingRaw !== "primary" && bindingRaw !== "secondary") {
    return jsonResponse(
      {
        error: `Unbekannter binding=${bindingRaw}. Erlaubt: primary, secondary`,
      },
      { status: 400 },
    );
  }
  const binding = bindingRaw as AeAccountBinding;

  const resolved = resolveAnalyticsBinding(env, binding);
  if (resolved.error) {
    return jsonResponse({ error: resolved.error }, { status: 400 });
  }
  const { dataset } = resolved;

  let where: string;
  try {
    where = whereForMode(
      mode,
      from,
      to,
      key && kind === "key-detail" ? `index1 = ${sqlString(key)}` : undefined,
    );
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  if (kind === "key-detail" && (!key || !isAllowedKey(key))) {
    return jsonResponse(
      { error: "Ungültiger oder fehlender 'key' für key-detail" },
      { status: 400 },
    );
  }

  try {
    const result = await dispatch(env, kind, {
      where,
      from,
      to,
      limit,
      key,
      dataset,
      binding,
    });
    return jsonResponse({
      kind,
      mode,
      binding,
      dataset,
      from,
      to,
      ...result,
    });
  } catch (err) {
    const aeErr = err as AeSqlError;
    const msg = aeErr instanceof Error ? aeErr.message : String(aeErr);
    console.error("[customer-keys] failed:", msg);
    return jsonResponse(
      {
        error: msg,
        status: aeErr.status ?? null,
        cfRay: aeErr.cfRay ?? null,
        hint: aeErr.hint ?? null,
        body: aeErr.body ?? null,
      },
      { status: 500 },
    );
  }
};

type Ctx = {
  where: string;
  from: string;
  to: string;
  limit: number;
  key: string;
  dataset: string;
  binding: AeAccountBinding;
};

async function dispatch(env: AuthEnv, kind: Kind, ctx: Ctx) {
  switch (kind) {
    case "overview":
      return overview(env, ctx);
    case "timeseries":
      return timeseries(env, ctx);
    case "top-keys":
      return topKeys(env, ctx);
    case "top-brands":
      return topBrands(env, ctx);
    case "top-models":
      return topModels(env, ctx);
    case "top-actions":
      return topActions(env, ctx);
    case "top-paths":
      return topPaths(env, ctx);
    case "top-views":
      return topViews(env, ctx);
    case "status-codes":
      return statusCodes(env, ctx);
    case "recent":
      return recent(env, ctx);
    case "key-detail":
      return keyDetail(env, ctx);
  }
}

async function overview(env: AuthEnv, ctx: Ctx) {
  const { where } = ctx;
  const sql = `
    SELECT
      SUM(_sample_interval) AS requests,
      count(DISTINCT index1) AS uniqueKeys,
      SUM(_sample_interval * if(double1 < 400, 1, 0)) AS okRequests,
      SUM(_sample_interval * if(double1 >= 400, 1, 0)) AS errRequests,
      SUM(_sample_interval * if(${VIEW_FILTER_SQL}, 1, 0)) AS viewRequests,
      SUM(_sample_interval * if(${VIEW_FILTER_SQL} AND double1 < 400, 1, 0)) AS viewOkRequests,
      MIN(timestamp) AS firstSeen,
      MAX(timestamp) AS lastSeen
    FROM ${ctx.dataset}
    ${where}
  `;
  const r = await ae<{
    requests: number;
    uniqueKeys: number;
    okRequests: number;
    errRequests: number;
    viewRequests: number;
    viewOkRequests: number;
    firstSeen: string | null;
    lastSeen: string | null;
  }>(env, ctx, sql);
  const row = r.data[0] || {
    requests: 0,
    uniqueKeys: 0,
    okRequests: 0,
    errRequests: 0,
    viewRequests: 0,
    viewOkRequests: 0,
    firstSeen: null,
    lastSeen: null,
  };
  return { row };
}

async function timeseries(env: AuthEnv, ctx: Ctx) {
  const { where, from, to } = ctx;
  const bucket = pickBucket(from, to);
  const sql = `
    SELECT
      ${bucket.sql} AS bucket,
      SUM(_sample_interval) AS requests,
      SUM(_sample_interval * if(double1 < 400, 1, 0)) AS ok,
      SUM(_sample_interval * if(double1 >= 400, 1, 0)) AS err,
      count(DISTINCT index1) AS keys
    FROM ${ctx.dataset}
    ${where}
    GROUP BY bucket
    ORDER BY bucket ASC
    LIMIT 5000
  `;
  const r = await ae<{
    bucket: string;
    requests: number;
    ok: number;
    err: number;
    keys: number;
  }>(env, ctx, sql);
  return { rows: r.data, bucket: bucket.label };
}

async function topKeys(env: AuthEnv, ctx: Ctx) {
  const { where, limit } = ctx;
  const sql = `
    SELECT
      index1 AS keyId,
      SUM(_sample_interval) AS requests,
      SUM(_sample_interval * if(double1 < 400, 1, 0)) AS ok,
      SUM(_sample_interval * if(double1 >= 400, 1, 0)) AS err,
      count(DISTINCT blob3) AS brands,
      MAX(timestamp) AS lastSeen
    FROM ${ctx.dataset}
    ${where}
    GROUP BY index1
    ORDER BY requests DESC
    LIMIT ${limit}
  `;
  const r = await ae<{
    keyId: string;
    requests: number;
    ok: number;
    err: number;
    brands: number;
    lastSeen: string;
  }>(env, ctx, sql);
  return { rows: r.data };
}

async function topBrands(env: AuthEnv, ctx: Ctx) {
  const { where, limit } = ctx;
  const sql = `
    SELECT
      blob3 AS brand,
      SUM(_sample_interval) AS requests
    FROM ${ctx.dataset}
    ${where} AND blob3 != 'NA' AND blob3 != ''
    GROUP BY blob3
    ORDER BY requests DESC
    LIMIT ${limit}
  `;
  const r = await ae<{ brand: string; requests: number }>(env, ctx, sql);
  return { rows: r.data };
}

async function topModels(env: AuthEnv, ctx: Ctx) {
  const { where, limit } = ctx;
  const sql = `
    SELECT
      blob3 AS brand,
      blob4 AS model,
      SUM(_sample_interval) AS requests
    FROM ${ctx.dataset}
    ${where} AND blob4 != 'NA' AND blob4 != ''
    GROUP BY blob3, blob4
    ORDER BY requests DESC
    LIMIT ${limit}
  `;
  const r = await ae<{
    brand: string;
    model: string;
    requests: number;
  }>(env, ctx, sql);
  return { rows: r.data };
}

async function topActions(env: AuthEnv, ctx: Ctx) {
  const { where, limit } = ctx;
  const sql = `
    SELECT
      blob5 AS action,
      SUM(_sample_interval) AS requests
    FROM ${ctx.dataset}
    ${where} AND blob5 != 'NA' AND blob5 != ''
    GROUP BY blob5
    ORDER BY requests DESC
    LIMIT ${limit}
  `;
  const r = await ae<{ action: string; requests: number }>(env, ctx, sql);
  return { rows: r.data };
}

async function topPaths(env: AuthEnv, ctx: Ctx) {
  const { where, limit } = ctx;
  const sql = `
    SELECT
      blob1 AS path,
      SUM(_sample_interval) AS requests
    FROM ${ctx.dataset}
    ${where}
    GROUP BY blob1
    ORDER BY requests DESC
    LIMIT ${limit}
  `;
  const r = await ae<{ path: string; requests: number }>(env, ctx, sql);
  return { rows: r.data };
}

async function topViews(env: AuthEnv, ctx: Ctx) {
  const { where, limit } = ctx;
  const sql = `
    SELECT
      blob5 AS view,
      SUM(_sample_interval) AS requests,
      SUM(_sample_interval * if(double1 < 400, 1, 0)) AS ok,
      SUM(_sample_interval * if(double1 >= 400, 1, 0)) AS err,
      count(DISTINCT index1) AS keys
    FROM ${ctx.dataset}
    ${where} AND ${VIEW_FILTER_SQL}
    GROUP BY blob5
    ORDER BY requests DESC
    LIMIT ${limit}
  `;
  const r = await ae<{
    view: string;
    requests: number;
    ok: number;
    err: number;
    keys: number;
  }>(env, ctx, sql);
  return { rows: r.data };
}

async function statusCodes(env: AuthEnv, ctx: Ctx) {
  const { where, limit } = ctx;
  const sql = `
    SELECT
      double1 AS status,
      SUM(_sample_interval) AS requests
    FROM ${ctx.dataset}
    ${where}
    GROUP BY status
    ORDER BY requests DESC
    LIMIT ${limit}
  `;
  const r = await ae<{ status: number; requests: number }>(env, ctx, sql);
  return { rows: r.data };
}

async function recent(env: AuthEnv, ctx: Ctx) {
  const { where, limit } = ctx;
  const sortRaw = "DESC"; // immer neueste zuerst
  const sql = `
    SELECT
      timestamp,
      index1 AS keyId,
      blob1 AS path,
      blob3 AS brand,
      blob4 AS model,
      blob5 AS action,
      blob6 AS statusText,
      double1 AS status,
      _sample_interval AS sampleInterval
    FROM ${ctx.dataset}
    ${where}
    ORDER BY timestamp ${sortRaw}
    LIMIT ${limit}
  `;
  const r = await ae<{
    timestamp: string;
    keyId: string;
    path: string;
    brand: string;
    model: string;
    action: string;
    statusText: string;
    status: number;
    sampleInterval: number;
  }>(env, ctx, sql);
  return { rows: r.data };
}

async function keyDetail(env: AuthEnv, ctx: Ctx) {
  const [ov, ts, brands, actions, paths, views, rec] = await Promise.all([
    overview(env, ctx),
    timeseries(env, ctx),
    topBrands(env, { ...ctx, limit: 10 }),
    topActions(env, { ...ctx, limit: 10 }),
    topPaths(env, { ...ctx, limit: 10 }),
    topViews(env, { ...ctx, limit: 10 }),
    recent(env, { ...ctx, limit: 100 }),
  ]);
  return {
    row: ov.row,
    timeseries: ts.rows,
    bucket: ts.bucket,
    topBrands: brands.rows,
    topActions: actions.rows,
    topPaths: paths.rows,
    topViews: views.rows,
    recent: rec.rows,
  };
}
