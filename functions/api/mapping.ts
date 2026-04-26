import { getCurrentUser, jsonResponse, type AuthEnv } from "../_lib/auth";

const MAX_LIMIT = 200;

type MappingTable =
  | "manufacture_mapping"
  | "model_mapping"
  | "color_mapping"
  | "body_mapping"
  | "trim_mapping";

const MAPPING_TABLES = new Set<MappingTable>([
  "manufacture_mapping",
  "model_mapping",
  "color_mapping",
  "body_mapping",
  "trim_mapping",
]);

function isMappingTable(s: string): s is MappingTable {
  return MAPPING_TABLES.has(s as MappingTable);
}

function requireMappingDb(env: AuthEnv): D1Database | Response {
  if (!env.mapping) {
    return jsonResponse(
      {
        error:
          "D1-Binding `mapping` fehlt. Im Cloudflare-Dashboard → Functions → D1, Variable `mapping` (env.mapping) setzen.",
      },
      { status: 503 },
    );
  }
  return env.mapping;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/** LIKE-Muster: % und _ in der Nutzereingabe entfernen. */
function likePattern(q: string): string {
  const t = q.replace(/[%_]/g, "").trim();
  if (!t) return "";
  return `%${t}%`;
}

type Binds = (string | number)[];

function whereSearch(table: MappingTable, q: string): { sql: string; binds: Binds } {
  const pat = likePattern(q);
  if (!pat) return { sql: "", binds: [] };
  if (table === "manufacture_mapping") {
    return {
      sql: " WHERE (name LIKE ? OR alias LIKE ?)",
      binds: [pat, pat],
    };
  }
  if (table === "model_mapping" || table === "color_mapping") {
    return {
      sql: " WHERE (ifnull(manufacture, '') LIKE ? OR name LIKE ? OR alias LIKE ?)",
      binds: [pat, pat, pat],
    };
  }
  if (table === "body_mapping" || table === "trim_mapping") {
    return {
      sql: " WHERE (ifnull(manufacture, '') LIKE ? OR ifnull(model, '') LIKE ? OR name LIKE ? OR alias LIKE ?)",
      binds: [pat, pat, pat, pat],
    };
  }
  return { sql: "", binds: [] };
}

function strReq(v: unknown, field: string): string {
  if (v == null || typeof v !== "string" || !v.trim()) {
    throw new Error(`${field} ist erforderlich`);
  }
  return v.trim();
}

function strOpt(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

/**
 * GET /api/mapping?table=...&limit=&offset=&q=
 */
export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireMappingDb(env);
  if (db instanceof Response) return db;

  const url = new URL(request.url);
  const table = (url.searchParams.get("table") || "").trim();
  if (!isMappingTable(table)) {
    return jsonResponse(
      {
        error:
          "Ungültiger Parameter table. Erlaubt: manufacture_mapping, model_mapping, color_mapping, body_mapping, trim_mapping",
      },
      { status: 400 },
    );
  }
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10) || 100),
  );
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);

  const wc = whereSearch(table, q);
  const from = ` FROM ${table}`;
  const countSql = `SELECT COUNT(*) as n${from}${wc.sql}`;
  const dataSql = `SELECT *${from}${wc.sql} ORDER BY id ASC LIMIT ? OFFSET ?`;

  try {
    const binds0 = wc.binds;
    const countRow = await db
      .prepare(countSql)
      .bind(...binds0)
      .first<{ n: number }>();
    const total = countRow?.n ?? 0;

    const dataBinds: Binds = [...binds0, limit, offset];
    const { results } = await db
      .prepare(dataSql)
      .bind(...dataBinds)
      .all();

    return jsonResponse(
      {
        table,
        rows: results ?? [],
        total,
        limit,
        offset,
        q: q || null,
      },
      { status: 200 },
    );
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
};

/**
 * POST /api/mapping
 * Body: { "table": "...", "row": { ... } } (ohne id)
 */
