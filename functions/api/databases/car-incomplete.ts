/**
 * GET /api/databases/car-incomplete?q=&only=incomplete|all&limit=&offset=
 *
 * Finder fürs NEUE System: Autos in `fahrzeugliste`, bei denen nicht alle 8
 * Standard-AUSSEN-Ansichten gerendert sind (r2_key vorhanden). Pro Auto
 * (marke|modell|jahr|body|trim|farbe): welche Ansichten da/fehlend sind.
 *
 * Die Nach-Generierung läuft im Frontend über /api/databases/car-generate
 * (kie.ai) + /api/databases/car-generate-save (→ kontrolliert=0 → neue Kontrolle).
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const EXTERIOR_VIEWS = [
  "front",
  "rear",
  "left",
  "right",
  "front_left",
  "front_right",
  "rear_left",
  "rear_right",
] as const;

const RENDERED = "(r2_key IS NOT NULL AND r2_key <> '')";
// „Ansicht gerendert": eine Zeile mit dieser view + vorhandenem r2_key.
const hasView = (v: string) =>
  `MAX(CASE WHEN "view" = '${v}' AND ${RENDERED} THEN 1 ELSE 0 END)`;
const N_EXT = EXTERIOR_VIEWS.map(hasView).join(" + ");

function likePattern(raw: string): string | null {
  const v = raw.trim().replace(/[%_]/g, " ").replace(/\s+/g, " ").trim();
  return v ? `%${v}%` : null;
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  const db = env.cardb;
  if (!db) {
    return jsonResponse({ error: "D1-Binding `cardb` fehlt." }, { status: 503 });
  }

  const p = new URL(request.url).searchParams;
  const only = (p.get("only") || "incomplete").toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(p.get("limit") || 50)));
  const offset = Math.max(0, Number(p.get("offset") || 0));

  const where: string[] = [];
  const binds: (string | number)[] = [];
  const q = likePattern(p.get("q") || "");
  if (q) {
    where.push("(marke LIKE ? OR modell LIKE ? OR (marke||' '||modell) LIKE ?)");
    binds.push(q, q, q);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const havingSql = only === "incomplete" ? "HAVING n_ext < 8" : "";

  const viewCols = EXTERIOR_VIEWS.map((v) => `${hasView(v)} AS has_${v}`).join(
    ",\n      ",
  );
  const groupBy =
    "GROUP BY marke, modell, jahr, body, trim, farbe";

  const sql = `SELECT
      marke, modell, jahr, body, trim, farbe,
      (${N_EXT}) AS n_ext,
      ${viewCols}
    FROM fahrzeugliste ${whereSql}
    ${groupBy}
    ${havingSql}
    ORDER BY n_ext ASC, marke, modell, jahr
    LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS n FROM (
    SELECT (${N_EXT}) AS n_ext FROM fahrzeugliste ${whereSql} ${groupBy} ${havingSql})`;

  try {
    const [countRow, res] = await Promise.all([
      db.prepare(countSql).bind(...binds).first<{ n: number }>(),
      db.prepare(sql).bind(...binds, limit, offset).all(),
    ]);
    const rows = (res.results ?? []).map((r) => {
      const o = r as Record<string, unknown>;
      const present = EXTERIOR_VIEWS.filter((v) => Number(o[`has_${v}`]) === 1);
      const missing = EXTERIOR_VIEWS.filter((v) => Number(o[`has_${v}`]) !== 1);
      return {
        marke: String(o.marke ?? ""),
        modell: String(o.modell ?? ""),
        jahr: Number(o.jahr ?? 0),
        body: String(o.body ?? ""),
        trim: String(o.trim ?? ""),
        farbe: String(o.farbe ?? ""),
        nExt: Number(o.n_ext ?? 0),
        present,
        missing,
      };
    });
    return jsonResponse({
      total: Number(countRow?.n ?? 0),
      rows,
      limit,
      offset,
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
};
