import {
  KEY_ANALYTICS_DATASET,
  pickBucket,
  runAeSql,
  sqlString,
  whereCustomerWindow,
  type AeSqlError,
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
  "status-codes",
  "recent",
  "key-detail",
] as const;
type Kind = (typeof KIND_VALUES)[number];

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

  let where: string;
  try {
    where = whereCustomerWindow(
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
    const result = await dispatch(env, kind, { where, from, to, limit, key });
    return jsonResponse({
      kind,
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
    case "status-codes":
      return statusCodes(env, ctx);
    case "recent":
      return recent(env, ctx);
    case "key-detail":
      return keyDetail(env, ctx);
  }
}

async function overview(env: AuthEnv, { where }: Ctx) {
  const sql = `
    SELECT
      SUM(_sample_interval) AS requests,
      uniq(index1) AS uniqueKeys,
      SUM(_sample_interval * if(double1 < 400, 1, 0)) AS okRequests,
      SUM(_sample_interval * if(double1 >= 400, 1, 0)) AS errRequests,
      MIN(timestamp) AS firstSeen,
      MAX(timestamp) AS lastSeen
    FROM ${KEY_ANALYTICS_DATASET}
    ${where}
  `;
  const r = await runAeSql<{
    requests: number;
    uniqueKeys: number;
    okRequests: number;
    errRequests: number;
    firstSeen: string | null;
    lastSeen: string | null;
  }>(env, sql);
  const row = r.data[0] || {
    requests: 0,
    uniqueKeys: 0,
    okRequests: 0,
    errRequests: 0,
    firstSeen: null,
    lastSeen: null,
  };
  return { row };
}

async function timeseries(env: AuthEnv, { where, from, to }: Ctx) {
  const bucket = pickBucket(from, to);
  const sql = `
    SELECT
      ${bucket.sql} AS bucket,
      SUM(_sample_interval) AS requests,
      SUM(_sample_interval * if(double1 < 400, 1, 0)) AS ok,
      SUM(_sample_interval * if(double1 >= 400, 1, 0)) AS err,
      uniq(index1) AS keys
    FROM ${KEY_ANALYTICS_DATASET}
    ${where}
    GROUP BY bucket
    ORDER BY bucket ASC
    LIMIT 5000
  `;
  const r = await runAeSql<{
    bucket: string;
    requests: number;
    ok: number;
    err: number;
    keys: number;
  }>(env, sql);
  return { rows: r.data, bucket: bucket.label };
}

async function topKeys(env: AuthEnv, { where, limit }: Ctx) {
  const sql = `
    SELECT
      index1 AS keyId,
      SUM(_sample_interval) AS requests,
      SUM(_sample_interval * if(double1 < 400, 1, 0)) AS ok,
      SUM(_sample_interval * if(double1 >= 400, 1, 0)) AS err,
      uniq(blob3) AS brands,
      MAX(timestamp) AS lastSeen
    FROM ${KEY_ANALYTICS_DATASET}
    ${where}
    GROUP BY index1
    ORDER BY requests DESC
    LIMIT ${limit}
  `;
  const r = await runAeSql<{
    keyId: string;
    requests: number;
    ok: number;
    err: number;
    brands: number;
    lastSeen: string;
  }>(env, sql);
  return { rows: r.data };
}

async function topBrands(env: AuthEnv, { where, limit }: Ctx) {
  const sql = `
    SELECT
      blob3 AS brand,
      SUM(_sample_interval) AS requests
    FROM ${KEY_ANALYTICS_DATASET}
    ${where} AND blob3 != 'NA' AND blob3 != ''
    GROUP BY blob3
    ORDER BY requests DESC
    LIMIT ${limit}
  `;
  const r = await runAeSql<{ brand: string; requests: number }>(env, sql);
  return { rows: r.data };
}

async function topModels(env: AuthEnv, { where, limit }: Ctx) {
  const sql = `
    SELECT
      blob3 AS brand,
      blob4 AS model,
      SUM(_sample_interval) AS requests
    FROM ${KEY_ANALYTICS_DATASET}
    ${where} AND blob4 != 'NA' AND blob4 != ''
    GROUP BY blob3, blob4
    ORDER BY requests DESC
    LIMIT ${limit}
  `;
  const r = await runAeSql<{
    brand: string;
    model: string;
    requests: number;
  }>(env, sql);
  return { rows: r.data };
}

async function topActions(env: AuthEnv, { where, limit }: Ctx) {
  const sql = `
    SELECT
      blob5 AS action,
      SUM(_sample_interval) AS requests
    FROM ${KEY_ANALYTICS_DATASET}
    ${where} AND blob5 != 'NA' AND blob5 != ''
    GROUP BY blob5
    ORDER BY requests DESC
    LIMIT ${limit}
  `;
  const r = await runAeSql<{ action: string; requests: number }>(env, sql);
  return { rows: r.data };
}

async function topPaths(env: AuthEnv, { where, limit }: Ctx) {
  const sql = `
    SELECT
      blob1 AS path,
      SUM(_sample_interval) AS requests
    FROM ${KEY_ANALYTICS_DATASET}
    ${where}
    GROUP BY blob1
    ORDER BY requests DESC
    LIMIT ${limit}
  `;
  const r = await runAeSql<{ path: string; requests: number }>(env, sql);
  return { rows: r.data };
}

async function statusCodes(env: AuthEnv, { where, limit }: Ctx) {
  const sql = `
    SELECT
      double1 AS status,
      SUM(_sample_interval) AS requests
    FROM ${KEY_ANALYTICS_DATASET}
    ${where}
    GROUP BY status
    ORDER BY requests DESC
    LIMIT ${limit}
  `;
  const r = await runAeSql<{ status: number; requests: number }>(env, sql);
  return { rows: r.data };
}

async function recent(env: AuthEnv, { where, limit }: Ctx) {
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
    FROM ${KEY_ANALYTICS_DATASET}
    ${where}
    ORDER BY timestamp ${sortRaw}
    LIMIT ${limit}
  `;
  const r = await runAeSql<{
    timestamp: string;
    keyId: string;
    path: string;
    brand: string;
    model: string;
    action: string;
    statusText: string;
    status: number;
    sampleInterval: number;
  }>(env, sql);
  return { rows: r.data };
}

async function keyDetail(env: AuthEnv, ctx: Ctx) {
  // overview + timeseries + top brands/actions + recent für genau diesen Key
  const [ov, ts, brands, actions, paths, rec] = await Promise.all([
    overview(env, ctx),
    timeseries(env, ctx),
    topBrands(env, { ...ctx, limit: 10 }),
    topActions(env, { ...ctx, limit: 10 }),
    topPaths(env, { ...ctx, limit: 10 }),
    recent(env, { ...ctx, limit: 100 }),
  ]);
  return {
    row: ov.row,
    timeseries: ts.rows,
    bucket: ts.bucket,
    topBrands: brands.rows,
    topActions: actions.rows,
    topPaths: paths.rows,
    recent: rec.rows,
  };
}