export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireMappingDb(env);
  if (db instanceof Response) return db;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }
  if (!isRecord(body) || !isRecord(body.row)) {
    return jsonResponse({ error: "row fehlt oder ungültig" }, { status: 400 });
  }
  const table = typeof body.table === "string" ? body.table.trim() : "";
  if (!isMappingTable(table)) {
    return jsonResponse({ error: "Ungültiger table" }, { status: 400 });
  }
  const r = body.row;
  if (r.id != null) {
    return jsonResponse({ error: "id bei POST nicht erlaubt" }, { status: 400 });
  }

  try {
    async function readInsertedRow(createdId: number) {
      const row = await db
        .prepare(`SELECT * FROM ${table} WHERE id = ?`)
        .bind(createdId)
        .first<Record<string, unknown>>();
      return row;
    }

    if (table === "manufacture_mapping") {
      const name = strReq(r.name, "name");
      const alias = strReq(r.alias, "alias");
      const run = await db
        .prepare("INSERT INTO manufacture_mapping (name, alias) VALUES (?, ?)")
        .bind(name, alias)
        .run();
      const newId = Number(run.meta.last_row_id);
      const row = await readInsertedRow(newId);
      return jsonResponse({ row }, { status: 201 });
    }
    if (table === "model_mapping" || table === "color_mapping") {
      const name = strReq(r.name, "name");
      const alias = strReq(r.alias, "alias");
      const manufacture = strOpt(r.manufacture);
      const run = await db
        .prepare(
          `INSERT INTO ${table} (manufacture, name, alias) VALUES (?, ?, ?)`,
        )
        .bind(manufacture, name, alias)
        .run();
      const newId = Number(run.meta.last_row_id);
      const row = await readInsertedRow(newId);
      return jsonResponse({ row }, { status: 201 });
    }
    if (table === "body_mapping" || table === "trim_mapping") {
      const name = strReq(r.name, "name");
      const alias = strReq(r.alias, "alias");
      const manufacture = strOpt(r.manufacture);
      const model = strOpt(r.model);
      const run = await db
        .prepare(
          `INSERT INTO ${table} (manufacture, model, name, alias) VALUES (?, ?, ?, ?)`,
        )
        .bind(manufacture, model, name, alias)
        .run();
      const newId = Number(run.meta.last_row_id);
      const row = await readInsertedRow(newId);
      return jsonResponse({ row }, { status: 201 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("constraint")) {
      return jsonResponse(
        { error: "Eindeutigkeit: Eintrag existiert bereits (siehe UNIQUE-Regel)." },
        { status: 409 },
      );
    }
    if (e instanceof Error && (msg.includes("erforderlich") || msg.startsWith("name "))) {
      return jsonResponse({ error: e.message }, { status: 400 });
    }
    return jsonResponse({ error: msg }, { status: 500 });
  }
  return jsonResponse({ error: "unreachable" }, { status: 500 });
};

/**
 * PUT /api/mapping
 * Body: { "table", "id", "row" }
 */
export const onRequestPut: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireMappingDb(env);
  if (db instanceof Response) return db;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }
  if (!isRecord(body) || !isRecord(body.row)) {
    return jsonResponse({ error: "row fehlt oder ungültig" }, { status: 400 });
  }
  const table = typeof body.table === "string" ? body.table.trim() : "";
  const id = typeof body.id === "number" ? body.id : parseInt(String(body.id), 10);
  if (!isMappingTable(table) || !Number.isFinite(id) || id < 1) {
    return jsonResponse({ error: "Ungültiger table oder id" }, { status: 400 });
  }
  const r = body.row;

  try {
    if (table === "manufacture_mapping") {
      const name = strReq(r.name, "name");
      const alias = strReq(r.alias, "alias");
      await db
        .prepare("UPDATE manufacture_mapping SET name = ?, alias = ? WHERE id = ?")
        .bind(name, alias, id)
        .run();
    } else if (table === "model_mapping" || table === "color_mapping") {
      const name = strReq(r.name, "name");
      const alias = strReq(r.alias, "alias");
      const manufacture = strOpt(r.manufacture);
      await db
        .prepare(
          `UPDATE ${table} SET manufacture = ?, name = ?, alias = ? WHERE id = ?`,
        )
        .bind(manufacture, name, alias, id)
        .run();
    } else {
      const name = strReq(r.name, "name");
      const alias = strReq(r.alias, "alias");
      const manufacture = strOpt(r.manufacture);
      const model = strOpt(r.model);
      await db
        .prepare(
          `UPDATE ${table} SET manufacture = ?, model = ?, name = ?, alias = ? WHERE id = ?`,
        )
        .bind(manufacture, model, name, alias, id)
        .run();
    }
    const row = await db
      .prepare(`SELECT * FROM ${table} WHERE id = ?`)
      .bind(id)
      .first();
    return jsonResponse({ row }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("constraint")) {
      return jsonResponse(
        { error: "Eindeutigkeit: Konflikt mit bestehendem Datensatz." },
        { status: 409 },
      );
    }
    if (e instanceof Error && (e as Error).message.startsWith("name ")) {
      return jsonResponse({ error: (e as Error).message }, { status: 400 });
    }
    return jsonResponse({ error: msg }, { status: 500 });
  }
};

/**
 * DELETE /api/mapping?table=...&id=...
 */
export const onRequestDelete: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const db = requireMappingDb(env);
  if (db instanceof Response) return db;

  const url = new URL(request.url);
  const table = (url.searchParams.get("table") || "").trim();
  const id = parseInt(url.searchParams.get("id") || "", 10);
  if (!isMappingTable(table) || !Number.isFinite(id) || id < 1) {
    return jsonResponse({ error: "Ungültiger table oder id" }, { status: 400 });
  }
  try {
    const r = await db
      .prepare(`DELETE FROM ${table} WHERE id = ?`)
      .bind(id)
      .run();
    if (r.meta.changes === 0) {
      return jsonResponse({ error: "Nicht gefunden" }, { status: 404 });
    }
    return jsonResponse({ ok: true, id }, { status: 200 });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
};
