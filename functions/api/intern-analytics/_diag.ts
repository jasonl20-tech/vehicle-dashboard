/**
 * Diagnose für die Controlling-Quelle:
 *   GET /api/intern-analytics/_diag
 *
 * Liefert:
 *   - SHOW TABLES (auf dem aktiven Account)
 *   - Probe-Selects mit FROM key_analytics, FROM api_analytics
 *     und FROM <controll_platform_logs> (dedicated Tabellenname)
 */
import {
  API_ANALYTICS_DATASET,
  KEY_ANALYTICS_DATASET,
  resolveAnalyticsBinding,
  runAeSql,
  type AeAccountBinding,
  type AeRow,
  type AeSqlError,
} from "../../_lib/analytics";
import {
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
} from "../../_lib/auth";
import { getControllingDataset } from "../../_lib/controllingPlatformStats";

type Probe = {
  label: string;
  sql: string;
  ok: boolean;
  status?: number;
  rows?: number;
  error?: string;
  hint?: string;
};

async function probe(
  env: AuthEnv,
  binding: AeAccountBinding,
  label: string,
  sql: string,
): Promise<Probe> {
  try {
    const r = await runAeSql<AeRow>(env, sql, { binding });
    return { label, sql, ok: true, rows: r.data.length };
  } catch (e) {
    const err = e as AeSqlError;
    return {
      label,
      sql,
      ok: false,
      status: err.status,
      error: err.message,
      hint: err.hint,
    };
  }
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const dataset = getControllingDataset(env);

  const out: {
    dataset: string;
    primary: { available: boolean; error: string | null };
    secondary: { available: boolean; error: string | null };
    showTables?: { binding: AeAccountBinding; ok: boolean; tables?: string[]; error?: string };
    probes: Probe[];
  } = {
    dataset,
    primary: { available: false, error: null },
    secondary: { available: false, error: null },
    probes: [],
  };

  const p = resolveAnalyticsBinding(env, "primary");
  out.primary = { available: !p.error, error: p.error };
  const s = resolveAnalyticsBinding(env, "secondary");
  out.secondary = { available: !s.error, error: s.error };

  const bindings: AeAccountBinding[] = [];
  if (out.primary.available) bindings.push("primary");
  if (out.secondary.available) bindings.push("secondary");

  // SHOW TABLES auf primary (nur, wenn vorhanden)
  if (out.primary.available) {
    try {
      const r = await runAeSql<{ name?: string; table?: string }>(
        env,
        "SHOW TABLES FORMAT JSON",
        { binding: "primary" },
      );
      const names = r.data
        .map((row) => row.name ?? row.table ?? Object.values(row)[0])
        .filter((x): x is string => typeof x === "string");
      out.showTables = { binding: "primary", ok: true, tables: names };
    } catch (e) {
      out.showTables = {
        binding: "primary",
        ok: false,
        error: (e as Error).message,
      };
    }
  }

  // Probes
  for (const b of bindings) {
    const ds = b === "secondary" ? API_ANALYTICS_DATASET : KEY_ANALYTICS_DATASET;
    out.probes.push(
      await probe(
        env,
        b,
        `SELECT 1 FROM ${ds} LIMIT 1`,
        `SELECT 1 AS one FROM ${ds} LIMIT 1 FORMAT JSON`,
      ),
    );
    out.probes.push(
      await probe(
        env,
        b,
        `timestamp aus ${ds} (ohne Filter)`,
        `SELECT timestamp, dataset, blob4 FROM ${ds} LIMIT 1 FORMAT JSON`,
      ),
    );
    out.probes.push(
      await probe(
        env,
        b,
        `timestamp + dataset='${dataset}' aus ${ds}`,
        `SELECT timestamp, blob4 FROM ${ds} WHERE dataset = '${dataset.replace(/'/g, "''")}' LIMIT 1 FORMAT JSON`,
      ),
    );
    if (/^[a-zA-Z0-9_]+$/.test(dataset)) {
      out.probes.push(
        await probe(
          env,
          b,
          `dedicated FROM ${dataset}`,
          `SELECT timestamp, blob4 FROM ${dataset} LIMIT 1 FORMAT JSON`,
        ),
      );
    }
  }

  return jsonResponse(out, { status: 200 });
};
