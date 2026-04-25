/**
 * Parallele Analytics-Engine-Abfragen über mehrere Konten/Datasets
 * und Zusammenführung (additive Zählung).
 */
import type { AuthEnv } from "./auth";
import {
  type AeRow,
  type AnalyticsSource,
  aeNumber,
  runAeSql,
} from "./analytics";

export async function runMergedSql<T extends AeRow>(
  env: AuthEnv,
  sources: AnalyticsSource[],
  buildSql: (dataset: string) => string,
): Promise<T[][]> {
  if (sources.length === 0) {
    return [];
  }
  return Promise.all(
    sources.map((s) =>
      runAeSql<T>(env, buildSql(s.dataset), { binding: s.binding }).then(
        (r) => r.data,
      ),
    ),
  );
}

function minTs(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}
function maxTs(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export function mergeOverviewRows(
  rowParts: Array<{
    requests: unknown;
    uniqueKeys: unknown;
    okRequests: unknown;
    errRequests: unknown;
    viewRequests: unknown;
    viewOkRequests: unknown;
    firstSeen: string | null;
    lastSeen: string | null;
  } | undefined>,
) {
  let requests = 0;
  let uniqueKeys = 0;
  let okRequests = 0;
  let errRequests = 0;
  let viewRequests = 0;
  let viewOkRequests = 0;
  let firstSeen: string | null = null;
  let lastSeen: string | null = null;
  for (const r of rowParts) {
    if (!r) continue;
    requests += aeNumber(r.requests);
    uniqueKeys += aeNumber(r.uniqueKeys);
    okRequests += aeNumber(r.okRequests);
    errRequests += aeNumber(r.errRequests);
    viewRequests += aeNumber(r.viewRequests);
    viewOkRequests += aeNumber(r.viewOkRequests);
    firstSeen = minTs(r.firstSeen ?? null, firstSeen);
    lastSeen = maxTs(r.lastSeen ?? null, lastSeen);
  }
  return {
    requests,
    uniqueKeys,
    okRequests,
    errRequests,
    viewRequests,
    viewOkRequests,
    firstSeen,
    lastSeen,
  };
}

export function mergeTimeseries(
  arrs: Array<
    {
      bucket: string;
      requests: unknown;
      ok: unknown;
      err: unknown;
      keys: unknown;
    }[]
  >,
  bucketLabel: "minute" | "hour" | "day",
) {
  const map = new Map<
    string,
    { bucket: string; requests: number; ok: number; err: number; keys: number }
  >();
  for (const arr of arrs) {
    for (const r of arr) {
      const b = String(r.bucket);
      const cur = map.get(b) ?? {
        bucket: b,
        requests: 0,
        ok: 0,
        err: 0,
        keys: 0,
      };
      cur.requests += aeNumber(r.requests);
      cur.ok += aeNumber(r.ok);
      cur.err += aeNumber(r.err);
      cur.keys += aeNumber(r.keys);
      map.set(b, cur);
    }
  }
  const rows = Array.from(map.values()).sort((a, b) =>
    String(a.bucket).localeCompare(String(b.bucket)),
  );
  return { rows, bucket: bucketLabel };
}

export function mergeTopKeys(
  arrs: Array<
    {
      keyId: string;
      requests: unknown;
      ok: unknown;
      err: unknown;
      brands: unknown;
      lastSeen: string;
    }[]
  >,
  resultLimit: number,
) {
  const map = new Map<
    string,
    {
      keyId: string;
      requests: number;
      ok: number;
      err: number;
      brands: number;
      lastSeen: string;
    }
  >();
  for (const arr of arrs) {
    for (const r of arr) {
      const k = r.keyId;
      const cur = map.get(k) ?? {
        keyId: k,
        requests: 0,
        ok: 0,
        err: 0,
        brands: 0,
        lastSeen: r.lastSeen,
      };
      cur.requests += aeNumber(r.requests);
      cur.ok += aeNumber(r.ok);
      cur.err += aeNumber(r.err);
      cur.brands += aeNumber(r.brands);
      if (r.lastSeen > cur.lastSeen) cur.lastSeen = r.lastSeen;
      map.set(k, cur);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.requests - a.requests)
    .slice(0, resultLimit);
}

export function mergeTopBrands(
  arrs: Array<{ brand: string; requests: unknown }[]>,
  resultLimit: number,
) {
  const map = new Map<string, { brand: string; requests: number }>();
  for (const arr of arrs) {
    for (const r of arr) {
      const cur = map.get(r.brand) ?? { brand: r.brand, requests: 0 };
      cur.requests += aeNumber(r.requests);
      map.set(r.brand, cur);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.requests - a.requests)
    .slice(0, resultLimit);
}

export function mergeTopModels(
  arrs: Array<{ brand: string; model: string; requests: unknown }[]>,
  resultLimit: number,
) {
  const map = new Map<string, { brand: string; model: string; requests: number }>();
  for (const arr of arrs) {
    for (const r of arr) {
      const k = `${r.brand}\0${r.model}`;
      const cur = map.get(k) ?? {
        brand: r.brand,
        model: r.model,
        requests: 0,
      };
      cur.requests += aeNumber(r.requests);
      map.set(k, cur);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.requests - a.requests)
    .slice(0, resultLimit);
}

function mergeByFieldName(
  arrs: Array<Record<string, unknown>[]>,
  nameField: "action" | "path" | "view",
  resultLimit: number,
) {
  const map = new Map<string, Record<string, unknown>>();
  for (const arr of arrs) {
    for (const r of arr) {
      const k = String(r[nameField]);
      const ex = map.get(k);
      if (!ex) {
        map.set(k, {
          ...r,
          requests: aeNumber(r.requests),
        });
      } else {
        ex.requests = aeNumber(ex.requests) + aeNumber(r.requests);
        map.set(k, ex);
      }
    }
  }
  return Array.from(map.values())
    .sort(
      (a, b) => aeNumber(b.requests) - aeNumber(a.requests),
    )
    .slice(0, resultLimit) as { requests: number }[] & { action: string }[];
}

export function mergeTopActions(
  arrs: Array<{ action: string; requests: unknown }[]>,
  resultLimit: number,
) {
  return mergeByFieldName(
    arrs as Array<Record<string, unknown>[]>,
    "action",
    resultLimit,
  ) as { action: string; requests: number }[];
}

export function mergeTopPaths(
  arrs: Array<{ path: string; requests: unknown }[]>,
  resultLimit: number,
) {
  return mergeByFieldName(
    arrs as Array<Record<string, unknown>[]>,
    "path",
    resultLimit,
  ) as { path: string; requests: number }[];
}

export function mergeStatusCodes(
  arrs: Array<{ status: number; requests: unknown }[]>,
  resultLimit: number,
) {
  const map = new Map<number, { status: number; requests: number }>();
  for (const arr of arrs) {
    for (const r of arr) {
      const s = r.status;
      const cur = map.get(s) ?? { status: s, requests: 0 };
      cur.requests += aeNumber(r.requests);
      map.set(s, cur);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.requests - a.requests)
    .slice(0, resultLimit);
}

export function mergeTopViews(
  arrs: Array<{
    view: string;
    requests: unknown;
    ok: unknown;
    err: unknown;
    keys: unknown;
  }[]>,
  resultLimit: number,
) {
  const map = new Map<
    string,
    { view: string; requests: number; ok: number; err: number; keys: number }
  >();
  for (const arr of arrs) {
    for (const r of arr) {
      const cur = map.get(r.view) ?? {
        view: r.view,
        requests: 0,
        ok: 0,
        err: 0,
        keys: 0,
      };
      cur.requests += aeNumber(r.requests);
      cur.ok += aeNumber(r.ok);
      cur.err += aeNumber(r.err);
      cur.keys += aeNumber(r.keys);
      map.set(r.view, cur);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.requests - a.requests)
    .slice(0, resultLimit);
}

export function mergeRecent(
  arrs: Array<
    {
      timestamp: string;
      keyId: string;
      path: string;
      brand: string;
      model: string;
      action: string;
      statusText: string;
      status: number;
      sampleInterval: number;
    }[]
  >,
  resultLimit: number,
) {
  const all = arrs.flat();
  all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return all.slice(0, resultLimit);
}
