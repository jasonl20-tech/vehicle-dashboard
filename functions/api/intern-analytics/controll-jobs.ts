/**
 * GET /api/intern-analytics/controll-jobs
 *
 * D1 `vehicledatabase` → Tabelle `controll_status` (Korrektur-Jobs).
 *
 * Query: check=all|0|1|2|3  vehicle_id=  q=  limit=  offset=
 *   job_check: 0 offen, 1 in Bearbeitung, 2 korrekt, 3 fehlgeschlagen
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function requireVehicleDb(env: AuthEnv): D1Database | Response {
  if (!env.vehicledatabase) {
    return jsonResponse(
      {
        error:
          "D1-Binding `vehicledatabase` fehlt. Im Cloudflare-Dashboard → Functions → D1, Variable `vehicledatabase` (env.vehicledatabase) setzen.",
      },
      { status: 503 },
    );
  }
  return env.vehicledatabase;
}

function likePattern(q: string): string {
  const t = q.replace(/[%_]/g, "").trim();
  if (!t) return "";
  return `%${t}%`;
}

type ControllJobRow = {
  id: number;
  vehicle_id: number;
  view_token: string;
  mode: string;
  status: string;
  updated_at: string;
  key: string | null;
  job_check: number;
};

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireVehicleDb(env);
  if (db instanceof Response) return db;

  const url = new URL(request.url);
  const checkRaw = (url.searchParams.get("check") || "all").trim();
  const vehicleIdRaw = (url.searchParams.get("vehicle_id") || "").trim();
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit") || DEFAULT_LIMIT) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);

  if (!["all", "0", "1", "2", "3"].includes(checkRaw)) {
    return jsonResponse(
      { error: "check muss all, 0, 1, 2 oder 3 sein" },
      { status: 400 },
    );
  }

  let vehicleId: number | null = null;
  if (vehicleIdRaw) {
    const n = Number(vehicleIdRaw);
    if (!Number.isFinite(n) || n < 0) {
      return jsonResponse({ error: "vehicle_id ungültig" }, { status: 400 });
    }
    vehicleId = n;
  }

  const where: string[] = ["1=1"];
  const binds: (string | number)[] = [];

  if (checkRaw !== "all") {
    where.push(`"check" = ?`);
    binds.push(Number(checkRaw));
  }
  if (vehicleId != null) {
    where.push("vehicle_id = ?");
    binds.push(vehicleId);
  }

  const pat = likePattern(q);
  if (pat) {
    where.push(
      `(
  CAST(vehicle_id AS TEXT) LIKE ?
  OR view_token LIKE ?
  OR mode LIKE ?
  OR status LIKE ?
  OR IFNULL(key, '') LIKE ?
)`,
    );
    binds.push(pat, pat, pat, pat, pat);
  }

  const whereSql = ` WHERE ${where.join(" AND ")}`;

  const countRow = await db
    .prepare(
      `SELECT COUNT(*) as n FROM controll_status${whereSql}`,
    )
    .bind(...binds)
    .first<{ n: number }>();
  const total = countRow?.n ?? 0;

  const listStmt = `SELECT
  id, vehicle_id, view_token, mode, status, updated_at, key, "check" AS job_check
FROM controll_status
${whereSql}
ORDER BY updated_at DESC
LIMIT ? OFFSET ?`;
  const { results } = await db
    .prepare(listStmt)
    .bind(...binds, limit, offset)
    .all<ControllJobRow>();

  const countByCheck = await db
    .prepare(
      `SELECT "check" AS c, COUNT(*) as n
FROM controll_status
GROUP BY "check"`,
    )
    .all<{ c: number; n: number }>();
  const checkCounts: Record<string, number> = {};
  for (const r of countByCheck.results ?? []) {
    checkCounts[String(r.c)] = r.n;
  }

  return jsonResponse(
    {
      rows: results ?? [],
      total,
      offset,
      limit,
      checkCounts,
    },
    { status: 200 },
  );
};
