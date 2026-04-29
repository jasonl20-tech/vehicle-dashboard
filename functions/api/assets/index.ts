/**
 * Asset-Liste.
 *
 *   GET /api/assets?folder=&q=&limit=&offset=&sort=
 *     → { rows, total, limit, offset, public_base, folder }
 *
 * Filter:
 *   - `folder`  → exakter Folder-Pfad (Default: ""=Root). Listet nur
 *                  Direkt-Kinder, keine rekursive Sub-Ordner-Inhalte.
 *   - `q`       → freitext-Suche über `name`, `alt_text`, `description`
 *                  (case-insensitive). Wenn gesetzt, werden Ordner
 *                  ignoriert und die Suche geht über ALLE Folders.
 *   - `sort`    → "newest" (default), "name", "size"
 *   - `limit`   → 1..200 (Default: 100)
 *   - `offset`  → ≥ 0
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  ASSETS_DEFAULT_PUBLIC_BASE,
  HIDDEN_NAMES,
  normalizeFolder,
  rowToAsset,
  requireBindings,
  tableMissingHint,
  type AssetRow,
} from "../../_lib/assets";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;

type DbRow = Omit<AssetRow, "url">;

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const fail = requireBindings(env);
  if (fail) return fail;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  let folder = "";
  try {
    folder = normalizeFolder(url.searchParams.get("folder") || "");
  } catch (e) {
    return jsonResponse(
      { error: (e as Error).message },
      { status: 400 },
    );
  }
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      Number(url.searchParams.get("limit") || DEFAULT_LIMIT) || DEFAULT_LIMIT,
    ),
  );
  const offset = Math.max(
    0,
    Number(url.searchParams.get("offset") || 0) || 0,
  );
  const sortKey = url.searchParams.get("sort") || "newest";
  const order =
    sortKey === "name"
      ? "kind DESC, name COLLATE NOCASE ASC"
      : sortKey === "size"
        ? "kind DESC, size DESC"
        : "kind DESC, datetime(uploaded_at) DESC";

  const where: string[] = [];
  const binds: (string | number)[] = [];

  if (q) {
    const pat = `%${q.replace(/[%_]/g, "")}%`;
    where.push(
      "(name LIKE ? COLLATE NOCASE OR IFNULL(alt_text,'') LIKE ? COLLATE NOCASE OR IFNULL(description,'') LIKE ? COLLATE NOCASE)",
    );
    binds.push(pat, pat, pat);
  } else {
    // Nur Direktkinder des Folders. Ein leerer folder = Root.
    where.push("folder = ?");
    binds.push(folder);
  }

  // Marker-/Hidden-Files niemals listen.
  if (HIDDEN_NAMES.size > 0) {
    const placeholders = Array.from(HIDDEN_NAMES)
      .map(() => "?")
      .join(",");
    where.push(`name NOT IN (${placeholders})`);
    for (const n of HIDDEN_NAMES) binds.push(n);
  }

  const whereSql = ` WHERE ${where.join(" AND ")}`;

  try {
    const total =
      (
        await env
          .website!.prepare(`SELECT COUNT(*) AS n FROM assets${whereSql}`)
          .bind(...binds)
          .first<{ n: number }>()
      )?.n ?? 0;

    const { results } = await env
      .website!.prepare(
        `SELECT id, key, folder, name, size, content_type, kind, alt_text, description,
                uploaded_by, uploaded_at, updated_at
         FROM assets${whereSql}
         ORDER BY ${order}
         LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, offset)
      .all<DbRow>();

    return jsonResponse({
      rows: (results ?? []).map((r) => rowToAsset(env, r)),
      total,
      limit,
      offset,
      folder,
      public_base: env.ASSETS_PUBLIC_BASE || ASSETS_DEFAULT_PUBLIC_BASE,
    });
  } catch (e) {
    const hint = tableMissingHint(e);
    return jsonResponse(
      {
        error: (e as Error).message || String(e),
        ...(hint ? { hint } : null),
      },
      { status: hint ? 503 : 500 },
    );
  }
};
